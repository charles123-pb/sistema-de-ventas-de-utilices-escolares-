import type { Product } from "../types";

export function normalized(value:string):string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
const aliases:Record<string,string>={lapices:"lapiz",colores:"color",borradores:"borrador",marcadores:"plumon",marcador:"plumon",plumones:"plumon",boligrafo:"lapicero",boligrafos:"lapicero",escolares:"escolar",compases:"compas",sacapuntas:"tajador",cuadriculado:"cuadricula",cuadriculados:"cuadricula",cuadrimax:"cuadricula",hojas:"hoja",hoj:"hoja",lapiceros:"lapicero",tijeras:"tijera",cuadernos:"cuaderno",temperas:"tempera",crayones:"crayon",cajas:"caja",paquetes:"paquete",estuches:"estuche",juegos:"juego",unidades:"unidad",unds:"unidad",und:"unidad",uds:"unidad",ud:"unidad",frascos:"frasco",rollos:"rollo",resmas:"resma",blocs:"block",bloc:"block",blocks:"block",triangulares:"triangular",micas:"mica",pinceles:"pincel",cartulinas:"cartulina",reglas:"regla"};
export function productTokens(value:string):string[]{
  return (normalized(value).replace(/\bx\s*(\d+)/g,"$1").replace(/×\s*(\d+)/g,"$1").match(/[a-z0-9]+(?:[.,][0-9]+)?/g)||[]).map(w=>(aliases[w]||(["compas","portaminas"].includes(w)?w:w.length>3&&w.endsWith("s")&&!w.endsWith("is")?w.slice(0,-1):w)).replace(",",".")).filter(w=>!["de","del","la","el","los","las","con","para","en","y","un","una","x"].includes(w));
}
export function productFamily(value:string):string {
  const s=normalized(value).replace(/\b(?:lapices|lapiz)\s+de\s+color(?:es)?\b/g,"colores");
  for(const word of productTokens(s)){
    if(word==="color")return "colores";
    if(["cuaderno","lapiz","lapicero","borrador","tajador","pincel","tempera","crayon","plumon","tijera","regla","plastilina","silicona","resaltador","portaminas","limpiatipo","cartulina","papel","forro","mica","archivador","perforador","block"].includes(word))return word;
    if(["pegamento","cola"].includes(word))return "pegamento";
    if(word==="goma")return s.includes("borrar")?"borrador":"pegamento";
    if(word==="geometrico")return "geometria";
  }
  return "";
}
export const packagingUnits=["unidad","caja","paquete","estuche","juego","frasco","rollo","resma"] as const;
export type PackagingUnit=typeof packagingUnits[number];
export function presentationOf(p:Pick<Product,"presentacion"|"contenido">){return {unidad:p.presentacion||"unidad",contenido:p.contenido??1};}
export function presentationLabel(p:Pick<Product,"presentacion"|"contenido">):string {
  const {unidad,contenido}=presentationOf(p);
  return unidad==="unidad"?"Por unidad":`${unidad[0].toUpperCase()+unidad.slice(1)}${contenido>1?` · ${contenido} unidades`:contenido===0?" · contenido por confirmar":""}`;
}
