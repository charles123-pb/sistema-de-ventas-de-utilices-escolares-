# API y permisos

## Operaciones de cierre

- `GET /ventas`: personal; filtros `desde`, `hasta`, `q`, `estado`, `pagina`. Incluye cliente, vendedor y estado. El panel de historial es administrativo.
- `POST /ventas/{id}/anular`: solo administrador, `{motivo,productos_devueltos:true}`. Devuelve el detalle con estado, motivo, fecha y responsable. Rechaza una segunda anulación o una fecha cerrada. No elimina registros.
- `GET /caja/estado`: cualquier sesión del personal; devuelve únicamente `{dia,cerrada}` para la fecha actual en Lima, sin importes ni responsables.
- `GET /cierres-caja?dia=YYYY-MM-DD`: administrador; devuelve `{dia,totales,cierres}`. Importes en céntimos.
- `POST /cierres-caja`: administrador; `{dia,fondo_inicial,gastos,retiros,contado,observaciones}`. Importes de entrada como cadenas decimales en soles. Diferencia distinta de cero exige observación. No permite fechas futuras ni dos cierres vigentes del mismo día.
- `POST /cierres-caja/reabrir`: administrador, `{id,motivo}`; conserva la fotografía anterior y registra responsable/fecha/motivo.
- `GET /reposicion`: administrador; filtros `q`, `proveedor`, `csv=1`; hasta 10 000 productos, con sugerencia, costo y proveedor.
- `GET /respaldos`: administrador; lista metadatos y URL de descarga.
- `POST /respaldos`: administrador, `{}`; genera una copia consistente y devuelve su nombre.
- `GET /respaldos/{nombre}`: administrador; descarga binaria, sin caché. Solo admite nombres generados por el servidor y archivos regulares de su carpeta de respaldos.

`seleccion` de una solicitud e `items` de una propuesta admiten `por_revisar` booleano para artículos sin producto elegido. Una selección con producto identificado no conserva ese indicador. Los reportes y el resumen excluyen ventas anuladas; el historial las conserva.

Prefijo `/api`. Respuestas JSON, excepto CSV. Error consistente: `{"error":{"mensaje":"…"}}`. Códigos: 200/201 éxito, 400 entrada inválida, 401 sin sesión, 403 permiso/origen, 404 no encontrado, 405 método, 409 conflicto/stock/estado, 415 tipo de contenido, 429 límite, 500/503 error del servicio.

Cuerpo máximo 64 KiB, excepto al crear solicitudes: hasta 8 MiB de JSON para un adjunto de máximo 5 MiB codificado en base64. No se permite JSON concatenado ni propiedades desconocidas. Listados paginados: `pagina=1` (30 elementos, respuesta como array); catálogo y productos aceptan `q` (nombre, código o marca), `categoria` y `marca` (coincidencia completa sin distinguir mayúsculas ASCII). Clientes y cotizaciones aceptan `q`. CSV máximo 10 000 filas. Categorías no se paginan. GET `/productos` también admite `id` positivo y `estado=stock_bajo|agotados|inactivos|activos` para personal; `proveedor` (0 para sin asignar) solo para administrador. El catálogo público admite `id` respetando productos activos y rechaza `estado` y `proveedor`. GET `/reposicion` valida el proveedor como entero no negativo; 0 incluye productos sin proveedor. En un ajuste, el costo del movimiento se toma del producto y se conserva el promedio, aunque el cliente envíe otro importe válido.

