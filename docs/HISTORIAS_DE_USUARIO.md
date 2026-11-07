# Historias de usuario — ÚtilVenta Ayacucho

Documento funcional para la presentación del sistema. Describe los flujos implementados y sus criterios de aceptación; no sustituye el registro de pruebas de [VERIFICACION.md](VERIFICACION.md).

**Actores:** cliente sin cuenta, vendedor y administrador. Cuando una historia dice **personal**, comprende al vendedor y al administrador. La aplicación corresponde a una librería y un almacén en Huamanga, usa soles peruanos y presenta las fechas según America/Lima.

## Organización de los módulos

| Acceso | Funciones | Permiso |
| --- | --- | --- |
| Inicio | Indicadores, gráfico de siete días y últimas ventas | Personal; costos y margen solo administrador |
| Caja de ventas | Carrito, cobro manual y comprobante interno | Personal |
| Listas escolares | Cotizaciones y pedidos para recoger | Personal |
| Productos y stock | Productos, inventario, categorías y proveedores | Personal consulta productos; administración e inventario solo administrador |
| Gestión | Clientes, reportes y usuarios | Personal; usuarios y datos de costos solo administrador |
| Catálogo público | Productos, lista adjunta y solicitud de cotización | Cliente sin cuenta |
| Seguimiento privado | Propuesta, respuesta del cliente y estado del pedido | Poseedor del enlace privado |

El historial de ventas se consulta en **Gestión → Reportes**, eligiendo el reporte de ventas. Desde cada número se abre el comprobante histórico.

## Acceso e inicio

### HU-01. Iniciar sesión

**Como** integrante del personal, **quiero** ingresar con mi usuario y contraseña, **para** acceder a las funciones de mi trabajo.

Criterios de aceptación:

- Con credenciales válidas y una cuenta activa se abre Inicio.
- Con credenciales incorrectas se muestra un mensaje sin revelar si el usuario existe.
- La contraseña se almacena con bcrypt y los intentos de ingreso están limitados.
- Una persona sin sesión no accede a las operaciones internas de la API.

### HU-02. Cerrar y expirar la sesión

**Como** integrante del personal, **quiero** que mi sesión se cierre al salir o vencer, **para** impedir el uso posterior de mi acceso.

Criterios de aceptación:

- Cerrar sesión elimina su validez en el servidor y devuelve a la pantalla de ingreso.
- Una sesión vencida obliga a autenticarse nuevamente; la duración es de ocho horas.
- Se guarda únicamente el hash del token; la cookie es HttpOnly, SameSite=Lax y Secure en modo de producción.
- Las peticiones que cambian datos validan su origen.

### HU-03. Administrar usuarios y permisos

**Como** administrador, **quiero** registrar y mantener las cuentas del personal, **para** asignar funciones sin compartir accesos.

Criterios de aceptación:

- Puedo registrar, editar, activar y desactivar usuarios con rol administrador o vendedor.
- No existe registro público de empleados; el primer administrador se crea con un comando interactivo.
- Un vendedor no puede administrar usuarios, modificar productos, ajustar stock ni consultar costos o márgenes, incluso si llama directamente a la API.
- Los cambios de una cuenta invalidan sus sesiones. No puedo desactivar ni degradar mi propia cuenta.

### HU-04. Consultar el panel principal

**Como** integrante del personal, **quiero** ver el estado diario de la librería, **para** priorizar ventas, solicitudes y pedidos.

Criterios de aceptación:

- Se muestran ventas e importe del día, cotizaciones pendientes, pedidos listos y productos con stock bajo.
- El gráfico presenta los últimos siete días y se muestran las últimas cinco ventas.
- Los indicadores proceden de SQLite y usan el día de America/Lima.
- Solo el administrador ve costo vendido y margen bruto; se explica que este margen no descuenta gastos operativos.

## Productos e inventario

### HU-05. Registrar y mantener productos

**Como** administrador, **quiero** registrar y editar productos, **para** mantener actualizado el catálogo de la librería.

Criterios de aceptación:

- Se registran código único, nombre, categoría, costo, precio, stock inicial, stock mínimo y estado; marca, descripción e imagen son opcionales.
- Se rechazan códigos repetidos, nombres vacíos, precios inválidos y cantidades fuera de los límites.
- El stock inicial genera un movimiento de inventario.
- Después del registro, el stock y el costo se modifican mediante movimientos, no mediante la edición ordinaria del producto.

### HU-06. Buscar y consultar productos internos

**Como** integrante del personal, **quiero** buscar productos por nombre o código, **para** consultar su precio, existencia y estado.

