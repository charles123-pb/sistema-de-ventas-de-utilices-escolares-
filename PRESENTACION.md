# Exposición final · ÚtilVenta Ayacucho

Sistema de ventas, inventario y listas escolares para una librería en Huamanga.

## Abrir la aplicación

- Catálogo: **http://localhost:5173/catalogo**
- Panel: **http://localhost:5173/login**
- Acceso privado: [backend/data/ACCESO_PRESENTACION.txt](backend/data/ACCESO_PRESENTACION.txt). Se conservan el usuario y contraseña anteriores.

Desde `frontend`, ejecuta `npm run start`. Mantén la terminal abierta. El comando inicia Go y Vite y elige puertos libres. Usa las direcciones indicadas si cambian. La base actual es `backend/data/utilventa.db`; `presentacion.db` queda como archivo anterior separado.

## Qué contiene

- 44 productos de Artesco, Pilot, Faber-Castell, Standford, Vinifan, Layconsa, UHU y Chamex.
- 44 fotografías reales descargadas y guardadas dentro del proyecto; funcionan sin internet.
- 6 proveedores reales: Disum (Huamanga), Artesco, Continental/Standford, Tai Loy, Navarrete y Ofimarket. Cada ficha muestra sus marcas, contactos públicos y sitio web.
- 8 clientes, 14 ventas repartidas en siete días, 6 cotizaciones, 2 pedidos y 6 entradas de inventario con proveedor y referencia.
- Precios y stock de ejemplo, incluidos productos bajo el mínimo y uno agotado.
- Catálogo con búsqueda por nombre, código o marca y filtros combinables.

Las marcas, productos y empresas son reales; los clientes y las operaciones son ejemplos para clase. Las [fuentes de las fotografías y proveedores](docs/FUENTES_CATALOGO.md) están documentadas. No se presenta esta información como una tienda ya en actividad.

## Guion de 6 a 8 minutos

1. **Problema y solución (30 s).** «Una librería recibe listas por marca, vende útiles y necesita controlar stock y proveedores. Este sistema reúne esas tareas».
2. **Catálogo (1 min).** Busca «Pilot», elige «Artesco» en Marca y combina con una categoría. Muestra el catálogo compacto, adjunta una foto/PDF/TXT, agrega productos y anota un faltante. Enseña las columnas Disponibles y Faltantes. Sube la plantilla TXT o un PDF con un útil por línea: el sistema lee el contenido y compara con el inventario. Revisa el texto reconocido; las coincidencias claras pasan a Disponibles, los productos sin stock o sin coincidencia quedan en Faltantes. Si hay varias presentaciones, elige la correcta desde el catálogo. Fotos y PDF escaneados usan reconocimiento en español.
3. **Panel (30 s).** Ingresa y muestra las ventas de siete días, ventas de hoy y alertas de stock.
4. **Proveedores (1 min).** Abre Productos y stock → Proveedores. Busca «Disum» y muestra dirección de Huamanga, teléfono, sitio web y marcas. Explica que el producto tiene proveedor principal y cada entrada puede registrar otro.
5. **Inventario (1 min).** Elige un producto, registra entrada con cantidad, costo, proveedor y comprobante. Muestra el historial y explica el costo promedio.
6. **Caja (1 min).** Busca un artículo por marca, agrega cantidades, selecciona efectivo y registra el recibido. Muestra vuelto, documento interno y stock actualizado.
7. **Listas y pedidos (1 min).** Abre una cotización enviada con el enlace privado en incógnito, muestra la aceptación y el pedido. La preparación no reserva stock; se descuenta al cobrar.
En **Caja**, muestra las opciones Consumidor final, Persona y Empresa con RUC. Agrega dos productos, registra una empresa con datos de ejemplo desde **Nuevo cliente** y comprueba que conserva el carrito. El comprobante interno muestra razón social, RUC y dirección.

8. **Reportes (30 s).** Muestra filtro por fechas y descarga CSV o PDF. Las ventas conservan sus precios históricos.

## Explicación técnica breve

React + TypeScript presenta la interfaz; Go valida los permisos y operaciones; SQLite guarda los registros. El dinero se almacena en céntimos. Venta, detalle y descuento de stock se confirman en una transacción. Los contactos de proveedores y costos solo se consultan como administrador. Las fechas se presentan en hora de Perú.

Los comprobantes son internos. Yape, Plin y transferencia se registran manualmente. La facturación electrónica, compras a crédito y cierre de caja completo son etapas siguientes.

## Repetir y respaldar

Para repetir la carga de ejemplos, desde `frontend`: `npm run start -- --seed-examples`. Conserva ediciones y no duplica ventas. Evita volver a generar la base antes de exponer: puedes practicar y conservar los cambios.

Para respaldo, desde la raíz: `python3 scripts/backup.py backend/data/utilventa.db respaldo-clase.db`. Se conserva la información de acceso y los enlaces privados fuera de Git.

La comprobación de lectura `node scripts/check-schoolshop.mjs` verifica las 44 fotos, filtros, proveedores, panel, productos y caja, y genera capturas en `backend/data/exposicion/` sin registrar operaciones nuevas.

Los [enlaces privados de las seis listas](backend/data/exposicion/ENLACES_LISTAS.md) están separados de los enlaces de la base anterior.


## Cierre del proyecto

El [recorrido de las seis mejoras](docs/CIERRE_PROYECTO.md) muestra historial y anulación administrativa, recuperación de borradores, cierre/reapertura de caja, artículos por revisar, reposición y respaldo descargable. Practicar cobros, anulaciones y cierres en una base separada.