| Método y ruta                             | Acceso              | Uso                                                                  |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| GET `/health`                             | Público             | Estado de SQLite                                                     |
| POST `/login`                             | Público             | `{usuario,password}`; 20 intentos/IP/15 min                          |
| POST `/logout`                            | Personal            | Cierra y elimina sesión                                              |
| GET `/me`                                 | Personal            | Usuario y rol                                                        |
| GET `/productos`                          | Personal            | Productos; costos solo administrador                                 |
| POST `/productos`                         | Administrador       | Crear producto y stock inicial                                       |
| PUT `/productos/{id}`                     | Administrador       | Editar; costo y stock deben ser los actuales                         |
| GET `/marcas`                             | Personal            | Marcas distintas del catálogo y cantidad de productos                |
| GET `/proveedores?q=`                     | Administrador       | Empresas por nombre, RUC, ciudad o marca; 30 por página               |
| GET `/proveedores?opciones=1`              | Administrador       | Selector completo con id, nombre y estado                            |
| POST `/proveedores`                       | Administrador       | Crear empresa con marcas y contacto                                  |
| PUT `/proveedores/{id}`                   | Administrador       | Editar o desactivar; conserva productos y movimientos                |
| GET `/publico/marcas`                     | Público             | Marcas de productos activos, sin datos de proveedores                |
| GET `/categorias`                         | Personal            | Categorías                                                           |
| POST, PUT `/categorias`                   | Administrador       | `{id?,nombre,activo}`                                                |
| GET `/movimientos?producto_id=`           | Administrador       | Historial de inventario                                              |
| POST `/movimientos`                       | Administrador       | `{producto_id,tipo,cantidad,costo,motivo}`                           |
| GET, POST `/clientes`                     | Personal            | Listar o registrar                                                   |
| GET `/clientes/{id}`                      | Personal            | Ficha e historial paginado (`pagina`, 30 por lista)                  |
| PUT `/clientes/{id}`                      | Personal            | Editar ficha                                                         |
| GET, POST, PUT `/usuarios`                | Administrador       | Sin registro público; PUT usa `id` en cuerpo                         |
| GET `/resumen`                            | Personal            | Indicadores, 7 días, últimas ventas; margen/costo solo administrador |
| POST `/ventas`                            | Personal            | Venta pagada, transacción e idempotencia                             |
| GET `/ventas?desde=&hasta=`               | Personal            | Historial por fecha; costo/margen solo administrador                 |
| GET `/ventas/{id}`                        | Personal            | Documento y detalles históricos                                      |
| GET, POST `/cotizaciones`                 | Personal            | Listar o crear solicitud directa                                     |
| GET `/cotizaciones/{id}`                  | Personal            | Revisión actual, solicitud y pedido                                  |
| PUT `/cotizaciones/{id}`                  | Personal            | Preparar/enviar, revisión optimista                                  |
| GET, POST `/pedidos`                      | Personal            | Listar o crear desde cotización aceptada                             |
| PUT `/pedidos/{id}`                       | Personal            | `{estado}`; entrega requiere venta                                   |
| GET `/reportes?tipo=&desde=&hasta=&csv=1` | Personal            | ventas/productos/stock; movimientos y costos solo administrador      |
| GET `/publico/productos`                  | Público             | Activos, sin costos                                                  |
| GET `/publico/categorias`                 | Público             | Categorías activas                                                   |
| POST `/publico/solicitudes`               | Público             | Solicitud; máximo 20 escrituras/IP/15 min                            |
| GET `/publico/seguimiento/{token}`        | Poseedor del enlace | Solicitud, propuesta enviada y pedido                                |
| POST `/publico/seguimiento/{token}`       | Poseedor del enlace | `{accion:"aceptada" o "rechazada",revision}`                         |

El token es de 256 bits, se guarda solo su hash, no se lista ni se registra. Las respuestas tienen `no-store`, `no-referrer`, `noindex, nofollow`. Conserva el enlace al crear la solicitud; perderlo requiere una nueva solicitud. Compartirlo concede acceso y posibilidad de respuesta. No contiene autenticación por teléfono.

Las fechas de filtro son `YYYY-MM-DD`, interpretadas en Lima. Sin fechas se usa el día actual. Fin inclusivo en la interfaz, convertido internamente a límite exclusivo del día siguiente UTC.

## Cuerpos principales

Producto:

```json
{
  "codigo": "CUA-001",
  "nombre": "Cuaderno cuadriculado",
  "marca": "",
  "proveedor_id": null,
  "descripcion": "",
  "categoria_id": 1,
  "imagen": "",
  "costo": "3.50",
  "precio": "6.00",
  "stock": 20,
  "stock_minimo": 5,
  "activo": true
}
```

Entrada de inventario (ajustes usan `tipo: "ajuste"`, cantidad con signo y costo `"0.00"`, conservando promedio):

```json
{
  "producto_id": 1,
  "tipo": "entrada",
  "cantidad": 10,
  "costo": "3.80",
  "motivo": "Ingreso de mercadería",
  "proveedor_id": null,
  "comprobante": ""
}
```

Venta directa; `items` solo necesita identificador y cantidad. Los precios y totales recibidos del cliente no se usan para el cálculo:

```json
{
  "items": [{ "producto_id": 1, "cantidad": 2 }],
  "clave": "uuid-aleatorio-por-operacion",
  "pago": "efectivo",
  "recibido": "20.00",
  "cliente_id": null
}
```

Conversión de propuesta: añade `cotizacion_id` y envía `items: []`. Se consultan los artículos y precios históricos de la revisión aceptada vigente. El reintento debe usar la misma clave **y el mismo cuerpo**; cambiar el cuerpo de una venta ya registrada devuelve conflicto.

Solicitud pública o interna (solo la interna permite `cliente_id`):