Criterios de aceptación:

- La búsqueda muestra resultados paginados con precio, stock y estado.
- Los costos aparecen únicamente para el administrador.
- Se presentan estados de carga, error y ausencia de resultados.

### HU-07. Activar y desactivar productos

**Como** administrador, **quiero** desactivar productos sin borrarlos, **para** retirar artículos de la venta conservando su historial.

Criterios de aceptación:

- Un producto inactivo no se ofrece en el catálogo público ni puede venderse.
- Sus ventas, movimientos y fotografías históricas permanecen consultables.
- Puedo volver a activarlo desde su edición.

### HU-08. Administrar categorías

**Como** administrador, **quiero** registrar y editar categorías, **para** organizar los productos y facilitar la búsqueda del cliente.

Criterios de aceptación:

- Puedo crear, editar, activar y desactivar categorías.
- Las categorías activas se ofrecen como filtros del catálogo público.
- El vendedor puede consultar las categorías, pero no modificarlas.

### HU-09. Registrar entradas de mercadería

**Como** administrador, **quiero** ingresar mercadería indicando cantidad, costo y motivo, **para** actualizar existencias y valor de inventario.

Criterios de aceptación:

- Una entrada válida aumenta el stock y registra producto, cantidad, usuario, fecha y motivo.
- El costo se recalcula como promedio ponderado usando aritmética entera en céntimos.
- Se redondea al céntimo más cercano; los empates se redondean hacia arriba.
- Si falla una operación, se revierten el movimiento y la actualización de existencias.

### HU-10. Ajustar existencias

**Como** administrador, **quiero** registrar ajustes positivos o negativos con motivo obligatorio, **para** corregir diferencias físicas de inventario.

Criterios de aceptación:

- El ajuste acepta cantidades enteras distintas de cero y conserva el costo promedio.
- Se rechaza cualquier salida que deje stock negativo.
- El movimiento conserva el motivo y el usuario responsable.

### HU-11. Consultar movimientos de inventario

**Como** administrador, **quiero** revisar el historial general o por producto, **para** explicar cada cambio de stock.

Criterios de aceptación:

- Se muestran fecha, producto, tipo, cantidad, motivo, usuario y referencia de venta cuando corresponde.
- Se incluyen stock inicial, entradas, ajustes y salidas automáticas por venta.
- El historial está paginado y puede filtrarse seleccionando un producto.

## Clientes y ventas

### HU-12. Mantener fichas de clientes

**Como** integrante del personal, **quiero** registrar y editar clientes, **para** vincular sus solicitudes y compras.

Criterios de aceptación:

- La ficha admite nombre o razón social, teléfono, documento opcional y dirección opcional.
- Puedo buscar clientes y consultar sus cotizaciones, pedidos y compras vinculadas.
- Los historiales están paginados y los datos personales no aparecen en listados públicos.
- Es posible vender a consumidor final sin registrar un cliente.

### HU-13. Preparar una venta en caja

**Como** vendedor, **quiero** buscar productos y formar un carrito, **para** cobrar una compra rápidamente.

Criterios de aceptación:

- Se buscan productos activos por nombre o código y se muestra el stock disponible.
- Agregar nuevamente un producto aumenta su cantidad sin duplicar filas.
- Puedo cambiar cantidades o quitar artículos y consultar precio unitario, subtotal y total en soles.
- No se confirma un carrito vacío ni cantidades inválidas.

### HU-14. Registrar el medio de pago

**Como** vendedor, **quiero** registrar cómo se pagó la compra, **para** dejar constancia del cobro.

Criterios de aceptación:

- Se admiten efectivo, Yape, Plin y transferencia.
- En efectivo se valida que el recibido cubra el total y se calcula el vuelto.
- Yape, Plin y transferencia se registran manualmente; el personal verifica el abono por su cuenta.
- La venta representa un pago completo; no se admiten crédito ni pagos parciales.

### HU-15. Confirmar una venta segura

**Como** vendedor, **quiero** confirmar la compra una sola vez, **para** registrar el cobro y descontar el stock correctamente.

Criterios de aceptación:

- El servidor obtiene los precios, calcula el total y comprueba cantidades, estado y existencias.
- Venta, detalles y movimientos se guardan en una sola transacción; cualquier fallo revierte toda la operación.
- Dos ventas simultáneas no pueden producir stock negativo.
- Se utiliza una clave de idempotencia: repetir la misma operación no crea otra venta. El botón se deshabilita durante el envío y el carrito solo se limpia después del éxito.

