// Read-only review of the quote inbox and both order sources on the local store.
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
 const page=await context.newPage();const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Usuario',{exact:true}).fill(access.match(/^Usuario: (.+)$/m)[1]);await page.getByLabel('Contraseña',{exact:true}).fill(access.match(/^Contraseña: (.+)$/m)[1]);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/app');
 await page.route('**/api/**',route=>{if(route.request().method()!=='GET'){writes.push(route.request().method());return route.abort();}return route.continue();});
 await page.goto('/app/cotizaciones');await page.locator('.quote-inbox tbody tr').first().waitFor();const count=await page.locator('.quote-inbox tbody tr').count();await page.screenshot({path:resolve(root,'backend/data/exposicion/cotizaciones-bandeja-compacta.png'),fullPage:true});
 await page.getByRole('button',{name:'Nueva solicitud'}).click();const create=page.getByRole('dialog',{name:'Nueva solicitud',exact:true});await create.getByLabel('Lista solicitada').waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await create.evaluate(d=>d.scrollWidth<=d.clientWidth));await page.screenshot({path:resolve(root,'backend/data/exposicion/cotizacion-ventana-real-movil.png'),fullPage:true});await create.getByRole('button',{name:'Cancelar',exact:true}).click();await create.waitFor({state:'detached'});assert.equal(await page.locator('.quote-inbox tbody tr').count(),count);
 await page.setViewportSize({width:1440,height:1000});await page.goto('/app/pedidos');await page.locator('.orders-table tbody tr').first().waitFor();assert.equal(await page.getByRole('navigation',{name:'Origen de los pedidos'}).getByRole('button').count(),2);await page.screenshot({path:resolve(root,'backend/data/exposicion/pedidos-bandeja-compacta.png'),fullPage:true});await page.locator('.orders-table tbody tr').first().getByRole('button',{name:'Abrir',exact:true}).click();const order=page.getByRole('dialog');await order.locator('.order-customer').waitFor();await page.screenshot({path:resolve(root,'backend/data/exposicion/pedido-cotizacion-compacto.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await order.evaluate(d=>d.scrollWidth<=d.clientWidth));await page.screenshot({path:resolve(root,'backend/data/exposicion/pedido-cotizacion-compacto-movil.png'),fullPage:true});await order.getByRole('button',{name:'Volver a pedidos',exact:true}).click();await order.waitFor({state:'detached'});
 await page.getByRole('button',{name:'Del catálogo',exact:true}).click();await page.getByRole('button',{name:'Del catálogo',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[role=status]'));assert.equal(await page.locator('.web-order-card').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.equal(await page.getByRole('alert').count(),0);
 console.log('Cotizaciones y pedidos compactos verificados en la tienda local, sin nuevas solicitudes, cobros ni cambios de estado.');await context.close();
} finally {await browser.close();}
