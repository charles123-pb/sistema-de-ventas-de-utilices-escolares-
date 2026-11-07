import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Buffer} from "node:buffer";
import {URL} from "node:url";
import ts from "typescript";

function moduleSource(path){return ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;}
const languageUrl="data:text/javascript;base64,"+Buffer.from(moduleSource("../src/lib/product-language.ts")).toString("base64");
const source=moduleSource("../src/lib/school-list.ts").replaceAll('"./product-language"',JSON.stringify(languageUrl));
const {parseSchoolList,matchSchoolList,quantityForProduct}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const {productFamily}=await import(languageUrl);
const catalog=JSON.parse(readFileSync(new URL("../../backend/internal/services/school_catalog.json",import.meta.url),"utf8"));
const products=catalog.productos.map((p,i)=>({...p,id:i+1,familia:productFamily(p.nombre),presentacion:["colores","crayon","plastilina"].includes(productFamily(p.nombre))?"caja":"unidad",contenido:["colores","crayon","plastilina"].includes(productFamily(p.nombre))?12:1}));
function match(text){return matchSchoolList(parseSchoolList(text),products);}

test("colores are distinct from coloured paper, paints and bonus accessories",()=>{
  const generic=match("1 colores");assert.equal(generic.cart.length,0);assert.equal(generic.missing[0].por_revisar,true);
  for(const text of ["1 caja de colores Faber Castell de 12","1 lápices de colores Faber Castell","1 lápiz de colores Faber Castell"]){const result=match(text);assert.equal(result.cart.length,1,text);assert.equal(result.cart[0].p.codigo,"FAB-L601824",text);assert.equal(result.cart[0].cantidad,1);}
  for(const text of ["1 lápiz Faber Castell","1 borrador Artesco","1 tajador Vinifan","1 pincel Artesco","1 colores Artesco"]){const result=match(text);assert.equal(result.cart.length,0,text);assert.equal(result.missing[0].por_revisar,false,text);}
});
test("plural forms and notebook types retain requested dimensions",()=>{
  assert.equal(match("2 cuadernos rayados A4").cart[0].cantidad,2);
  assert.equal(match("2 cuadernos cuadriculados A4").cart[0].p.codigo,"STD-PR14105");
  assert.equal(match("1 cuaderno de 100 hojas").cart.length,0);
  assert.equal(match("1 cuaderno cuadriculado 5mm").cart.length,0);
  assert.equal(match("1 tijeras escolares").cart[0].p.codigo,"VIN-PR10869");
});
test("quantities accept tables in either column order without treating dimensions as counts",()=>{
  assert.deepEqual(parseSchoolList("Producto\tCantidad\nCuaderno rayado A4 80 hojas\t3\nBorrador blanco\t2"),[{nombre:"Cuaderno rayado A4 80 hojas",cantidad:3},{nombre:"Borrador blanco",cantidad:2}]);
  assert.deepEqual(parseSchoolList("Cantidad;Descripción\n3;Cuaderno\n2;Borrador"),[{nombre:"Cuaderno",cantidad:3},{nombre:"Borrador",cantidad:2}]);
  assert.deepEqual(parseSchoolList("N°;Producto;Cantidad\n1;Cuaderno;3"),[{nombre:"Cuaderno",cantidad:3}]);
  assert.deepEqual(parseSchoolList("2 x Cuadernos\nCuaderno;3\n1. 4 Borradores"),[{nombre:"Cuadernos",cantidad:2},{nombre:"Cuaderno",cantidad:3},{nombre:"Borradores",cantidad:4}]);
  assert.equal(parseSchoolList("Cuaderno A4 80 hojas")[0].cantidad,1);
  assert.equal(parseSchoolList("3 lapiceros 0,7 mm")[0].cantidad,3);
});
test("negative, zero, fractional and duplicated quantities are rejected",()=>{
  for(const text of ["-2 Cuadernos","−2 Cuadernos","–2 Cuadernos","• -2 Cuadernos","0 cuadernos","1.5 cuadernos","2,5 cuadernos","Cuaderno;0","Cuaderno;-2","Cantidad;Descripción\n1.5;Cuaderno","2 cuadernos;3"]){assert.throws(()=>parseSchoolList(text),undefined,text);}
});
test("dozens and explicit units convert only to complete known presentations",()=>{
  assert.equal(match("2 docenas de lápiz técnico 2B con borrador").cart[0].cantidad,24);
  assert.equal(match("24 unidades de colores Faber Castell").cart[0].cantidad,2);
  const partial=match("13 unidades de colores Faber Castell");assert.equal(partial.cart.length,0);assert.equal(partial.missing[0].por_revisar,true);
  const box=products.find(p=>p.codigo==="FAB-L601824");assert.equal(quantityForProduct({nombre:"colores",cantidad:24,unidad:"unidad"},{...box,contenido:0}),null);
  assert.equal(match("2 cajas de colores Vinifan de 12").cart[0].cantidad,2);
  assert.equal(match("1 caja de colores Faber Castell de 24").cart.length,0);
});
test("duplicate lines accumulate and large combined quantities fail",()=>{
  assert.equal(match("2 lápiz técnico 2B\n3 lápiz técnico 2B").cart[0].cantidad,5);
  assert.throws(()=>match("1000000 lápiz técnico 2B\n1 lápiz técnico 2B"));
});
