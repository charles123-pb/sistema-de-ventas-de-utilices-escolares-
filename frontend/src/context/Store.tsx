import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
export interface StoreSettings {
 nombre: string; direccion: string; telefono: string; horario: string; logo: string;
 pedido_horas: number; respaldo_automatico?: boolean; respaldo_horas?: number;
 ultimo_respaldo?: string; respaldo_error?: string;
}
const defaults: StoreSettings = {nombre:"ÚtilVenta Ayacucho",direccion:"",telefono:"",horario:"",logo:"",pedido_horas:24};
const Store = createContext({store:defaults,refresh:async()=>{}});
export function StoreProvider({children}:{children:ReactNode}) {
 const [store,setStore]=useState(defaults);
 async function refresh(){setStore(await api<StoreSettings>("/publico/configuracion"));}
 useEffect(()=>{let active=true;api<StoreSettings>("/publico/configuracion").then(s=>{if(active)setStore(s);}).catch(()=>{});return()=>{active=false;};},[]);
 return <Store.Provider value={{store,refresh}}>{children}</Store.Provider>;
}
export const useStore=()=>useContext(Store);
export function StoreLogo(){const {store}=useStore();const [failed,setFailed]=useState("");return store.logo&&failed!==store.logo?<img className="store-logo" src={store.logo} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(store.logo)} />:<i aria-hidden="true" className="bi bi-journal-bookmark-fill" />;}
