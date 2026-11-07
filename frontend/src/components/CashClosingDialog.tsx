import { useEffect, useRef, useState } from "react";
import { CashClosing } from "../pages/Operations";

export function CashClosingDialog({onClose,onChanged}:{onClose:()=>void;onChanged:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef(document.activeElement as HTMLElement|null);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    dialog.current?.showModal();const previous=trigger.current;
    return ()=>previous?.focus();
  },[]);
  return <dialog ref={dialog} className="cash-closing-dialog" aria-labelledby="cash-closing-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header className="cash-closing-heading"><h2 id="cash-closing-title">Cierre de caja</h2><button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={busy} aria-label="Cerrar ventana de caja"><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
    <CashClosing onChanged={onChanged} onBusyChange={setBusy} />
    <div className="cash-closing-footer"><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Volver a venta</button></div>
  </dialog>;
}
