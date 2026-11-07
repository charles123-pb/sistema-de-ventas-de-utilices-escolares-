import {test,expect,type Page} from "@playwright/test";
import {jsPDF} from "jspdf";

async function prepare(page:Page){
 await page.goto("/login");await page.getByLabel("Usuario",{exact:true}).fill("administrador");await page.getByLabel("Contraseña",{exact:true}).fill("prueba-segura-123");await page.getByRole("button",{name:"Iniciar sesión"}).click();await expect(page.getByRole("heading",{name:"Tu librería, de un vistazo"})).toBeVisible();
 for(const [code,name,brand] of [
  ["LANG-COL","Colores jumbo · caja x12 + 2 lápices","Faber-Castell"],
  ["LANG-LAP","Lápiz técnico 2B con borrador","Artesco"],
  ["LANG-TEM","Témperas 7 colores + pincel","Artesco"],
  ["LANG-NB","Cuaderno Cuadrimax 1x1 A4 80 hojas","Standford"],
  ["LANG-BOR","Borrador blanco escolar","Faber-Castell"],
 ]){const response=await page.request.post("/api/productos",{headers:{Origin:new URL(page.url()).origin},data:{codigo:code,nombre:name,marca:brand,categoria_id:1,costo:"1.00",precio:"2.00",stock:20,stock_minimo:1,activo:true}});expect(response.ok(),await response.text()).toBeTruthy();}
}

test("búsqueda cotidiana y cajas de colores no confunden accesorios",async({page})=>{
 await prepare(page);await page.goto("/catalogo");
 for(const [query,title] of [["cuadernos cuadriculados A4","Cuaderno Cuadrimax 1x1 A4 80 hojas"],["lapiz Artesco","Lápiz técnico 2B con borrador"],["Faber Castell","Colores jumbo · caja x12 + 2 lápices"],["caja de colores","Colores jumbo · caja x12 + 2 lápices"]]){await page.getByLabel("Buscar",{exact:true}).fill(query);await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();}
 for(const query of ["borrador Artesco","lapiz Faber Castell","pincel Artesco"]){await page.getByLabel("Buscar",{exact:true}).fill(query);await expect(page.locator(".product-card")).toHaveCount(0);}
 await page.getByLabel("Subir lista escolar").setInputFiles({name:"lista.txt",mimeType:"text/plain",buffer:Buffer.from("1 caja de colores Faber Castell de 12\n1 borrador Artesco\n1 pincel Artesco")});
 await expect(page.locator(".list-match-report")).toBeVisible();await expect(page.getByRole("region",{name:"Útiles disponibles"})).toContainText("Colores jumbo");await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText("borrador Artesco");await expect(page.getByRole("region",{name:"Útiles faltantes"})).toContainText("pincel Artesco");
});

test("PDF en tabla lee cantidades a la derecha y no convierte hojas en cantidad",async({page})=>{
 await page.goto("/catalogo");const pdf=new jsPDF();pdf.text("Producto",20,25);pdf.text("Cantidad",160,25);pdf.text("Cuaderno Cuadrimax 1x1 A4 80 hojas",20,45);pdf.text("3",160,45);pdf.text("Borrador blanco escolar",20,60);pdf.text("2",160,60);
 await page.getByLabel("Subir lista escolar").setInputFiles({name:"tabla.pdf",mimeType:"application/pdf",buffer:Buffer.from(pdf.output("arraybuffer"))});await expect(page.locator(".list-match-report")).toBeVisible();await expect(page.getByLabel("Cantidad Cuaderno Cuadrimax 1x1 A4 80 hojas",{exact:true})).toHaveValue("3");await expect(page.getByLabel("Cantidad Borrador blanco escolar",{exact:true})).toHaveValue("2");
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test("no redondea unidades a cajas sin confirmar cantidad de presentaciones",async({page})=>{
 await page.goto("/catalogo");await page.getByLabel("Subir lista escolar").setInputFiles({name:"unidades.txt",mimeType:"text/plain",buffer:Buffer.from("13 unidades de colores Faber Castell")});await expect(page.getByRole("region",{name:"Útiles por revisar"})).toBeVisible();await page.getByRole("button",{name:"Buscar colores Faber Castell en catálogo",exact:true}).click();
 const card=page.locator(".product-card").filter({has:page.getByRole("heading",{name:"Colores jumbo · caja x12 + 2 lápices",exact:true})});await expect(card.getByRole("button",{name:"Usar para este útil",exact:true})).toBeDisabled();await card.getByLabel("Cantidad de caja para Colores jumbo · caja x12 + 2 lápices",{exact:true}).fill("2");await card.getByRole("button",{name:"Usar para este útil",exact:true}).click();await expect(page.getByLabel("Cantidad Colores jumbo · caja x12 + 2 lápices",{exact:true})).toHaveValue("2");await expect(page.getByRole("region",{name:"Útiles por revisar"})).toHaveCount(0);
});
