import { test, expect } from "@playwright/test";
import { jsPDF } from "jspdf";

test("PDF con texto compara inventario, separa stock parcial y permite corregir sin duplicar", async ({ page }) => {
  await page.goto("/catalogo");
  const pdf = new jsPDF();
  pdf.text(["LISTA ESCOLAR", "7 Cuadernos", "2 Compases metalicos"], 20, 30);
  await page.getByLabel("Subir lista escolar").setInputFiles({ name: "lista.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf.output("arraybuffer")) });
  await expect(page.locator(".list-match-report")).toBeVisible({timeout:30000});
  await expect(page.getByRole("region", {name:"Útiles disponibles"})).toContainText("5 × Cuaderno");
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("2 × Cuaderno");
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).toContainText("2 × Compases metalicos");
  await page.getByLabel("Lista de útiles", {exact:true}).fill("2 Cuadernos\n1 Compás");
  await page.getByRole("button", {name:"Revisar mi lista",exact:true}).click();
  await expect(page.getByLabel("Cantidad Cuaderno",{exact:true})).toHaveValue("2");
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expect(page.getByRole("region", {name:"Útiles faltantes"})).not.toContainText("Cuaderno");
});

test("foto y PDF escaneado se leen con OCR local, sin servicios externos", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/catalogo");
  const image = await page.evaluate(() => {
    const canvas=document.createElement("canvas"); canvas.width=1200;canvas.height=500;
    const context=canvas.getContext("2d")!;
    context.fillStyle="#fff";context.fillRect(0,0,1200,500);context.fillStyle="#000";context.font="40px Arial";
    context.fillText("LISTA ESCOLAR",60,90);context.fillText("2 Cuadernos",60,180);context.fillText("1 Compas metalico",60,270);
    return canvas.toDataURL("image/png");
  });
  const external: string[]=[];
  page.on("request", request => {if (/^https?:/.test(request.url()) && new URL(request.url()).origin!==new URL(page.url()).origin) external.push(request.url());});
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"foto.png",mimeType:"image/png",buffer:Buffer.from(image.split(",")[1],"base64")});
  await expect(page.locator(".list-match-report")).toBeVisible({timeout:55000});
  await expect(page.getByLabel("Cantidad Cuaderno",{exact:true})).toHaveValue("2");
  await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText(/Comp[aá]s/i);
  const pdf=new jsPDF();pdf.addImage(image,"PNG",10,10,190,80);
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"escaneo.pdf",mimeType:"application/pdf",buffer:Buffer.from(pdf.output("arraybuffer"))});
  await expect(page.locator(".list-match-report")).toBeVisible({timeout:55000});
  await expect(page.getByLabel("Lista de útiles",{exact:true})).toHaveValue(/Cuadernos/i);
  await expect(page.getByLabel("Cantidad Cuaderno",{exact:true})).toHaveValue("2");
  expect(external).toEqual([]);
});

test("compara todas las páginas y deja marcas ambiguas por revisar", async ({ page }) => {
  const product = { id:1,codigo:"R1",nombre:"Regla 20 cm",marca:"Artesco",stock:4,precio:200,activo:1 };
  await page.route("**/api/publico/productos**", route => {
    const url=new URL(route.request().url());
    if (!url.searchParams.has("pagina")) return route.continue();
    const pageNumber=Number(url.searchParams.get("pagina"));
    const first=Array.from({length:30},(_,i)=>({...product,id:i+10,codigo:`X${i}`,nombre:`Otro artículo ${i}`}));
    return route.fulfill({json:pageNumber===1 ? first : [product,{...product,id:2,codigo:"R2",marca:"Pilot"},{...product,id:3,codigo:"T1",nombre:"Tijera",stock:0}]});
  });
  await page.goto("/catalogo");
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"tabla.txt",mimeType:"text/plain",buffer:Buffer.from("Cantidad; Descripción\n2 Regla 20 cm Artesco\n1 Regla 20 cm\n1 Compás\n1 Tijera")});
  await expect(page.locator(".list-match-report")).toBeVisible();
  await expect(page.getByRole("region",{name:"Útiles disponibles"})).toContainText("2 × Regla 20 cm");
  await expect(page.getByRole("region",{name:"Útiles por revisar"})).toContainText("Hay varias opciones");
  await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText("1 × Compás");
  await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText("1 × Tijera");
  await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText("Sin stock actualmente");
});

test("PDF dañado muestra un error y permite comparar texto manualmente", async ({ page }) => {
  await page.goto("/catalogo");
  await page.getByLabel("Subir lista escolar").setInputFiles({name:"roto.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7 invalid")});
  await expect(page.getByRole("alert")).toContainText("No se completó la comparación");
  await page.getByText("Pegar o corregir mi lista",{exact:true}).click();
  await page.getByLabel("Lista de útiles",{exact:true}).fill("1 Cuaderno");
  await page.getByRole("button",{name:"Revisar mi lista",exact:true}).click();
  await expect(page.getByLabel("Cantidad Cuaderno",{exact:true})).toHaveValue("1");
});
