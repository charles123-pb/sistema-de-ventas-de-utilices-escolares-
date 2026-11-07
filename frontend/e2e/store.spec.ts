import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openModule(
  page: import("@playwright/test").Page,
  name: string,
  group: string,
) {
  const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await menu.isVisible()) await menu.click();
  const link = page.getByRole("link", { name, exact: true });
  if (!(await link.isVisible())) {
    await page.getByRole("button", { name: group, exact: true }).click();
  }
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new URL(href!, page.url()).href);
  const titles: Record<string,string> = { Pedidos: "Pedidos para recoger", Cotizaciones: "Listas y cotizaciones" };
  const title = titles[name] || name;
  await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
}

// Credenciales exclusivas del fixture temporal de go test, nunca del servidor real.
async function login(
  page: import("@playwright/test").Page,
  role = "administrador",
) {
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill(role);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("prueba-segura-123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu librería, de un vistazo" }),
  ).toBeVisible();
}

test("productos, solicitud, alternativas, aceptación, pedido, cobro y documentos", async ({
  page,
  browser,
}) => {
  await login(page);
  await openModule(page, "Productos", "Inventario");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.getByLabel("Código", { exact: true }).fill("E2E-01");
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("[PRUEBA] Cuaderno alternativo");
  await page.getByLabel("Precio de venta (S/)").fill("6.00");
  await page.getByLabel("Costo unitario (S/)").fill("3.00");
  await page.getByLabel("Stock inicial").fill("10");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.locator(".alert-success[role=status]")).toContainText(
    "Producto guardado",
  );
  const buyer = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  const customer = await buyer.newPage();
  await customer.goto("/catalogo");
  await customer.getByLabel("Buscar", { exact: true }).fill("E2E-01");
  await expect(customer.locator(".product-card")).toHaveCount(1);
  await customer.getByRole("button", { name: "Agregar a mi lista" }).click();
  await customer.getByRole("button", { name: "Agregar a mi lista" }).click();
  await expect(customer.locator("#carrito .cart-line")).toHaveCount(1);
  await customer.getByLabel("Tu nombre").fill("[PRUEBA] Familia escolar");
  await customer.getByLabel("Teléfono", { exact: true }).fill("999123456");
  await customer.getByRole("button", { name: "Solicitar cotización" }).click();
  const tracking = customer.locator("#solicitud a");
  await expect(tracking).toBeVisible();
  const privatePath = await tracking.getAttribute("href");
  expect(privatePath).toMatch(/^\/seguimiento\/[a-f0-9]{64}$/);
  await openModule(page, "Cotizaciones", "Listas escolares");
  await page
    .getByRole("row")
    .filter({ hasText: "[PRUEBA] Familia escolar" })
    .getByRole("button", { name: "Revisar" })
    .click();
  await page.getByRole("button", { name: "Preparar propuesta" }).click();
  await expect(page.locator(".proposal-line")).toHaveCount(1);
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByLabel("Buscar producto para agregar").fill("P1");
  await expect(page.locator(".suggestions button")).toHaveCount(1);
  await page.locator(".proposal-options summary").click();
  await page
    .getByLabel("Agregar alternativa (usa la búsqueda superior)")
    .selectOption("1");
  await page
    .getByLabel("Alternativa elegida para la propuesta")
    .selectOption("1");
  const expires = new Date(Date.now() + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  await page
    .getByLabel("Vigente hasta (hora de Lima, fin del día)")
    .fill(expires);
  await page
    .getByRole("button", { name: "Enviar propuesta", exact: true })
    .click();
  await expect(page.locator(".alert-success[role=status]")).toContainText(
    "Propuesta enviada",
  );
  await customer.goto(privatePath!);
  await expect(customer.locator(".document")).toContainText(
    "Elegida: Cuaderno",
  );
  await expect(customer.locator(".document")).toContainText(
    "Opción: [PRUEBA] Cuaderno alternativo",
  );
  await customer.getByRole("button", { name: "Aceptar propuesta" }).click();
  await expect(customer.locator(".alert-success[role=status]")).toContainText(
    "Propuesta aceptada",
  );
  await page.reload();
  await page.getByRole("button", { name: "Crear pedido para recoger" }).click();
  await expect(page.locator(".alert-success[role=status]")).toContainText(
    "Pedido de preparación creado",
  );
  await openModule(page, "Pedidos", "Listas escolares");
  await page.getByRole('row').filter({hasText:'[PRUEBA] Familia escolar'}).getByRole('button',{name:'Abrir',exact:true}).click();
  let order=page.getByRole('dialog',{name:'Pedido #1',exact:true});
  await order.getByRole('button',{name:'Preparar pedido',exact:true}).click();await expect(order.locator('.status-preparando')).toBeVisible();
  await order.getByRole('button',{name:'Marcar listo',exact:true}).click();await expect(order.locator('.status-listo')).toBeVisible();
  await expect(order.getByRole('button',{name:'Entregar pedido',exact:true})).toBeDisabled();
  await customer.reload();await expect(customer.getByText('listo',{exact:true})).toBeVisible();
  await order.getByRole('button',{name:'Registrar pago',exact:true}).click();await order.getByLabel('Efectivo recibido del pedido (S/)').fill('20.00');await order.getByRole('checkbox',{name:'Confirmo que cobré el efectivo o verifiqué el abono en la cuenta de la tienda.'}).check();await order.getByRole('button',{name:'Confirmar pago del pedido',exact:true}).click();await expect(order).toContainText('Pago registrado');
  await order.getByRole('link',{name:'Ver venta #1',exact:true}).click();
  await expect(
    page.getByRole("heading", { name: "Venta #1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".document")).toContainText("S/ 7.00");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const document = await download;
  const path = await document.path();
  expect((await readFile(path!)).subarray(0, 4).toString()).toBe("%PDF");
  const products = await (await page.request.get("/api/productos?q=P1")).json();
  expect(products[0].stock).toBe(3);
  await openModule(page, "Pedidos", "Listas escolares");
  await page.getByRole('row').filter({hasText:'[PRUEBA] Familia escolar'}).getByRole('button',{name:'Abrir',exact:true}).click();order=page.getByRole('dialog',{name:'Pedido #1',exact:true});await order.getByRole('button',{name:'Entregar pedido',exact:true}).click();await expect(order.locator('.status-entregado')).toBeVisible();await order.getByRole('button',{name:'Volver a pedidos',exact:true}).click();
  await customer.reload();
  await expect(customer.getByText("entregado", { exact: true })).toBeVisible();
  await customer.goto("/catalogo");
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await openModule(page, "Reportes", "Gestión");
  const csvEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar CSV" }).click();
  const csv = await csvEvent;
  expect(await readFile((await csv.path())!, "utf8")).toContain("total");
  await buyer.close();
});

test("vendedor sin costos ni acceso a inventario", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "vendedor");
  await openModule(page, "Productos", "Inventario");
  await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Control de inventario", exact: true }),
  ).toHaveCount(0);
  const response = await page.request.get("/api/movimientos");
  expect(response.status()).toBe(403);
  const products = await (await page.request.get("/api/productos")).json();
  expect(products.length).toBeGreaterThan(0);
  expect(products[0]).not.toHaveProperty("costo");
  await page.getByRole("button", { name: "Gestión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inventario", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
});

test("lista adjunta, cantidades disponibles, faltantes y revisión privada", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/catalogo");
  await expect(page.locator(".example-grid")).toHaveCount(0);
  await page.getByLabel("Subir lista escolar").setInputFiles("public/productos/art-pr02093.jpg");
  await expect(page.getByAltText("Vista previa de la lista escolar")).toBeVisible();
  await page.getByRole("button", {name:"Quitar archivo",exact:true}).click();
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"lista-primaria.txt",mimeType:"text/plain",buffer:Buffer.from("7 Cuaderno\n2 compases metálicos")});
  await expect(page.getByLabel("Lista de útiles", {exact:true})).toHaveValue(/7 Cuaderno/);
  await expect(page.locator(".list-match-report")).toBeVisible();
  await page.getByLabel("Buscar", {exact:true}).fill("P1");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByLabel("Cantidad Cuaderno", {exact:true}).fill("7");
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("4 × Cuaderno");

  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("2 × compases metálicos");
  await page.getByLabel("Tu nombre").fill("[PRUEBA] Lista adjunta");
  await page.getByLabel("Teléfono", {exact:true}).fill("999000123");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("button", {name:"Solicitar cotización",exact:true}).click();
  await expect(page.getByRole("heading", {name:"Solicitud recibida",exact:true})).toBeVisible();
  const privatePath = await page.locator(".request-success a").getAttribute("href");
  await page.goto(privatePath!);
  await expect(page.getByRole("region", {name:"Faltantes en la cotización"})).toContainText("4 × Cuaderno");
  await expect(page.getByRole("region", {name:"Faltantes en la cotización"})).toContainText("2 × compases metálicos");
  const downloadEvent=page.waitForEvent("download");
  await page.getByRole("link", {name:"Descargar lista",exact:true}).click();
  const download=await downloadEvent;
  expect(await readFile((await download.path())!,"utf8")).toContain("7 Cuaderno");
  await page.screenshot({path:"test-results/lista-adjunta-movil.png",fullPage:true});
  const staffContext=await browser.newContext({baseURL:new URL(page.url()).origin});
  const staff=await staffContext.newPage();
  await login(staff);
  await openModule(staff,"Cotizaciones","Listas escolares");
  await staff.getByRole("row").filter({hasText:"[PRUEBA] Lista adjunta"}).getByRole("button",{name:"Revisar"}).click();
  await expect(staff.getByRole("link",{name:"Descargar lista",exact:true})).toBeVisible();
  await staff.getByRole("button",{name:"Preparar propuesta",exact:true}).click();
  await expect(staff.locator(".proposal-line")).toHaveCount(3);
  await expect(staff.getByLabel("Artículo solicitado",{exact:true}).last()).toHaveValue("compases metálicos");
  await staffContext.close();
});