### HU-16. Obtener el comprobante interno

**Como** vendedor, **quiero** consultar, imprimir o descargar el documento de la venta, **para** entregar una constancia al cliente.

Criterios de aceptación:

- El documento muestra número, fecha, productos, cantidades, precios, total y datos del pago.
- Incluye la advertencia de que no es un comprobante tributario.
- Se puede imprimir y descargar como PDF.
- Una venta confirmada no se edita ni elimina.

### HU-17. Consultar ventas históricas

**Como** integrante del personal, **quiero** filtrar ventas por fechas y abrir su detalle, **para** revisar operaciones anteriores.

Criterios de aceptación:

- Se muestran las ventas desde la más reciente, con paginación y rango de fechas de Lima.
- El detalle conserva código, nombre y precio al momento de la venta, aunque el producto cambie después.
- El costo histórico se conserva para calcular el margen y solo se revela al administrador.

## Catálogo público y solicitudes

### HU-18. Explorar el catálogo público

**Como** cliente sin cuenta, **quiero** explorar los útiles de la librería, **para** conocer sus precios y disponibilidad.

Criterios de aceptación:

- Puedo acceder sin iniciar sesión, buscar productos y filtrar por categoría.
- Se muestran productos activos con nombre, precio, disponibilidad e imagen opcional.
- Si no existe fotografía se utiliza una ilustración identificada como referencial.
- La API pública no entrega costos ni datos personales de otros clientes.

### HU-19. Preparar una lista escolar

**Como** cliente, **quiero** adjuntar mi lista escolar y seleccionar los productos disponibles, **para** solicitar una cotización sin escribir cada artículo desde cero.

Criterios de aceptación:

- El carrito permite agregar productos, cambiar cantidades y quitar artículos sin repetir filas.
- Puedo escribir libremente la lista y añadir observaciones y presupuesto aproximado opcional.
- Puedo adjuntar una foto JPG/PNG/WebP, PDF o TXT de hasta 5 MB. El TXT se copia al texto editable; fotos y PDF se revisan manualmente.
- Disponibles y faltantes se muestran en columnas. La falta parcial de stock se calcula por cantidad. Puedo importar los renglones de texto como faltantes y completarlos eligiendo productos del catálogo.

### HU-20. Enviar una solicitud

**Como** cliente, **quiero** enviar mi nombre, teléfono y lista, **para** que el personal prepare una propuesta.

Criterios de aceptación:

- Se validan los datos obligatorios, el tamaño de la petición y la frecuencia de solicitudes.
- El envío muestra una confirmación y entrega un enlace privado de seguimiento.
- Se informa que la cotización no reserva stock y que la disponibilidad se confirma al comprar.
- No existe un cobro en línea en este flujo.

## Cotizaciones y seguimiento

### HU-21. Revisar solicitudes y crear cotizaciones

**Como** integrante del personal, **quiero** consultar las solicitudes o registrar una directamente, **para** atender también las listas recibidas en tienda.

Criterios de aceptación:

- Puedo buscar y consultar solicitudes paginadas con datos del cliente, lista, observaciones y presupuesto.
- Puedo iniciar la preparación desde una solicitud o crear una nueva internamente.
- Una cotización solicitada o en preparación no descuenta ni reserva existencias.

### HU-22. Preparar una propuesta con alternativas

**Como** integrante del personal, **quiero** agregar artículos, cantidades y alternativas, **para** ofrecer una lista que se adapte al presupuesto del cliente.

Criterios de aceptación:

- Puedo agregar productos y registrar artículos solicitados que no estén disponibles.
- Cada artículo admite hasta diez opciones y una alternativa elegida; solo la elegida integra el total.
- El servidor consulta nombres, códigos y precios de los productos y guarda su fotografía histórica.
- Puedo guardar un borrador antes de enviar la propuesta.

### HU-23. Enviar una propuesta vigente

**Como** integrante del personal, **quiero** establecer la vigencia y enviar la propuesta, **para** que el cliente revise un precio definido.

Criterios de aceptación:

- Se valida la fecha de vigencia, las cantidades y los productos elegidos.
- Una propuesta enviada conserva sus nombres, alternativas y precios aunque el catálogo se modifique después.
- La vigencia termina al final del día indicado según America/Lima.
- Se puede imprimir o descargar como PDF; el envío habilita su consulta mediante el enlace privado, sin mensajería externa automática.

### HU-24. Revisar una propuesta enviada

**Como** integrante del personal, **quiero** generar una revisión cuando cambie una propuesta enviada, **para** solicitar conformidad sobre el nuevo contenido.

