# Operación y cierre del proyecto

## Historial y anulaciones

En **Gestión → Historial de ventas**, filtrar por fechas, cliente/documento, vendedor, número y estado. **Ver venta** abre el comprobante interno.

Solo el administrador puede **Anular venta**, con motivo de 5–500 caracteres y confirmación de que los productos no se entregaron o ya fueron devueltos. Una transacción devuelve stock, registra movimientos inversos, marca la venta y cancela el pedido asociado. Se conservan venta, cotización convertida, responsable, motivo y fecha; una segunda anulación no devuelve stock nuevamente. La devolución del dinero se coordina manualmente. Para corregir la compra se registra una nueva venta. Las anuladas se excluyen del panel, reportes y productos más vendidos.

## Borradores

Los borradores se guardan en este navegador durante siete días. La caja conserva carrito, cliente seleccionado, pago, efectivo escrito y clave del cobro; se elimina el borrador tras cobrar. El servidor valida precios y stock.

La propuesta se guarda por usuario/cotización y se recupera al recargar si la revisión del servidor coincide. Una revisión distinta evita recuperar datos antiguos. Guardar, enviar o cancelar elimina ese borrador local.

El catálogo conserva selección, texto y contacto. Los archivos adjuntos deben cargarse nuevamente después de recargar. Los borradores no se sincronizan entre equipos; si el navegador impide guardarlos se informa en pantalla.

## Cierre diario

**Caja de ventas → Cierre de caja** muestra efectivo, Yape, Plin y transferencias por separado. La ventana conserva la venta en curso y permite consultar cierres anteriores por fecha. El administrador declara fondo inicial, gastos/retiros en efectivo y efectivo contado. Se calcula:

`esperado = fondo inicial + ventas activas en efectivo − gastos − retiros`

Una diferencia requiere observación. Se guarda la fotografía del resumen y su responsable. Una caja cerrada bloquea ventas nuevas de ese día y anulaciones de ventas de ese día. **Reabrir caja** requiere motivo y conserva el cierre anterior. Volver a cerrar crea otro registro; el historial muestra ambos. Las fechas corresponden a Lima. Gastos y retiros son importes declarados para el cierre, sin contabilidad de compras ni movimientos individuales de gastos.

## Listas por revisar

Una coincidencia única pasa a disponibles según stock. Cantidades insuficientes y artículos sin coincidencia quedan en faltantes. Varias marcas o presentaciones aparecen en **Por revisar**, con un botón para elegir producto. Esta distinción se conserva en la solicitud y seguimiento. El personal puede marcar/desmarcar la revisión pendiente durante la preparación.

## Reposición

**Inventario → Control de inventario → Reposición** agrupa productos activos en el mínimo o por debajo por proveedor, ordenados por marca. Cantidad sugerida: `mínimo − stock + 1`. Incluye costos estimados, proveedor sin asignar/inactivo y CSV con filtros, hasta 10 000 productos. Exportar no registra una compra ni modifica stock.

## Respaldos

**Gestión → Respaldos → Crear respaldo** genera una copia consistente de SQLite, descargable solo por el administrador. El panel indica su fecha. Se guarda en una carpeta `respaldos` junto a la base utilizada, creada con permisos 0700; archivos con 0600. Descargar una copia permite conservarla fuera del equipo. Incluye clientes y cuentas del personal. La restauración se realiza en una ruta nueva siguiendo README, sin sobrescribir la base en uso.

## Recorrido de exposición

En una base de práctica: recuperar un carrito, cobrar, anular con motivo y comprobar stock; subir una lista con las tres situaciones; mostrar reposición; cerrar/reabrir caja y consultar su historial; crear y descargar un respaldo.

## Inventario integrado

El grupo tiene tres accesos: Productos, Control de inventario y Proveedores. Categorías se administra en una ventana desde Productos; Control de inventario integra historial y reposición. Los ajustes se realizan únicamente desde la ventana «Ajustar stock» de Productos. Las entradas de compra se registran desde la ventana de Productos o Reposición, sin cambiar de pantalla. Las rutas antiguas redirigen y conservan los identificadores de producto. El acceso desde cada producto selecciona su ficha, incluso fuera de la primera página del catálogo. Proveedores permite filtrar los productos vinculados.

La entrada propone costo promedio y proveedor principal activo, ambos editables. Reposición propone también la cantidad; guardar sigue requiriendo confirmación del operador y motivo. Los ajustes ocultan costo, proveedor y comprobante, conservan el promedio y registran el costo vigente en la auditoría. No se modificó la estructura ni se borraron datos.
