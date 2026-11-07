# Pedidos directos y operación segura

El catálogo permite enviar un pedido sin cotización cuando todos los productos elegidos tienen existencias suficientes. Las listas con archivos, texto por comparar o faltantes conservan el recorrido de cotización.

## Cliente

1. Agregar productos y cantidades al carrito.
2. Elegir **Hacer pedido directo**, ingresar nombre, teléfono y una nota opcional.
3. Confirmar y abrir **Ver mi último pedido**. Conservar el enlace privado y el código de recojo.
4. Pagar al recoger o coordinar un abono con la tienda. Consultar el estado desde el enlace.

No se crea una cuenta pública. El teléfono no se verifica por SMS y no sirve para acceder a pedidos ajenos. El último enlace y los datos de contacto se conservan en este navegador durante siete días; no se sincronizan entre dispositivos. El enlace privado actúa como credencial: no debe compartirse.

## Personal

En **Listas escolares → Pedidos**, el bloque **Pedidos directos del catálogo** permite:

- Registrar el pago una sola vez. En efectivo se valida el recibido; en Yape, Plin o transferencia el trabajador confirma que verificó el abono en la cuenta de la tienda. Una captura enviada por el cliente no confirma un pago.
- Marcar **Preparar**, después **Listo para recoger**.
- Entregar únicamente un pedido listo, con una venta activa y el código correcto. Se consume el código y se registra quién entregó y cuándo.
- Cancelar un pedido sin pago. Un pedido pagado requiere la anulación administrativa de su venta; se conserva la trazabilidad y se repone stock conforme al procedimiento existente.

Los pedidos de cotizaciones escolares anteriores mantienen su recorrido y sus reglas existentes. El control nuevo de código se aplica a los pedidos directos.

## Reglas automáticas

- El servidor consulta precios y productos activos; no admite importes ni pagos enviados por el cliente.
- El mismo intento con los mismos datos devuelve el mismo pedido. Otra solicitud equivalente activa se rechaza, incluso si llega al mismo tiempo.
- Se conservan el precio y la presentación al confirmar el pedido. Al cobrar se vuelven a comprobar el producto activo, el stock y la caja abierta; venta, descuento de stock y vinculación al pedido se confirman juntos.
- Crear o preparar un pedido no reserva ni descuenta existencias. Si se agota un producto antes del pago, se rechaza el cobro sin cambios parciales; el personal coordina con el cliente.
- Un pedido sin pago vence después del intervalo configurado (24 horas inicialmente; de 1 a 72 horas). El mantenimiento se ejecuta al arrancar y cada minuto; las consultas y operaciones también verifican el vencimiento. Un pedido pagado no vence por este plazo.
- Máximo 100 líneas y 1000 unidades por producto; máximo monetario existente. Hay límites por IP y cinco pedidos por teléfono en quince minutos. No equivalen a una verificación de identidad.
- El código tiene diez caracteres hexadecimales, se guarda como hash y solo aparece en el seguimiento privado mientras el pedido siga abierto. Hay un límite de intentos de entrega por trabajador y pedido.

## Configuración y respaldo

En **Gestión → Configuración**, solo un administrador edita nombre, dirección de recojo, teléfono, horario, logo, vigencia e intervalo de respaldo. Los cambios quedan registrados. Los datos comerciales se muestran en el catálogo, seguimiento y documentos internos. No se inventaron datos de contacto.

Los respaldos automáticos están activados inicialmente cada 24 horas. Se crean al arrancar si ya corresponde y se comprueban cada minuto mientras el servidor está encendido. Un respaldo manual reinicia ese intervalo. Se guardan junto a la base, en `respaldos`, con permisos privados; no se eliminan copias anteriores automáticamente. El panel de configuración muestra la última ejecución correcta y el último error. Se debe vigilar el espacio disponible y conservar una copia fuera del equipo.

El procedimiento de restauración es el del README: detener el servidor y restaurar a un archivo nuevo. La copia incluye configuración y la información necesaria para conservar los enlaces de pedidos. Las pruebas verifican integridad y permisos del respaldo.

## Puesta en marcha

La migración `008_direct_orders_settings.sql` se aplica automáticamente al abrir SQLite. Antes de actualizar una base existente, crear un respaldo. En Linux, `npm run start -- --restart` reinicia únicamente los procesos de esta copia del proyecto; no termina aplicaciones por número de puerto. La revisión sin nuevas operaciones comerciales se ejecuta con `npm run start -- --check`.

La integración con pasarelas de pago, avisos por WhatsApp/SMS, compras con deudas y facturación electrónica siguen fuera de este alcance.