```json
{
  "nombre": "Nombre del cliente",
  "telefono": "999123456",
  "lista": "2 cuadernos y 1 caja de colores",
  "observaciones": "Alternativas económicas",
  "presupuesto": "50.00"
}
```

Devuelve `{id,enlace}`. La lista del catálogo se envía como texto, para revisión manual. No hay interpretación automática.

Propuesta:

```json
{
  "revision": 1,
  "vigencia": "2026-12-15",
  "enviar": true,
  "items": [
    {
      "producto_id": 1,
      "cantidad": 2,
      "solicitado": "Cuadernos escolares",
      "alternativa": "Se eligió la marca económica",
      "opciones": [{ "producto_id": 1 }, { "producto_id": 2 }]
    },
    {
      "producto_id": 0,
      "cantidad": 1,
      "solicitado": "Artículo agotado",
      "alternativa": "Consultar próxima llegada"
    }
  ]
}
```

`enviar:false` guarda borrador. Los nombres, códigos y precios se consultan en el servidor. No hay precios manuales ni descuentos. Un artículo admite hasta diez opciones estructuradas (`opciones: [{producto_id: 1}, {producto_id: 2}]`) y un producto elegido mediante `producto_id`. El elegido debe pertenecer a las opciones cuando se envía una lista. El servidor obtiene y conserva nombre, marca, código y precio de todas las opciones; solo la elegida integra el total. También se admiten notas; `producto_id:0` conserva el artículo no disponible sin incluirlo en el total. Crear pedido: `{cotizacion_id:1}`. El pedido no guarda un pago separado: su venta vinculada representa el pago completo, y su estado de preparación se mantiene por separado.

Cliente: `{nombre,telefono,documento,direccion,tipo}`. `tipo` acepta `persona` (predeterminado en POST) o `empresa`; en PUT, omitirlo conserva el tipo actual. Para una empresa se requiere documento de 11 dígitos y dirección; esta validación comprueba formato, sin consultar SUNAT. Un documento no vacío repetido devuelve 409. GET `/clientes` acepta `q` (nombre/documento/teléfono) y `tipo`. La respuesta de detalle de venta incluye `cliente_nombre`, `cliente_documento`, `cliente_direccion` y `cliente_tipo`, capturados al cobrar; vacíos para consumidor final. Usuario: `{id?,nombre,usuario,password,rol,activo}`; contraseña vacía en PUT conserva la actual. Ninguna ruta permite borrar ventas o productos.

## Proveedores

```json
{
  "nombre": "Nombre de la empresa",
  "sitio_web": "https://example.com",
  "ruc": "",
  "contacto": "",
  "telefono": "",
  "email": "",
  "direccion": "",
  "ciudad": "Huamanga",
  "notas": "",
  "marcas": "Marca A, Marca B",
  "activo": true
}
```

RUC opcional: exactamente 11 dígitos y único cuando se completa; no consulta registros externos. Ciudad y nombre obligatorios. Marcas: hasta 30, máximo 150 bytes cada una, sin duplicados por mayúsculas/minúsculas. La respuesta del listado incluye `marcas_declaradas` (editables), `marcas` (unión con productos vinculados) y `productos` (cantidad). Los proveedores no se eliminan.

Productos admiten `proveedor_id` opcional y lo exponen, junto con `proveedor`, solo al administrador. Los movimientos de entrada admiten `proveedor_id` y `comprobante` opcionales (máximo 80 bytes). No se admiten en ajustes. El proveedor debe estar activo; un producto que ya lo tenía asignado puede conservarlo al editarse después de desactivarlo. El comprobante es una referencia manual; no representa una factura electrónica ni una cuenta por pagar.

Las fotos de producto admiten rutas locales de la forma `/productos/nombre.jpg`, `.jpeg`, `.png`, `.webp` o `.avif`, además de URLs HTTPS. Se rechazan rutas con subdirectorios, recorrido `..`, SVG, protocolos relativos y credenciales en la URL. El sitio web opcional de proveedor debe ser HTTPS y no incluir credenciales.

## Listas adjuntas y cobertura

Las solicitudes públicas e internas admiten los campos opcionales `adjunto` y `seleccion`:

```json
{
  "nombre": "Nombre del cliente",
  "telefono": "999123456",
  "lista": "7 cuadernos y 2 compases",
  "adjunto": {"nombre": "lista.txt", "tipo": "text/plain", "datos": "NyBjdWFkZXJub3M="},
  "seleccion": [
    {"producto_id": 1, "cantidad": 7, "solicitado": "Cuaderno"},
    {"producto_id": 0, "cantidad": 2, "solicitado": "Compás"}
  ]
}
```

