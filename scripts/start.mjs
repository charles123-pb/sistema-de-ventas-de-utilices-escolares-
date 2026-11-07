// Arranque local de ambos servidores. No publica el proyecto.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(root, "backend");
const frontend = resolve(root, "frontend");
const demo = process.argv.includes("--demo");
const children = [];
const env = { ...process.env };
// Se admite Go instalado normalmente o la instalación temporal de esta sesión.
const temporaryGo = "/tmp/utilventa-toolchain/go/bin/go";
const go = env.GO_BIN || (existsSync(temporaryGo) ? temporaryGo : "go");
if (go === temporaryGo) {
  env.PATH = `${dirname(go)}${delimiter}${env.PATH || ""}`;
  env.GOCACHE ||= "/tmp/utilventa-go-cache";
  env.GOPATH ||= "/tmp/utilventa-gopath";
}
let frontendPort = 5173;
env.APP_ENV ||= "development";
env.VITE_DEMO = demo ? "1" : "0";
env.DB_PATH = resolve(
  backend,
  env.DB_PATH || (demo ? "data/presentacion.db" : "data/utilventa.db"),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 600).unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
function run(command, args, cwd, finite = false) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`No se pudo iniciar ${command}: ${error.message}`);
    stop(1);
  });
  if (!finite)
    child.on("exit", (code) => {
      if (!stopping) stop(code || 0);
    });
  return child;
}
async function finish(child) {
  return new Promise((ok, fail) => {
    child.once("error", fail);
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(new Error("La configuración no pudo completarse.")),
    );
  });
}
// Busca un puerto local libre para no desplazar otras aplicaciones que ya estén abiertas.
async function freePort(first) {
  for (let port = first; port < first + 20; port++) {
    const available = await new Promise((ok, fail) => {
      const probe = createServer();
      probe.once("error", (error) =>
        error.code === "EADDRINUSE" ? ok(false) : fail(error),
      );
      probe.listen(port, "127.0.0.1", () => probe.close(() => ok(true)));
    });
    if (available) return port;
  }
  throw new Error("No se encontró un puerto libre para la presentación.");
}
// Espera una respuesta HTTP correcta antes de anunciar que cada servidor está disponible.
async function ready(url) {
  for (let i = 0; i < 180; i++) {
    if (stopping)
      throw new Error("El servidor se detuvo antes de estar disponible.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* Esperar el arranque. */
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error(
    "El servidor no respondió a tiempo. Revisa el puerto y su salida.",
  );
}
try {
  if (process.argv.includes("--tests")) {
    if (existsSync("/tmp/utilventa-browsers"))
      env.PLAYWRIGHT_BROWSERS_PATH ||= "/tmp/utilventa-browsers";
    await finish(
      run(
        process.execPath,
        [resolve(frontend, "node_modules/playwright/cli.js"), "test"],
        frontend,
        true,
      ),
    );
    process.exit(0);
  }
  if (process.argv.includes("--seed-examples")) {
    await finish(run(go, ["run", "./cmd/setup", "ejemplos"], backend, true));
    process.exit(0);
  }
  if (process.argv.includes("--seed-demo")) {
    const target = resolve(backend, "data/presentacion.db");
    if (!existsSync(target))
      throw new Error("Primero configura el administrador de presentación.");
    env.DB_PATH = target;
    await finish(run(go, ["run", "./cmd/setup", "demo"], backend, true));
    process.exit(0);
  }
  if (process.argv.includes("--check")) {
    // La base habitual se revisa sin registrar ventas; el recorrido histórico
    // que crea operaciones queda reservado a la base demo explícita.
    await import(demo ? "./check-presentation.mjs" : "./check-schoolshop.mjs");
    process.exit(process.exitCode || 0);
  }
  // Reinicio explícito: solo termina procesos de esta copia del proyecto.
  // No se mata por número de puerto, para proteger otras aplicaciones.
  const restartState = resolve(backend, "data/presentacion-servicios.json");
  if (process.argv.includes("--restart") && existsSync(restartState)) {
    if (process.platform !== "linux") throw new Error("Cierra el arranque anterior y vuelve a ejecutar npm run start.");
    const previous = JSON.parse(readFileSync(restartState, "utf8"));
    if (previous.dbPath !== env.DB_PATH || previous.demo !== demo) throw new Error("El arranque anterior usa otra base; no se reinició.");
    const serverPath = resolve(backend,"data/utilventa-server");
    const vitePath = resolve(frontend,"node_modules/vite/bin/vite.js");
    for (const pid of readdirSync("/proc").filter(id=>/^[0-9]+$/.test(id))) {
      let args;
      try { args=readFileSync(`/proc/${pid}/cmdline`,"utf8").split("\0"); } catch { continue; }
      if (args[0]===serverPath || args.includes(vitePath)) {
        try {process.kill(Number(pid),"SIGTERM");}catch(error){if(error.code!=="ESRCH")throw error;}
      }
    }
    await new Promise(ok=>setTimeout(ok,1000));
    let stillRunning=false;
    try {const response=await fetch(previous.url+"/api/health",{signal:AbortSignal.timeout(1000)});stillRunning=response.ok;}catch{/* Ya se cerró. */}
    if(stillRunning)throw new Error("La instancia anterior sigue activa; no se inició otra sobre la misma base.");
  }
  // Reutiliza un arranque previo si responde y coincide con la base y el modo solicitados.
  const stateFile = resolve(backend, "data/presentacion-servicios.json");
  if (existsSync(stateFile)) {
    try {
      const previous = JSON.parse(readFileSync(stateFile, "utf8"));
      if (previous.dbPath === env.DB_PATH && previous.demo === demo) {
        const response = await fetch(previous.url + "/api/health", {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok && (await response.json()).estado === "ok") {
          console.log(`ÚtilVenta ya está abierto en ${previous.url}/login`);
          process.exit(0);
        }
      }
    } catch {
      /* Un arranque anterior ya no está disponible. */
    }
  }
  const backendPort = env.PORT ? Number(env.PORT) : await freePort(8080);
  frontendPort = await freePort(5173);
  env.PORT = String(backendPort);
  env.APP_ORIGIN ||= `http://localhost:${frontendPort}`;
  // Vite usará este destino para /api; APP_ORIGIN permite a Go comprobar las escrituras del navegador.
  env.VITE_API_TARGET = `http://127.0.0.1:${backendPort}`;
  if (backendPort !== 8080)
    console.log(`El puerto 8080 está ocupado; backend en ${backendPort}.`);
  if (demo) {
    if (!existsSync(env.DB_PATH))
      throw new Error(
        "Primero configura el administrador de presentación siguiendo PRESENTACION.md.",
      );
    await finish(run(go, ["run", "./cmd/setup", "demo"], backend, true));
  }
  // Compilar permite cerrar el proceso real sin dejar hijos de go run.
  const binary = resolve(
    backend,
    "data",
    process.platform === "win32" ? "utilventa-server.exe" : "utilventa-server",
  );
  // El arranque también debe funcionar desde una copia del proyecto sin metadatos Git accesibles.
  await finish(run(go, ["build", "-buildvcs=false", "-o", binary, "./cmd/server"], backend, true));
  run(binary, [], backend);
  await ready(`http://127.0.0.1:${env.PORT}/api/health`);
  run(
    process.execPath,
    [
      resolve(frontend, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(frontendPort),
      "--strictPort",
    ],
    frontend,
  );
  await ready(`http://localhost:${frontendPort}`);
  writeFileSync(
    resolve(backend, "data/presentacion-servicios.json"),
    JSON.stringify(
      {
        url: `http://localhost:${frontendPort}`,
        backendPort,
        dbPath: env.DB_PATH,
        demo,
      },
      null,
      2,
    ),
  );
  console.log("\nÚtilVenta Ayacucho está disponible:");
  console.log(`  Catálogo: http://localhost:${frontendPort}/catalogo`);
  console.log(`  Personal: http://localhost:${frontendPort}/login`);
  if (demo)
    console.log(
      "  Base de presentación separada. Todos los productos son DEMO.",
    );
  console.log(
    "Mantén esta terminal abierta. Ctrl+C cierra ambos servidores.\n",
  );
} catch (error) {
  console.error(error.message);
  stop(1);
}
