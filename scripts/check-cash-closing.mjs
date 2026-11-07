// Read-only check of the integrated closing window against the local store.
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
assert.ok(['localhost','127.0.0.1'].includes(new URL(state.url).hostname));
const access=readFileSync(resolve(root,'backend/data/ACCESO_PRESENTACION.txt'),'utf8');
const browser=await firefox.launch();
try {
 const context=await browser.newContext({baseURL:state.url,viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Usuario',{exact:true}).fill(access.match(/^Usuario: (.+)$/m)[1]);await page.getByLabel('Contraseña',{exact:true}).fill(access.match(/^Contraseña: (.+)$/m)[1]);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/app');
 const response=await context.request.get('/api/caja/estado');assert.ok(response.ok());const status=await response.json();assert.deepEqual(Object.keys(status).sort(),['cerrada','dia']);
 await page.goto('/app/caja');await page.waitForFunction(()=>document.querySelector('.cash-register-state strong'));
 assert.ok((await page.locator('.cash-register-state').innerText()).includes(status.cerrada?'Caja cerrada':'Caja abierta'));
 assert.equal(await page.locator('.sidebar').getByRole('link',{name:'Cierre de caja',exact:true}).count(),0);
 await page.getByRole('button',{name:'Cierre de caja',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Cierre de caja',exact:true});await dialog.getByLabel('Día de caja').waitFor();await page.waitForFunction(()=>!!document.querySelector('.cash-closing-dialog .operation-metrics'));
 await page.screenshot({path:resolve(root,'backend/data/exposicion/cierre-integrado-real.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth));await page.screenshot({path:resolve(root,'backend/data/exposicion/cierre-integrado-real-movil.png'),fullPage:true});
 await dialog.getByRole('button',{name:'Volver a venta',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await dialog.count(),0);assert.equal(new URL(page.url()).pathname,'/app/caja');assert.deepEqual(errors,[]);
 console.log('Caja local actualizada: estado disponible, cierre integrado y móvil correcto. Sin cierres, ventas ni reaperturas de prueba.');
 await context.close();
} finally {await browser.close();}
