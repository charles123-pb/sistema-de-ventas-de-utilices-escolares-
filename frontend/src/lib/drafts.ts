import { useEffect, useRef, useState } from "react";

const prefix="utilventa:draft:v1:";
export function readDraft<T>(key:string):T|null {
  try {const raw=localStorage.getItem(prefix+key);if(!raw)return null;const data=JSON.parse(raw);if(Date.now()-data.at>7*86400000){localStorage.removeItem(prefix+key);return null;}return data.value as T;}catch{return null;}
}
export function writeDraft(key:string,value:unknown):boolean {
  try{localStorage.setItem(prefix+key,JSON.stringify({at:Date.now(),value}));return true;}catch{return false;}
}
export function clearDraft(key:string){try{localStorage.removeItem(prefix+key);}catch{/* Storage may be disabled. */}}
export function useStoredState<T>(key:string,initial:T){
  const [value,setValue]=useState<T>(()=>readDraft<T>(key)??initial);
  const [storageError,setStorageError]=useState("");
  const skip=useRef(false);
  useEffect(()=>{if(!skip.current && !writeDraft(key,value))setStorageError("No se pudo guardar el borrador en este navegador. Evita recargar antes de terminar.");},[key,value]);
  function clear(){skip.current=true;clearDraft(key);}
  return [value,setValue,clear,storageError] as const;
}
