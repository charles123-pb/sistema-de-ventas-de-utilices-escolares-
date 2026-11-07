// Recorre la demostración contra SQLite real. Solo se usa con la base de presentación.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "frontend/package.json"));
if (existsSync("/tmp/utilventa-browsers"))
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/tmp/utilventa-browsers";
const { firefox } = require("playwright");
async function openModule(page, name, group) {
  const link = page.getByRole("link", { name, exact: true });
  if (!(await link.isVisible())) {
    await page.getByRole("button", { name: group, exact: true }).click();
  }
  await link.click();
}
const statePath = resolve(root, "backend/data/presentacion-servicios.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { url: "http://localhost:5173" };
if (
  state.demo !== true ||
  !["localhost", "127.0.0.1"].includes(new URL(state.url).hostname)
) {
  throw new Error(
    "La comprobación solo admite el servidor local de presentación. Ejecuta npm run start -- --demo.",
  );
}
const access = readFileSync(
  resolve(root, "backend/data/ACCESO_PRESENTACION.txt"),
  "utf8",
);
const user = access.match(/^Usuario: (.+)$/m)?.[1];
const password = access.match(/^Contraseña: (.+)$/m)?.[1];
if (!user || !password)
  throw new Error("Falta el archivo privado de acceso de presentación.");
const artifacts = resolve(root, "backend/data/presentacion");
mkdirSync(artifacts, { recursive: true });
const browser = await firefox.launch({ headless: true });
try {
  const context = await browser.newContext({
    baseURL: state.url,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page
    .getByRole("heading", { name: "Tu librería, de un vistazo" })
    .waitFor();
  console.log("Comprobado: inicio de sesión y panel con datos de SQLite.");
  if (process.argv.includes("--capture")) {
    await page.locator(".chart-bar").first().waitFor();
    await page.screenshot({
      path: resolve(artifacts, "panel.png"),
      fullPage: true,
    });
    await openModule(page, "Productos", "Inventario");
    await page.getByRole("heading", { name: "Productos", exact: true }).waitFor();
    await page.locator(".table tbody tr").first().waitFor();
    await page.screenshot({
      path: resolve(artifacts, "productos-compactos.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await page.locator(".chart-bar").first().waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "El panel móvil desborda la pantalla.",
    );
    await page.screenshot({
      path: resolve(artifacts, "panel-movil.png"),
      fullPage: true,
    });
    const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
    await menu.click();
    await page.getByRole("button", { name: "Listas escolares", exact: true }).click();
    await page.screenshot({ path: resolve(artifacts, "menu-movil.png") });
    await page.getByRole("button", { name: "Listas escolares", exact: true }).focus();
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.ok(await menu.evaluate((node) => node === document.activeElement));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/catalogo");
    await page.locator(".product-card").first().waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".product-card img"))
        .filter((image) => image.getBoundingClientRect().top < innerHeight)
        .every((image) => image.complete && image.naturalWidth > 0),
    );
    await page.screenshot({
      path: resolve(artifacts, "catalogo-escritorio.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: resolve(artifacts, "catalogo-movil-vista.png"),
    });
    await page.locator("#solicitud").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(artifacts, "ejemplos-listas.png") });
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      "Capturas actualizadas en backend/data/presentacion; no se registraron operaciones.",
    );
    process.exit(0);
  }
  const products = await page.evaluate(async () =>
    (await fetch("/api/productos?q=DEMO-01")).json(),
  );
  assert.equal(products.length, 1);
  const product = products[0];
  assert.ok(
    product.stock >= 2,
    "Se necesitan dos unidades de DEMO-01 para la demostración.",
  );
  const buyer = await browser.newContext({
    baseURL: state.url,
    viewport: { width: 390, height: 844 },
  });
  const customer = await buyer.newPage();
  await customer.goto("/catalogo");
  await customer.locator(".product-card").first().waitFor();
  assert.ok(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "El catálogo móvil desborda la pantalla.",
  );
  await customer.screenshot({
    path: resolve(artifacts, "catalogo-movil.png"),
    fullPage: true,
  });
  await customer.getByLabel("Buscar", { exact: true }).fill("DEMO-01");
  await customer.locator(".product-card").first().waitFor();
  await customer.getByRole("button", { name: "Agregar a mi lista" }).click();
  await customer.getByRole("button", { name: "Agregar a mi lista" }).click();
  assert.equal(await customer.locator("#carrito .cart-line").count(), 1);
  const clientName =
    "[DEMO] Familia escolar " + Date.now().toString().slice(-6);
  await customer.getByLabel("Tu nombre").fill(clientName);
  await customer.getByLabel("Teléfono", { exact: true }).fill("999000001");
  await customer.getByRole("button", { name: "Solicitar cotización" }).click();
  const privateLink = customer.locator("#solicitud a");
  await privateLink.waitFor();
  const privatePath = await privateLink.getAttribute("href");
  assert.match(privatePath, /^\/seguimiento\/[a-f0-9]{64}$/);
  console.log(
    "Comprobado: catálogo móvil, carrito unificado y solicitud con enlace privado.",
  );
  await openModule(page, "Cotizaciones", "Listas escolares");
  await page
    .getByRole("row")
    .filter({ hasText: clientName })
    .getByRole("button", { name: "Revisar" })
    .click();
  await page.getByRole("button", { name: "Preparar propuesta" }).click();
  await page.getByLabel("Buscar producto para agregar").fill("DEMO-01");
  await page
    .locator(`.suggestions button[data-product-id="${product.id}"]`)
    .click();
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByLabel("Buscar producto para agregar").fill("DEMO-02");
  await page
    .locator(".suggestions button")
    .filter({ hasText: "[DEMO] Lápiz escolar" })
    .waitFor();
  const alternatives = await page.evaluate(async () =>
    (await fetch("/api/productos?q=DEMO-02")).json(),
  );
  await page.locator(".proposal-options summary").click();
  await page
    .getByLabel("Agregar alternativa (usa la búsqueda superior)")
    .selectOption(String(alternatives[0].id));
  await page
    .getByLabel("Alternativa elegida para la propuesta")
    .selectOption(String(product.id));
  await page
    .getByLabel("Vigente hasta (hora de Lima, fin del día)")
    .fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  await page
    .getByRole("button", { name: "Enviar propuesta", exact: true })
    .click();
  await page
    .locator(".alert-success")
    .filter({ hasText: "Propuesta enviada" })
    .waitFor();
  await customer.goto(privatePath);
  await customer.getByRole("button", { name: "Aceptar propuesta" }).click();
  await customer
    .locator(".alert-success")
    .filter({ hasText: "Propuesta aceptada" })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Crear pedido para recoger" }).click();
  await page
    .locator(".alert-success")
    .filter({ hasText: "Pedido de preparación creado" })
    .waitFor();
  await openModule(page, "Pedidos", "Listas escolares");
  const orderRow = page.getByRole("row").filter({ hasText: clientName });
  await orderRow.getByRole("button",{name:"Abrir",exact:true}).click();
  let order=page.getByRole("dialog");
  await order.getByRole("button",{name:"Preparar pedido",exact:true}).click();await order.locator(".status-preparando").waitFor();
  await order.getByRole("button",{name:"Marcar listo",exact:true}).click();await order.locator(".status-listo").waitFor();
  assert.ok(await order.getByRole("button",{name:"Entregar pedido",exact:true}).isDisabled());
  await order.getByRole("button",{name:"Registrar pago",exact:true}).click();await order.getByLabel("Efectivo recibido del pedido (S/)").fill("50.00");await order.getByRole("checkbox").check();await order.getByRole("button",{name:"Confirmar pago del pedido",exact:true}).click();await order.getByRole("link",{name:/^Ver venta #/}).click();await page.getByRole("heading",{name:/^Venta #/}).waitFor();
  const saleUrl = page.url();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  await (await download).saveAs(resolve(artifacts, "comprobante-demo.pdf"));
  assert.equal(
    readFileSync(resolve(artifacts, "comprobante-demo.pdf"))
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  const current = await page.evaluate(async () =>
    (await fetch("/api/productos?q=DEMO-01")).json(),
  );
  assert.equal(current[0].stock, product.stock - 2);
  await page.screenshot({
    path: resolve(artifacts, "comprobante.png"),
    fullPage: true,
  });
  await openModule(page, "Pedidos", "Listas escolares");
  await page.getByRole("row").filter({hasText:clientName}).getByRole("button",{name:"Abrir",exact:true}).click();order=page.getByRole("dialog");await order.getByRole("button",{name:"Entregar pedido",exact:true}).click();await order.locator(".status-entregado").waitFor();await order.getByRole("button",{name:"Volver a pedidos",exact:true}).click();
  await customer.reload();
  await customer.getByText("entregado", { exact: true }).waitFor();
  console.log(
    "Comprobado: propuesta, aceptación, pedido, pago, descuento de stock y entrega.",
  );
  await openModule(page, "Reportes", "Gestión");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar CSV" }).click();
  await (await csvDownload).saveAs(resolve(artifacts, "reporte-demo.csv"));
  assert.ok(
    readFileSync(resolve(artifacts, "reporte-demo.csv"), "utf8").includes(
      "total",
    ),
  );
  await page.getByRole("link", { name: "Inicio", exact: true }).click();
  await page
    .getByRole("heading", { name: "Tu librería, de un vistazo" })
    .waitFor();
  await page.locator(".metric strong").first().waitFor();
  await page.screenshot({
    path: resolve(artifacts, "panel.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log("Comprobado: PDF, CSV, comprobante histórico y panel.");
  console.log(
    "Demostración verificada en Firefox. Artefactos en backend/data/presentacion.",
  );
  console.log("Venta de demostración: " + saleUrl);
  await buyer.close();
  await context.close();
} catch (error) {
  const safe = String(error.stack || error)
    .replaceAll(password, "[oculta]")
    .replace(/\/seguimiento\/[a-f0-9]{64}/g, "/seguimiento/[privado]");
  console.error(safe);
  process.exitCode = 1;
} finally {
  await browser.close();
}
