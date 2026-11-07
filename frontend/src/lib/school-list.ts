import type { Product } from "../types";
import { normalized, productFamily, productTokens, packagingUnits, presentationOf, presentationLabel } from "./product-language";
export { normalized } from "./product-language";

export type RequestedLine = { nombre: string; cantidad: number; unidad?: string };
export type UnmatchedLine = RequestedLine & { motivo?: string; por_revisar?: boolean };
const quantityWords:Record<string,number>={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20};
const unitNames:Record<string,string>={unidades:"unidad",unidad:"unidad",und:"unidad",unds:"unidad",ud:"unidad",uds:"unidad",caja:"caja",cajas:"caja",paquete:"paquete",paquetes:"paquete",estuche:"estuche",estuches:"estuche",juego:"juego",juegos:"juego",docena:"docena",docenas:"docena",frasco:"frasco",frascos:"frasco",rollo:"rollo",rollos:"rollo",resma:"resma",resmas:"resma"};
const invalidQuantity="Revisa las cantidades: deben ser enteros positivos. Usa, por ejemplo, 2 cuadernos o Cuaderno;2.";

export function parseSchoolList(text: string): RequestedLine[] {
  if(text.length>10000)throw new Error("La lista admite hasta 10 000 caracteres. Divide el archivo en listas más pequeñas.");
  const parsed:RequestedLine[]=[];
  let table:{name:number;quantity:number}|null=null;
  for(const raw of text.split(/\r?\n/)){
    let line=raw.trim();
    if(!line)continue;
    if(/^[-−–—+]\d/.test(line)||/^\d+[.,]\d+/.test(line)||/^\d+\s*\/\s*\d+/.test(line))throw new Error(invalidQuantity);
    line=line.replace(/^[•*–—]\s*/,"").replace(/^-\s+/,"").replace(/^\d+[.)]\s+/,"").trim();
    if(/^[-−–—+]\d/.test(line)||/^\d+[.,]\d+/.test(line))throw new Error(invalidQuantity);
    const cells=line.split(/[;|\t]/).map(c=>c.trim().replace(/^"|"$/g,""));
    const labels=cells.map(c=>normalized(c).replace(/[.:]/g,""));
    const quantityIndex=labels.findIndex(c=>/^(cantidad|cant|qty)$/.test(c));
    const nameIndex=labels.findIndex(c=>/^(producto|descripcion|articulo|util|material)$/.test(c));
    if(cells.length>1&&quantityIndex>=0&&nameIndex>=0){table={name:nameIndex,quantity:quantityIndex};continue;}
    if(/^(lista(?:do)?\b|utiles escolares\b|cantidad\b|cant\b|descripcion\b|producto\b|materiales\b|colegio\b|institucion\b|grado\b|nivel\b|nombre\s*:|pagina\b|observaciones\b)/.test(normalized(line)))continue;
    let name=line,amount=1,hasQuantity=false;
    if(table&&cells.length>1){
      if(cells[table.name]===undefined||!/^\d+$/.test(cells[table.quantity]||""))throw new Error("Revisa las columnas Producto y Cantidad de la tabla.");
      name=cells[table.name];amount=Number(cells[table.quantity]);hasQuantity=true;
    }else if(cells.length>1){
      const first=cells[0],last=cells[cells.length-1];
      if(/^[-−+]?\d+(?:[.,]\d+)?$/.test(first)&&!/^\d+$/.test(first)||/^[-−+]?\d+(?:[.,]\d+)?$/.test(last)&&!/^\d+$/.test(last))throw new Error(invalidQuantity);
      if(/^\d+$/.test(first)){amount=Number(first);name=cells.slice(1).join(" ");hasQuantity=true;}
      else if(/^\d+$/.test(last)){amount=Number(last);name=cells.slice(0,-1).join(" ");hasQuantity=true;}
      else name=cells.join(" ");
      if(hasQuantity&&/^\d+\s/.test(name))throw new Error("La línea tiene dos cantidades. Usa una sola columna de cantidad.");
    }
    if(!hasQuantity){
      const match=name.match(/^(\d+)\s*(?:[x×:]\s*|\s+)(.+)$/i);
      if(match){amount=Number(match[1]);name=match[2];hasQuantity=true;}
      else {const word=name.match(/^([a-záéíóúñ]+)\s+(.+)$/i);if(word&&quantityWords[normalized(word[1])]){amount=quantityWords[normalized(word[1])];name=word[2];hasQuantity=true;}}
    }
    let unit:string|undefined;
    const leadingUnit=name.match(/^([a-z]+)\.?\s+(?:de\s+)?(.+)$/i);
    if(leadingUnit&&unitNames[normalized(leadingUnit[1])]){unit=unitNames[normalized(leadingUnit[1])];name=leadingUnit[2];}
    name=name.trim();
    if(!/[a-záéíóúñ]/i.test(name))continue;
    if(!name||name.length>150||!Number.isSafeInteger(amount)||amount<1||amount>1000000)throw new Error(invalidQuantity);
    parsed.push({nombre:name,cantidad:amount,...(unit?{unidad:unit}:{})});
  }
  if(parsed.length>100)throw new Error("La lista admite hasta 100 artículos. Divide el archivo en listas más pequeñas.");
  if(!parsed.length)throw new Error("No encontramos útiles en el texto. Escribe una línea por producto, por ejemplo: 2 Lápices Artesco.");
  return parsed;
}