`datos` es base64 puro. Se verifica contenido real, extensión y tamaño; formatos JPG/JPEG, PNG, WebP, PDF y TXT. No se aceptan HTML, SVG, archivos vacíos ni mayores de 5 MiB. La lista textual puede quedar vacía si se adjunta un archivo. `seleccion` admite hasta 100 renglones, cantidades enteras entre 1 y 1 000 000 y ningún identificador de producto repetido. Con `producto_id:0` se registra un faltante manual. Nombres, marcas, precios y stock de productos se consultan en el servidor.

El detalle de cotización devuelve `solicitud_items`, con cantidades `disponibles` y `faltantes` al recibir la solicitud, y `adjunto: {nombre,tipo,tamano,url}` o `null`. No incluye el contenido binario. El archivo se descarga mediante GET `/cotizaciones/{id}/adjunto` (personal) o `/publico/seguimiento/{token}/adjunto` (enlace privado). Se entrega como descarga con `no-store`, `nosniff` y CSP sandbox. Un token ajeno no permite descargarlo. Solicitud, cliente, selección y archivo se guardan en una transacción. No se modifica stock.


## Pedidos directos y configuración

- `GET /api/publico/configuracion`: solo datos comerciales y vigencia de pedidos. No expone ajustes de respaldo ni secretos.
- `GET /api/configuracion`, `PUT /api/configuracion`: solo administrador. Edición de `nombre`, `direccion`, `telefono`, `horario`, `logo`, `pedido_horas` (1–72), `respaldo_automatico` (booleano), `respaldo_horas` (1–168). La lectura incluye `ultimo_respaldo` y `respaldo_error`; estos campos no se aceptan en la edición. Se registra el historial de cambios.
- `POST /api/publico/pedidos`: `{nombre,telefono,observaciones,clave,items:[{producto_id,cantidad}]}`. Clave de reintento de 16–100 caracteres alfanuméricos o guiones. Hasta 100 líneas y 1000 unidades por producto. No admite precios ni estado de pago. Retorna `{id,enlace,codigo_recojo}`. Un reintento idéntico retorna 200; la creación, 201. Una clave con otros datos o un duplicado activo retorna 409.
- `GET /api/publico/pedidos/{token}`: seguimiento privado; no expone hashes ni costos. El enlace del cliente es `/pedido/{token}`. El código desaparece cuando el pedido se cierra.
- `GET /api/pedidos-web?pagina=1`: personal autenticado, lista de pedidos directos sin códigos ni tokens.
- `PUT /api/pedidos-web/{id}`: `{estado,codigo?}`. Preparar → listo → entregado; cancelar solo antes del pago. Entregar exige venta activa, estado listo y código correcto. Se registra responsable y fecha, y se consume el código. Pedidos cerrados no se reabren.
- `POST /api/ventas`: el campo opcional `pedido_web_id` cobra un pedido directo con su fotografía de precios y sin aceptar otro carrito. Se conserva la clave de idempotencia de cobro; no se puede combinar con `cotizacion_id`. El servidor revalida stock, producto activo y caja abierta, y vincula una sola venta al pedido en la misma transacción.

Reglas, límites y operación del programador: [PEDIDOS_DIRECTOS.md](PEDIDOS_DIRECTOS.md).

GET `/cotizaciones` acepta `q` (nombre, teléfono o número) y `estado=pendientes|enviada|aceptada|cerradas`. Omitir el estado incluye todas. Pendientes incluye solicitada y en preparación; cerradas incluye convertida, rechazada y vencida. La vigencia se evalúa antes del filtro y de la paginación; un estado desconocido devuelve 400. Requiere sesión del personal.


### Bandeja de pedidos

- `GET /pedidos` y `GET /pedidos-web`: sesión del personal; filtros `q` (número de pedido, cliente o teléfono), `estado` (vacío, `pendiente`, `preparando`, `listo`, `finalizados`) y `pagina`. Se filtra antes de paginar. Finalizados incluye entregados/cancelados y, en catálogo, vencidos. Estado desconocido responde 400.
- `GET /pedidos/:id`: devuelve el pedido escolar y su total; usa el total de venta si ya existe, o la propuesta de la revisión actual. No expone el enlace privado de la cotización.
- `GET /pedidos-web/:id`: devuelve el detalle del pedido directo con productos e importes, sin hashes ni código privado. Inexistente responde 404; sin sesión, 401.
- El cobro escolar usa `POST /ventas` con `cotizacion_id`; el directo usa `pedido_web_id`. Ambos se realizan desde la ventana del pedido y conservan validación de stock, caja e idempotencia.
