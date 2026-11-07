// Tres listas ficticias con referencias del inventario actual. Repetible sin duplicar.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
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
const username=access.match(/^Usuario: (.+)$/m)?.[1],password=access.match(/^Contraseña: (.+)$/m)?.[1];
assert.ok(username&&password);
const browser=await firefox.launch();
try {
 const context=await browser.newContext({baseURL:state.url});
 const page=await context.newPage();
 await page.goto('/login');await page.getByLabel('Usuario',{exact:true}).fill(username);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL('**/app');
 async function api(path,method='GET',data){const r=await context.request.fetch('/api'+path,{method,data,headers:{Origin:state.url}});assert.ok(r.ok(),`${method} ${path}: ${await r.text()}`);return r.json();}
 const products=[];for(let n=1;;n++){const batch=await api(`/productos?pagina=${n}`);products.push(...batch);if(batch.length<30)break;}
 const cases=[
  {nombre:'[Ejemplo] Familia Salazar · primaria',telefono:'900000201',enviar:null,codes:['STD-PR14105','ART-PR13900','ART-PR452593','ART-PR02093'],qty:[3,2,1,1]},
  {nombre:'[Ejemplo] Familia Cárdenas · secundaria',telefono:'900000202',enviar:false,codes:['STD-548001','PIL-L111611','ART-PR02258'],qty:[4,3,1]},
  {nombre:'[Ejemplo] Taller de arte · Huamanga',telefono:'900000203',enviar:true,codes:['FAB-L601824','ART-PR02269','ART-PR02093'],qty:[1,2,2]},
 ];
 // Validate all references before the first write.
 for(const c of cases)c.lines=c.codes.map((code,i)=>{const p=products.find(p=>p.codigo===code&&p.activo);assert.ok(p&&p.stock>=c.qty[i],`Referencia no disponible: ${code}`);return {p,cantidad:c.qty[i]};});
 const linksPath=resolve(root,'backend/data/exposicion/EJEMPLOS_REVISION.json');
 const links=existsSync(linksPath)?JSON.parse(readFileSync(linksPath,'utf8')):[];
 for(const c of cases){
  const prior=await api(`/cotizaciones?q=${encodeURIComponent(c.nombre)}`);
  if(prior.length){console.log(`Conservada: ${c.nombre}`);continue;}
  const result=await api('/publico/solicitudes','POST',{nombre:c.nombre,telefono:c.telefono,lista:c.lines.map(({p,cantidad})=>`${cantidad} ${p.nombre} (${p.marca})`).join('\n'),observaciones:'Ejemplo ficticio para practicar la revisión. Sin venta ni reserva de stock.',seleccion:c.lines.map(({p,cantidad})=>({producto_id:p.id,cantidad,solicitado:p.nombre}))});
  links.push({id:result.id,nombre:c.nombre,enlace:result.enlace});
  writeFileSync(linksPath,JSON.stringify(links,null,2)+'\n',{mode:0o600});
  if(c.enviar!==null){const vigencia=new Date(Date.now()+7*86400000).toISOString().slice(0,10);await api(`/cotizaciones/${result.id}`,'PUT',{revision:1,vigencia,enviar:c.enviar,items:c.lines.map(({p,cantidad})=>({producto_id:p.id,cantidad,solicitado:p.nombre,opciones:[{producto_id:p.id}]}))});}
  console.log(`Creada #${result.id}: ${c.nombre}`);
 }
 await context.close();
}finally{await browser.close();}