test("proveedores, marcas y entrada de mercadería en Huamanga", async ({ page, browser }) => {
  await login(page);
  await openModule(page, "Proveedores", "Inventario");
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  await page.getByLabel("Empresa / razón social").fill("[PRUEBA] Distribuidora Huamanga");
  await page.getByLabel("Persona de contacto").fill("Contacto de prueba");
  await page.getByLabel("Marcas que maneja (separadas por comas)").fill("Trazo prueba, Aula prueba");
  await expect(page.getByLabel("Ciudad", { exact: true })).toHaveValue("Huamanga");
  await page.getByRole("button", { name: "Guardar proveedor" }).click();
  await expect(page.locator(".alert-success[role=status]")).toContainText("Proveedor guardado");
  await page.getByLabel("Buscar proveedor").fill("Aula prueba");
  await expect(page.locator(".supplier-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".supplier-table")).toContainText("Trazo prueba");
  await page.screenshot({ path: "test-results/proveedores-escritorio.png", fullPage: true });
  await openModule(page, "Productos", "Inventario");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await page.getByLabel("Código", { exact: true }).fill("SUPPLY-01");
  await page.getByLabel("Nombre", { exact: true }).fill("[PRUEBA] Lápiz abastecido");
  await page.getByLabel("Marca (opcional)").fill("Trazo prueba");
  await page.getByLabel("Proveedor principal (opcional)").selectOption({ label: "[PRUEBA] Distribuidora Huamanga" });
  await page.getByLabel("Precio de venta (S/)").fill("2.00");
  await page.getByLabel("Costo unitario (S/)").fill("1.00");
  await page.getByLabel("Stock inicial").fill("2");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.locator(".alert-success[role=status]")).toContainText("Producto guardado");
  await page.getByLabel("Buscar producto", { exact: true }).fill("Trazo prueba");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Distribuidora Huamanga");
  await page.getByRole("button", {name:"Registrar entrada",exact:true}).click();
  const entry=page.getByRole("dialog",{name:"Registrar entrada",exact:true});
  await entry.getByLabel("Proveedor de la entrada (opcional)").selectOption({ label: "[PRUEBA] Distribuidora Huamanga" });
  await entry.getByLabel("Comprobante de compra (opcional)").fill("F001-123");
  await entry.getByLabel("Cantidad de entrada").fill("5");
  await entry.getByLabel("Costo unitario entrada (S/)").fill("1.20");
  await entry.getByLabel("Motivo obligatorio").fill("Compra de prueba");
  await entry.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(entry).toHaveCount(0);
  await expect(page.locator(".alert-success[role=status]")).toContainText("Entrada registrada");
  await page.getByRole("link",{name:"Ver movimientos",exact:true}).click();
  await expect(page.locator("tbody tr").first()).toContainText("F001-123");
  await expect(page.locator(".stock-selected-product")).toContainText("Stock: 7");
  const customerContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
  const customer = await customerContext.newPage();
  await customer.goto("/catalogo");
  await customer.getByLabel("Buscar", { exact: true }).fill("Trazo prueba");
  await expect(customer.locator(".product-card")).toHaveCount(1);
  await customer.getByLabel("Marca", { exact: true }).selectOption("Trazo prueba");
  await expect(customer.locator(".product-brand")).toHaveText("Trazo prueba");
  await customer.getByLabel("Categoría", { exact: true }).selectOption({ label: "Oficina" });
  await expect(customer.locator(".product-card")).toHaveCount(0);
  await customer.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(customer.getByLabel("Marca", { exact: true })).toHaveValue("");
  await expect(customer.getByLabel("Buscar", { exact: true })).toHaveValue("");
  await expect(customer.locator(".product-card").first()).toBeVisible();
  expect(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await customer.screenshot({ path: "test-results/catalogo-marcas-movil.png", fullPage: true });
  await customerContext.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await openModule(page, "Proveedores", "Inventario");
  await expect(page.getByRole("heading", { name: "Proveedores", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "test-results/proveedores-movil.png", fullPage: true });
});

test("importar renglones y completar un faltante con un producto del catálogo", async ({page}) => {
  await page.goto("/catalogo");
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"lista.txt",mimeType:"text/plain",buffer:Buffer.from("2 Libreta especial\n1 Compás")});
  await expect(page.locator(".list-match-report")).toBeVisible();
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("2 × Libreta especial");
  await page.getByRole("button", {name:"Buscar Libreta especial en catálogo",exact:true}).click();
  await expect(page.locator(".matching-banner")).toContainText("2 × Libreta especial");
  await page.getByLabel("Buscar", {exact:true}).fill("P1");
  const card=page.locator(".product-card").filter({has:page.getByRole("heading", {name:"Cuaderno",exact:true})});
  await card.getByRole("button", {name:"Usar para este útil",exact:true}).click();
  await expect(page.getByLabel("Cantidad Cuaderno", {exact:true})).toHaveValue("2");
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("1 × Compás");
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).not.toContainText("Libreta especial");
  await expect(page.locator(".matching-banner")).toHaveCount(0);
  await page.screenshot({path:"test-results/catalogo-cotizacion-compacta.png",fullPage:true});
});