Criterios de aceptación:

- Modificar una propuesta enviada crea otra revisión y deja sin efecto su aceptación anterior.
- Una respuesta que utiliza una revisión desactualizada se rechaza.
- Si había preparación pendiente sin pago, se cancela y debe reactivarse después de aceptar la nueva revisión.
- Una cotización convertida en venta no puede modificarse.

### HU-25. Consultar el seguimiento privado

**Como** cliente, **quiero** abrir el enlace de mi solicitud sin crear una cuenta, **para** revisar su propuesta y pedido.

Criterios de aceptación:

- El enlace contiene un token aleatorio no predecible y la base guarda solamente su hash.
- Un token inválido no permite consultar la solicitud; no existe un listado público de enlaces.
- El cliente ve la propuesta enviada y el estado del pedido, sin costos internos ni borradores de preparación.
- La página no debe indexarse ni almacenarse en caché. Quien posea el enlace puede consultar y responder; debe conservarse de forma privada.

### HU-26. Aceptar o rechazar la cotización

**Como** cliente, **quiero** responder a la propuesta vigente, **para** comunicar mi decisión a la librería.

Criterios de aceptación:

- Puedo aceptar o rechazar una propuesta enviada desde mi enlace privado.
- El servidor valida la revisión y muestra el estado actualizado.
- Una propuesta vencida no puede aceptarse.
- La aceptación no constituye pago, reserva ni descuento de stock.

### HU-27. Convertir una cotización en venta

**Como** vendedor, **quiero** cobrar una propuesta aceptada y vigente, **para** completar la compra respetando los precios ofrecidos.

Criterios de aceptación:

- El servidor utiliza los artículos y precios históricos de la revisión aceptada.
- Se vuelve a validar que los productos estén activos y tengan stock; el costo histórico se toma al concretar la venta.
- Si faltan existencias no se confirma ningún descuento parcial; el personal debe resolverlo antes de cobrar o revisar la propuesta.
- La conversión guarda venta, detalles, movimientos y vinculación en una transacción. Una cotización no genera dos ventas.

## Pedidos para recoger

### HU-28. Crear un pedido de preparación

**Como** integrante del personal, **quiero** crear un pedido desde una cotización aceptada, **para** organizar el recojo de los útiles.

Criterios de aceptación:

- Se exige una cotización aceptada y vigente y se evita duplicar su pedido.
- El pedido comienza pendiente, con estado separado del pago y de la cotización.
- Crear el pedido no reserva ni descuenta stock.

### HU-29. Actualizar la preparación

**Como** integrante del personal, **quiero** cambiar el estado del pedido, **para** comunicar si está pendiente, preparando, listo o cancelado.

Criterios de aceptación:

- El personal puede actualizar el estado y ve confirmada la operación.
- El cliente consulta el estado actualizado mediante su enlace privado.
- Estar listo no significa que esté pagado ni que se haya descontado stock.

### HU-30. Entregar un pedido pagado

**Como** vendedor, **quiero** marcar un pedido como entregado después de cobrar, **para** evitar entregas sin una venta registrada.

Criterios de aceptación:

- La opción entregado se bloquea si no existe una venta pagada vinculada.
- La misma restricción se aplica en el backend aunque se intente llamar a la API directamente.
- Registrar la entrega no vuelve a descontar existencias; el descuento ya ocurrió al registrar la venta.

## Reportes y uso del sistema

### HU-31. Consultar reportes del negocio

**Como** integrante del personal, **quiero** consultar ventas, productos más vendidos y stock bajo, **para** conocer el movimiento de la librería.

Criterios de aceptación:

- Puedo elegir el reporte y un rango de fechas cuando corresponda; las ventas y movimientos usan los días de America/Lima.
- El reporte de stock muestra existencias actuales, sin simular un inventario histórico por fechas.
- Los resultados están paginados y muestran un estado vacío cuando no hay registros.
- Solo el administrador consulta movimientos, costos y margen bruto calculado con costos históricos.

### HU-32. Exportar reportes CSV

**Como** integrante del personal, **quiero** descargar los reportes autorizados, **para** revisarlos en una hoja de cálculo.

Criterios de aceptación:

- La exportación respeta el tipo de reporte y los filtros seleccionados, con un límite informado de 10 000 registros.
- El servidor excluye costos y margen cuando el usuario es vendedor.
- Los textos que puedan interpretarse como fórmulas de hoja de cálculo se neutralizan.

### HU-33. Navegar por módulos compactos