export function requestedDescription(line:RequestedLine):string{return line.unidad?`${line.cantidad} ${line.unidad}${line.unidad==="unidad"?"es":"s"} de ${line.nombre}`:line.nombre;}
export function quantityForProduct(line:RequestedLine,p:Product):number|null {
  const native=presentationOf(p);
  let quantity=line.cantidad;
  let unit=line.unidad;
  if(unit==="docena"){quantity*=12;unit="unidad";}
  if(quantity>1000000)return null;
  if(!unit||unit===native.unidad)return quantity;
  if(unit==="unidad"&&native.unidad!=="unidad"&&native.contenido>0&&quantity%native.contenido===0)return quantity/native.contenido;
  return null;
}

export function matchSchoolList(lines:RequestedLine[],products:Product[]){
  const selected=new Map<number,{p:Product;cantidad:number;solicitado:string}>();
  const missing:UnmatchedLine[]=[];
  for(const line of lines){
    const family=productFamily(line.nombre);
    let terms=productTokens(line.nombre).filter(t=>!([...packagingUnits,"docena","docenas"] as string[]).includes(t));
    if(family==="colores")terms=terms.filter(t=>t!=="lapiz");
    const sameFamily=products.filter(p=>!family||!(p.familia||productFamily(p.nombre))||(p.familia||productFamily(p.nombre))===family);
    const exact=sameFamily.filter(p=>normalized(p.codigo)===normalized(line.nombre)||normalized(p.nombre)===normalized(line.nombre)||normalized(`${p.nombre} ${p.marca}`)===normalized(line.nombre));
    const candidates=exact.length?exact:sameFamily.filter(p=>{
      const words=productTokens(`${p.nombre} ${p.marca} ${p.codigo}`);
      if((p.familia||productFamily(p.nombre))==="colores")words.push("color");
      return terms.length>0&&terms.every(t=>words.includes(t));
    });
    if(candidates.length!==1){missing.push({...line,por_revisar:candidates.length>1,motivo:candidates.length?"Hay varias opciones. Elige el producto y la marca.":"Sin coincidencia para ese producto y sus características. Revisa el nombre o solicita el útil."});continue;}
    const p=candidates[0],quantity=quantityForProduct(line,p);
    if(quantity===null){missing.push({...line,por_revisar:true,motivo:`${presentationLabel(p)}. Confirma cuántas presentaciones necesitas; no se redondean cantidades ni se abren cajas automáticamente.`});continue;}
    const old=selected.get(p.id),amount=(old?.cantidad||0)+quantity;
    if(amount>1000000)throw new Error("La cantidad acumulada de un producto supera el límite permitido.");
    const requested=requestedDescription(line);
    selected.set(p.id,{p,cantidad:amount,solicitado:old?`${old.solicitado}; ${requested}`.slice(0,150):requested});
  }
  return {cart:[...selected.values()],missing};
}
