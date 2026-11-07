// Revisión visual de las listas de ejemplo; no guarda propuestas ni registra ventas.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'frontend/package.json'));
if(existsSync('/tmp/utilventa-browsers'))process.env.PLAYWRIGHT_BROWSERS_PATH||='/tmp/utilventa-browsers';
const {firefox}=require('playwright');
const state=JSON.parse(readFileSync(resolve(root,'backend/data/presentacion-servicios.json'),'utf8'));
const access=readFileSync(resolve(root,'backend/data/ACCESO_PRESENTACION.txt'),'utf8');
const links=JSON.parse(readFileSync(resolve(root,'backend/data/exposicion/EJEMPLOS_REVISION.json'),'utf8'));
const browser=await firefox.launch();
try{
 const context=await browser.newContext({baseURL:state.url,viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Usuario',{exact:true}).fill(access.match(/^Usuario: (.+)$/m)[1]);await page.getByLabel('Contraseña',{exact:true}).fill(access.match(/^Contraseña: (.+)$/m)[1]);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/app');
 await page.goto('/app/cotizaciones');await page.getByLabel('Buscar por nombre').fill(links[0].nombre);await page.getByRole('button',{name:'Revisar',exact:true}).click();
 await page.getByRole('button',{name:'Preparar propuesta',exact:true}).click();
 const rows=page.locator('.proposal-line');assert.equal(await rows.count(),4);
 assert.equal(await page.locator('.proposal-options[open]').count(),0);
 const overview=await page.locator('.quote-review-overview>.panel').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));assert.ok(Math.max(...overview)-Math.min(...overview)<3,'Resumen sin alinear');
 const box=await rows.first().boundingBox();assert.ok(box.height<190,`Fila demasiado alta: ${box.height}`);
 const fields=await rows.first().locator(':scope > .form-grid .form-control, :scope > .form-grid .form-select').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
 assert.equal(fields.length,3);assert.ok(Math.max(...fields)-Math.min(...fields)<3,'Los campos principales no están alineados');
 const initialTotal=await page.locator('.proposal-total').innerText();
 await rows.first().getByLabel('Cantidad',{exact:true}).fill('4');assert.notEqual(await page.locator('.proposal-total').innerText(),initialTotal);
 await rows.first().getByLabel('Cantidad',{exact:true}).fill('3');assert.equal(await page.locator('.proposal-total').innerText(),initialTotal);
 await page.screenshot({path:resolve(root,'backend/data/exposicion/revision-compacta.png'),fullPage:true});
 await rows.first().locator('.proposal-options summary').click();assert.ok(await rows.first().getByLabel('Agregar alternativa (usa la búsqueda superior)').isVisible());
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desbordamiento en móvil');
 await page.screenshot({path:resolve(root,'backend/data/exposicion/revision-compacta-movil.png'),fullPage:true});
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('Revisión compacta: campos alineados, alternativas desplegables y móvil sin desbordamiento.');
 await context.close();
}finally{await browser.close();}