**Como** integrante del personal, **quiero** un menú organizado y pantallas compactas, **para** encontrar cada función y trabajar desde computadora o celular.

Criterios de aceptación:

- El menú principal tiene cinco accesos: Inicio, Caja de ventas, Listas escolares, Productos y stock, y Gestión.
- Los submódulos se agrupan por tarea; solo se despliega un grupo a la vez y se identifica la sección activa.
- En celular el menú se abre mediante un botón; elegir una ruta lo cierra. Puede operarse con teclado y muestra el foco.
- Las tablas y formularios aprovechan el espacio, conservan etiquetas y mantienen controles de al menos 44 px de alto en celular.

### HU-34. Preparar una demostración y conservar los datos

**Como** administrador, **quiero** cargar ejemplos de forma explícita y respaldar la base, **para** presentar el sistema y conservar la información.

Criterios de aceptación:

- Los datos ficticios se cargan solo con un comando explícito y se identifican como DEMO.
- Repetir la carga no duplica ventas ni restablece el stock o los cambios existentes.
- El respaldo utiliza la API de backup de SQLite y verifica integridad, sin copiar de forma inconsistente una base activa.
- La restauración se realiza con el servidor detenido y en una ruta nueva; los comandos están documentados en el README.

### HU-35. Mantener proveedores y sus marcas

**Como** administrador, **quiero** registrar empresas proveedoras y las marcas que manejan, **para** organizar el abastecimiento de la librería en Huamanga.

Criterios de aceptación:

- Puedo crear, editar y desactivar proveedores con ciudad, dirección, contacto, teléfono, correo y condiciones de compra.
- El RUC es opcional; si lo ingreso, tiene 11 dígitos y no puede repetirse. No se verifica contra servicios externos.
- Puedo registrar hasta 30 marcas por empresa y buscar por nombre, RUC, ciudad o marca.
- La tabla combina marcas declaradas y marcas de productos vinculados. Los vendedores y el público no acceden a esta información.

### HU-36. Vincular productos a un proveedor

**Como** administrador, **quiero** asignar un proveedor principal a cada producto, **para** identificar a quién solicitar la reposición.

Criterios de aceptación:

- La asignación es opcional y se puede cambiar o retirar al editar el producto.
- No se asignan proveedores inactivos a nuevos productos; las referencias anteriores se conservan.
- Las marcas de los productos vinculados aparecen en la ficha del proveedor sin convertirse automáticamente en marcas declaradas editables.

### HU-37. Identificar el origen de las entradas

**Como** administrador, **quiero** registrar proveedor y comprobante al ingresar mercadería, **para** consultar el origen de cada abastecimiento.

Criterios de aceptación:

- Una entrada admite proveedor activo y comprobante opcionales; puede provenir de un proveedor distinto del principal.
- El historial muestra proveedor y comprobante. Desactivar la empresa no elimina las referencias.
- Los ajustes no llevan esos campos. Una entrada rechazada no cambia el stock ni el costo promedio.

### HU-38. Encontrar productos por marca

**Como** cliente o integrante del personal, **quiero** buscar productos por marca, **para** encontrar las referencias que prefiero.

Criterios de aceptación:

- El texto de búsqueda consulta nombre, código y marca. El catálogo permite combinar marca, categoría y texto, y limpiar los filtros.
- El selector público usa marcas de productos activos. Las tarjetas destacan la marca y la solicitud conserva la marca seleccionada.
- El panel de productos permite filtrar por marca y su formulario sugiere las marcas ya registradas.
- La búsqueda devuelve un estado vacío cuando no hay coincidencias y funciona desde celular.

## Reglas comunes y límites de esta versión

- Los importes se guardan como enteros en céntimos; los precios ingresados se validan sin cálculos monetarios de punto flotante.
- Las fechas se guardan en UTC y se muestran según America/Lima.
- Las consultas SQL son parametrizadas, las entradas se validan en el servidor y se respetan los permisos del rol.
- No hay facturación SUNAT, checkout con cobro en línea, pagos parciales, crédito, múltiples sucursales, OCR ni reserva de stock.
- Los enlaces de seguimiento se entregan al crear la solicitud; no se recuperan a partir de su hash. No se envían automáticamente por SMS o WhatsApp.
- Se admiten fotos locales del catálogo y URLs HTTPS. Las solicitudes pueden llevar un adjunto privado JPG/PNG/WebP/PDF/TXT de hasta 5 MB.
- La validación corresponde a una demostración local. Un despliegue de producción requiere su propia configuración y verificación.
