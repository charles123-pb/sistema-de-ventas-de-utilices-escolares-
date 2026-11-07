# Menú flotante y modo compacto

Se rediseñó la navegación del personal con un panel claro flotante, estado activo en tinta/lima, submenús con guía visual y una tarjeta de cuenta. El botón junto al logo contrae el menú a iconos y guarda la preferencia local. Abrir un grupo desde el modo compacto expande sus opciones. En móvil se usa un panel superpuesto, con cierre al navegar o pulsar Escape y retorno del foco al botón de menú.

Se eliminó la transición del margen al entrar en móvil para evitar desbordamiento durante el cambio de tamaño. Las pruebas de navegación esperan la ruta y el encabezado de destino antes de escribir en campos compartidos entre módulos; el control de reposición admite varias tablas de proveedor.

Validación: compilación y lint aprobados; **18 pruebas de Firefox aprobadas**. La prueba nueva verifica persistencia del modo compacto, expansión de grupos, navegación móvil, Escape, foco y ausencia de desbordamiento. La revisión contra la aplicación real también aprobó sin nuevas operaciones comerciales. Las capturas están en `backend/data/exposicion/sidebar-flotante.png`, `sidebar-compacto.png` y `sidebar-movil.png`.

---

# Cierre aplicado: pedidos directos, configuración y respaldos

28 de octubre de 2026. Se implementó la migración 008, con pedidos web separados de las cotizaciones, configuración comercial y registro de eventos. Se preserva el recorrido escolar existente.

Validación final de este alcance:

- `go test ./...`, `go test -race ./...` y `go vet ./...`: aprobados.
- `npm run build`, `npm run lint` y el verificador SQLite: aprobados.
- Firefox: **17 pruebas aprobadas**, incluidas compra directa desde móvil, pago por el personal, código incorrecto rechazado, entrega única y publicación segura de los datos comerciales.
- Pruebas Go nuevas: reintentos, claves alteradas, duplicados concurrentes, límites por teléfono, precios históricos, pago concurrente único, stock insuficiente sin escrituras parciales, vencimiento de impagos, conservación de pedidos pagados, anulación, permisos, auditoría de configuración y respaldos automáticos con intervalos, permisos y errores visibles.
- `npm run start -- --check`: aprobado contra la aplicación real con configuración y listado de pedidos directos; no registra operaciones comerciales.
- Se creó un respaldo consistente antes de aplicar la migración a la base habitual. La aplicación se reinició en localhost:5173, la migración se aplicó y se comprobó el primer respaldo automático. No se crearon pedidos directos de prueba en la base de la tienda.

Operación y límites: [PEDIDOS_DIRECTOS.md](PEDIDOS_DIRECTOS.md). El pago digital sigue requiriendo verificación del personal; los respaldos automáticos son locales y se ejecutan mientras Go esté encendido. Los datos reales del negocio se completan en Gestión → Configuración.

---

# Revisión final del sistema · 28 de octubre de 2026

Estado: entrega local validada. Pendientes de puesta en marcha en [SIGUIENTES_PASOS.md](SIGUIENTES_PASOS.md).

- `go test ./...` y `go vet ./...`: aprobados.
- `npm run build`, `npm run lint` y `npm run test:school-list`: aprobados.
- `npm run start -- --tests`: 15 pruebas de Firefox aprobadas en la revisión final.
- `python3 scripts/check_sqlite.py`: aprobado tras adaptar la comprobación del esquema vacío a las funciones Go de la migración 007. Se comprobaron restricciones, rollback, respaldo privado, rechazo de sobrescritura y restauración.
- Base actual revisada en modo lectura: integridad correcta, cero referencias inválidas, cero productos con stock negativo y cero fotografías locales faltantes.
- Respaldo y restauración de la base actual comprobados en una carpeta temporal; integridad y referencias correctas, con 44 productos y 17 ventas conservados. Las copias temporales se eliminaron sin reemplazar la base habitual.
- `npm run start -- --check`: corregido para revisar la base habitual mediante el recorrido sin nuevas operaciones comerciales. Aprobó fotografías, filtros, proveedores, panel, caja y móvil, sin errores JavaScript.
- Ajuste final de filtros: se conserva una fila y se acorta la opción general a «Todas» para mejorar su lectura en móvil.

Los apartados siguientes conservan el historial de verificaciones; sus cantidades y limitaciones corresponden a cada entrega anterior.

---

## Caja: personas y empresas con RUC

La caja permite Consumidor final, Persona y Empresa con RUC. Nuevo cliente registra y selecciona una ficha sin abandonar el carrito. Los datos de persona son opcionales salvo el nombre; empresa requiere razón social, RUC con formato de 11 dígitos y dirección. La búsqueda incluye nombre/documento/teléfono, tipo y páginas. No se consulta SUNAT.

Se comprobaron las nueve pruebas previas de navegador y la prueba nueva de caja (empresa, persona sin documento, búsqueda por RUC, conservación del carrito, cobro anónimo y móvil). Go test, Go vet, lint y compilación aprobados. Las pruebas de servidor comprueban RUC mal formado, dirección requerida, documentos repetidos, filtros, historial del cliente en el comprobante, venta anónima e inexistencia del cliente sin alterar stock. El comprobante y su PDF conservan los datos del cliente guardados al cobrar.

Antes de aplicar la migración 005 se creó respaldo SQLite. La base de la presentación conservó sus 44 productos, 9 clientes y 16 ventas; integridad correcta y sin referencias inválidas. Las pruebas de cobro se ejecutaron en la base temporal de pruebas.

# Verificación de esta entrega

## Catálogo compacto, archivos y faltantes · 28 de octubre de 2026

Se sustituyeron los cuadros por grado por una lista lateral para cotizar. Se puede adjuntar JPG/PNG/WebP/PDF/TXT de hasta 5 MB, escribir o importar renglones, escoger productos para completar cada faltante y consultar disponibles y cantidades pendientes. La separación parcial usa stock real al recibir la solicitud, sin reservar ni descontar existencias. El personal recibe la selección precargada y puede descargar el archivo privado; el seguimiento muestra los dos grupos.

- `go test ./...` y `go vet ./...`: aprobados. Las nuevas pruebas cubren adjuntos mayores de 64 KiB, contenido y extensión, límite de 5 MiB, aislamiento por sesión/enlace, cantidades, precios del servidor, reversión de archivo/cliente/solicitud ante error y conservación de stock.
- Se detectó en pruebas que un SVG podía identificarse como texto plano; se añadió verificación de extensión y rechazo explícito del contenido HTML/SVG antes de admitir un TXT.
- `npm run build`, `npm run lint` y `python3 scripts/check_sqlite.py`: aprobados.
- Playwright: nueve pruebas aprobadas, incluyendo lectura de PDF de texto, OCR de foto/PDF escaneado, inventario paginado, marcas ambiguas, recuperación de archivo dañado, envío y descarga privada, propuesta precargada, venta/documentos, permisos y proveedores/inventario.
- La base activa aplicó `004_school_list_upload.sql` después de crear `respaldo-antes-listas-adjuntas-20261028.db`. Los adjuntos viven en SQLite y quedan incluidos en el respaldo.

Actualización: fotos y PDF escaneados ahora se leen mediante OCR local en español, y los PDF con texto se leen con PDF.js. Los nombres y cantidades reconocidos quedan editables y se comparan con el inventario completo. Las coincidencias ambiguas requieren selección manual. Las nuevas pruebas de navegador cubren PDF con texto, OCR de foto/PDF escaneado sin llamadas externas, paginación, marcas ambiguas, corrección sin duplicados y recuperación ante PDF dañado. Los apartados siguientes conservan el registro de entregas anteriores.


## Entrega para exposición: marcas, fotos y proveedores reales

28 de octubre de 2026. La aplicación abre sin modo demo mediante `npm run start`, usando `backend/data/utilventa.db`. La base anterior `presentacion.db` se conserva aparte. Se mantuvo el acceso administrativo existente sin imprimir credenciales.

La base de clase contiene 44 productos, ocho marcas, 44 fotografías locales, seis proveedores reales con sus marcas/contactos publicados, ocho clientes, catorce ventas, seis cotizaciones, dos pedidos y seis entradas con proveedor y referencia. Las operaciones, precios y existencias son ejemplos académicos. Las [fuentes consultadas](FUENTES_CATALOGO.md) y el [guion de exposición](../PRESENTACION.md) están documentados.

Comprobaciones de esta entrega:

- `go test ./...`, `go vet ./...`, `npm run build`, `npm run lint` y `python3 scripts/check_sqlite.py`: aprobados.
- Suite Playwright: cuatro pruebas aprobadas, incluyendo venta y documentos, permisos, listas escolares y proveedores/marcas/entradas.
- `TestSchoolShopRealCatalogAndRepeatability`: 44 productos, seis proveedores, ocho marcas, inventario coherente con movimientos, importes históricos y seis entradas. Repetir la carga no duplica registros ni restablece precios editados o stock.
- `TestSchoolCatalogLocalPhotographsExist`: las 44 fotos existen y cada producto tiene sus importes y proveedor.
- `TestProductImagePaths`: rutas locales controladas y HTTPS; rechazo de rutas relativas a otro host, recorrido de directorios, SVG y credenciales.
- `TestSchoolLinksDoNotCollideWithPreviousDatabase`: enlaces separados por carpeta para evitar mezclar cotizaciones con identificadores iguales en bases distintas.
- `node scripts/check-schoolshop.mjs`: aprobado contra la aplicación abierta. Verifica la carga de las 44 fotos con tamaño válido, ocho marcas, proveedores reales, Disum, búsquedas/filtros, imágenes en productos y caja, vistas móviles sin desbordamiento, ausencia de errores JavaScript y validez de los seis enlaces privados. No registra operaciones comerciales.

Los enlaces actuales se exportan a `backend/data/exposicion/ENLACES_LISTAS.md` y `.json`, privados. Las capturas de catálogo, caja, productos, panel y proveedores están en `backend/data/exposicion/`. La aplicación usa actualmente los puertos 8080 y 5173. El arranque local permanece activo de forma independiente; su salida está en `backend/data/exposicion/servicios.log`.

Los apartados siguientes son registros históricos de entregas anteriores.


## Actualización del 28 de octubre de 2026: proveedores y marcas

Se implementaron empresas proveedoras con contactos y marcas declaradas, vinculación de proveedor principal por producto, y proveedor/comprobante en entradas. El catálogo y el panel buscan por marca y ofrecen un filtro específico. El diseño reduce espacios y tamaño de las tarjetas, y presenta proveedores como fichas completas en móvil.

Verificación ejecutada en esta entrega:

- `go test ./...` y `go vet ./...`: aprobados con Go 1.23.12 instalado temporalmente, sin modificar la instalación del sistema.
- `npm run build` y `npm run lint`: aprobados.
- `python3 scripts/check_sqlite.py`: aprobada, usando todas las migraciones.
- Playwright en Firefox: **4 pruebas aprobadas**, incluido proveedor → producto → entrada con comprobante → búsqueda/filtro por marca en móvil. Se corrigió un selector ambiguo del test que coincidía con el aviso de éxito y el estado de carga simultáneamente.
- Pruebas Go nuevas: `TestBrandsSearchFiltersAndPrivacy` y `TestSupplierLifecycleAndReceiving`. Cubren marcas, filtros combinados, RUC duplicado, datos inválidos, permisos, vinculación, costo promedio, trazabilidad, inactividad y rechazo de entradas sin alterar stock.
- `npm run start -- --check --capture`: aprobado contra la base de presentación; acceso, panel, productos, catálogo, menú y capturas sin crear operaciones comerciales.
- Revisión visual de catálogo, panel y proveedores en escritorio y móvil. Las capturas están en `backend/data/presentacion/` y `frontend/test-results/`.

Antes de aplicar `002_suppliers.sql` a la presentación se creó `backend/data/respaldo-antes-proveedores-20261028.db`. Se verificaron integridad `ok`, cero referencias inválidas y conservación de 40 productos, 12 clientes, 16 ventas y 17 cotizaciones. No se cargaron proveedores ficticios en esa base; el recorrido automatizado utiliza SQLite temporal.

La aplicación quedó iniciada en `http://localhost:5173`, con Go en 8080 y Vite en 5173. El módulo está en **Productos y stock → Proveedores**, para administradores. Los apartados siguientes conservan el registro histórico de verificaciones anteriores.


## Menú agrupado y panel compacto

La navegación interna se reorganizó en cinco accesos, con submódulos desplegables y permisos por rol. Se redujeron los espacios de formularios, tablas y tarjetas; se conservan controles de al menos 44 px de alto en celular. No se modificaron los datos de la tienda.

Después del cambio se ejecutaron `go test ./...`, `go vet ./...`, `npm run lint`, `npm run build` y las tres pruebas Playwright en Firefox. Todas pasaron. La prueba de vendedor también recorre el menú móvil, verifica su cierre al navegar, la apertura de un solo grupo y la ausencia de inventario y usuarios.

`npm run start -- --check --capture` comprobó el servidor de presentación sin registrar operaciones: login, panel, productos, catálogo, menú móvil, cierre con Escape y recuperación del foco. Se verificó que el panel móvil no desborda horizontalmente y que no hay errores JavaScript. Las capturas se guardan en `backend/data/presentacion/`.

Las [34 historias de usuario](HISTORIAS_DE_USUARIO.md) incluyen actores y criterios de aceptación. Se comprobó su numeración consecutiva y la validez de los enlaces locales. Describen funciones implementadas; no representan 34 pruebas automatizadas independientes.

## Comprobaciones generales anteriores

Se compilaron frontend y backend, se ejecutaron las pruebas contra SQLite real y pasaron las tres pruebas de navegador en Firefox. También se verificó el servidor de presentación con una operación completa y se guardaron capturas y documentos. Esto valida la demostración local; no supone una evaluación de producción.

| Comprobación                                     | Resultado real                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `go mod tidy`                                    | Pasó; `go.sum` generado                                                                            |
| `gofmt`                                          | Aplicado al backend                                                                                |
| `go test ./...`                                  | Pasó; 14 pruebas principales y 4 subcasos, más el servidor auxiliar omitido por diseño             |
| `go test -race ./...`                            | Pasó; sin condiciones de carrera detectadas                                                        |
| `go vet ./...`                                   | Pasó                                                                                               |
| `npm install`                                    | Pasó; `package-lock.json` generado                                                                 |
| `npm run build`                                  | Pasó; TypeScript y compilación Vite completos                                                      |
| `npm run lint`                                   | Pasó con la configuración completa, incluidas reglas de React Hooks                                |
| `python scripts/check_sqlite.py`                 | Pasó: migración, claves foráneas, stock no negativo, código único, rollback, respaldo e integridad |
| Firefox de Playwright                            | Instalado; aplicación real, vista móvil y 3 pruebas completas                                      |
| Suite Playwright `test:e2e` (arranque `--tests`) | Pasó: 3 pruebas en Firefox; puertos 8082/5174 y SQLite temporal                                    |

Se usaron Go 1.24.9 en `/tmp/utilventa-toolchain/go`, caché en `/tmp/utilventa-go-cache` y módulos en `/tmp/utilventa-gopath`; no se modificó la instalación del sistema. Las descargas se realizaron mediante el acceso de red disponible y un proxy local de archivos para los módulos Go. Son directorios temporales: para trabajar habitualmente instala Go y usa los comandos normales del README. Los fallos iniciales por DNS y herramientas ausentes se resolvieron para las comprobaciones indicadas como aprobadas.

## Pruebas Go ejecutadas

- `TestAuthPermissionsAndExpiry`: acceso sin sesión, login válido/inválido, cookies, rol y expiración.
- `TestSaleAndHistoricalPrices`: precios del servidor, stock, idempotencia y fotografía histórica de nombre/precio/costo.
- `TestSaleValidationRollback`: cantidades inválidas, inactivos, falta de stock y carrito con producto inexistente.
- `TestConcurrentSales`: dos solicitudes concurrentes con stock para solo una.
- `TestQuoteRevisionExpiryConversionAndOrder`: solicitud privada, enlace ajeno, stock intacto, revisión, vencimiento, conversión única, precios cotizados y entrega con pago.
- `TestLimaRangeCSVAndCSRF`: límites UTC del día de Lima, protección CSV, origen y token protegido.
- `TestInventoryWeightedCostAndPermissions`: costo promedio, ajuste inválido y acceso a costos.
- `TestFailureAfterStockWriteRollsBack`: fallo provocado después de iniciar las escrituras; exige reversión de venta, detalle y stock.
- `TestMoney`: conversión exacta, límite, fracciones inválidas y notación rechazada.

- `TestStructuredAlternativesPreserveSnapshot`: precios del servidor para todas las alternativas, fotografía histórica y rechazo de una opción no ofrecida.
- `TestCustomerHistoryPagination`: páginas de compras y cotizaciones con 61 registros, incluidas páginas vacías.

- `TestDemoIsRepeatableAndPreservesEdits`: carga ampliada sin duplicados ni cambios de precio o stock del usuario.
- `TestDemoLedgerQuotesAndHistoricalTotals`: existencias, movimientos, fechas de siete días, importes históricos y entrega con pago.
- `TestDemoLinksRemainPrivateAndKeepEarlierLinks`: enlaces conservados, sin duplicados y archivo privado.

`TestBrowserServer` se omite en la suite normal: es un servidor auxiliar exclusivo de Playwright, habilitado con `UV_E2E=1`, y utiliza una base temporal.

## Demostración real verificada

`npm run start -- --demo` mantiene Go en 8081 y Vite en 5173, sin detener la aplicación ajena que ocupa 8080. El acceso está en un archivo privado fuera de Git. `npm run start -- --check` pasó contra esa base separada: login, catálogo móvil, carrito unificado, solicitud privada, propuesta con alternativas, aceptación, pedido, pago, stock, entrega, PDF y CSV. Los productos y clientes de estas operaciones están marcados como DEMO.

Se revisaron visualmente `backend/data/presentacion/panel.png` y `catalogo-movil.png`. La misma carpeta contiene el PDF y CSV generados. Se corrigieron los iconos decorativos para que no alteren los nombres accesibles de los enlaces y botones.

Los problemas iniciales al abrir puertos se resolvieron al ejecutar el arranque autorizado y usar puertos libres. El servidor de pruebas admite puertos configurables y no afecta a la demostración abierta.

## Revisión manual al instalar las dependencias

1. Ejecutar `npm run test:e2e:install` y Suite Playwright `test:e2e` (arranque `--tests`) desde `frontend`, con Go disponible y los puertos 8082 y 5174 libres. Estas pruebas usan datos exclusivamente temporales.
2. Crear administrador y producto, comprobar stock inicial en movimientos.
3. Crear vendedor y verificar que no ve costos, margen, usuarios ni inventario y que la API también lo impide.
4. Ingresar mercadería, ajustar stock con motivo y revisar el promedio calculado.
5. Solicitar una lista desde catálogo y conservar su enlace privado.
6. Preparar y enviar propuesta, aceptarla con su enlace, crear pedido y cobrar.
7. Revisar stock y documento; verificar que el pedido solo se entrega con venta vinculada.
8. Modificar precio y costo del producto; comprobar que el documento vendido conserva ambos valores históricos.
9. Repetir una venta con la misma clave y cuerpo; verificar que existe una sola venta.
10. Revisar catálogos, formularios y tablas en móvil, navegación con teclado, impresión y PDF.
11. Revisar filtros de Lima, exportación CSV y restauración a una base nueva.

Limitaciones deliberadas: pagos verificados manualmente, sin reservas, sin OCR, imágenes mediante URL HTTPS, hasta diez alternativas estructuradas por artículo y una elegida para el total, límite de frecuencia en memoria y configuración de alojamiento pendiente. Los enlaces privados no son recuperables desde la base; se entregan una sola vez. El servidor requiere ejecutarse detrás del mismo origen que la interfaz para su eventual alojamiento.

## Catálogo y listas ampliadas

Se verificaron en Firefox las ilustraciones locales, la carga de listas referenciales, su edición sin pérdida del texto previo, el presupuesto conservado, los filtros por categoría y la ausencia de desbordamiento horizontal en móvil. Se revisaron las nuevas capturas del catálogo de escritorio y del panel con datos de siete días. Los formularios usan etiquetas vinculadas por identificador, para conservar su nombre accesible al cambiar el contenido.

La carga explícita añadió 37 productos a los tres existentes, ocho clientes, 13 listas y 14 ventas ficticias; no se borraron registros ni se restableció el stock. Los enlaces privados se exportan a archivos locales con permisos 0600. Los 40 productos se distribuyen entre las seis categorías y conservan su identificación DEMO.


## Operaciones finales del negocio

Migración 006: estado y auditoría de anulaciones, más cierres diarios con reapertura. Se verificaron permisos administrativos, restitución única de stock, rollback ante fallo provocado, bloqueo de entrega de pedido con venta anulada y exclusión de anuladas en reportes/resumen. Los cierres calculan efectivo neto de ventas activas, requieren observación ante diferencia y conservan los registros al reabrir.

Los respaldos se generan mediante VACUUM INTO; la prueba descarga una copia, la abre como otra base y verifica integridad y stock. Se comprobó el rechazo al vendedor y a nombres de archivo arbitrarios. La reposición calcula mínimo menos stock más uno y protege el CSV frente a fórmulas.

Playwright comprueba recuperación de carrito/propuesta tras recargar, anulación auditada, cierre/reapertura, reposición y descarga binaria. Las diez pruebas previas del catálogo, OCR, venta/cotización y permisos también se ejecutaron. Los cobros y cierres de las pruebas usan una base temporal.

## Cierre visual · 28 de octubre de 2026

Se simplificaron los textos del catálogo, panel, caja, ingreso y encabezados. Buscar, categoría y marca permanecen en una sola fila, sin categorías duplicadas. Las instrucciones extensas del lector están en «Ayuda y plantillas»; se mantienen las etiquetas, los errores y las reglas necesarias para operar.

Validación final: `npm run build`, `npm run lint` y las 15 pruebas de Firefox mediante `npm run start -- --tests` aprobaron. La suite usa una base temporal y cubre listas, OCR, ventas, permisos, proveedores, pedidos, anulaciones, cierres, respaldos y vista móvil. Entrega lista para presentación local; el alcance de producción sigue descrito en README.

## Flujo integrado de productos y stock

La prueba `zzzzzz-stock-flow.spec.ts` recorre creación de producto/proveedor en base temporal, entrada con costo y proveedor sugeridos, ajuste sin alterar costo, historial con responsable y comprobante, filtros de stock, creación y edición de categorías, productos vinculados a un proveedor, reposición con cantidad sugerida y redirección del inventario anterior. Comprueba además que la vista móvil no desborda horizontalmente. Las pruebas Go cubren privacidad de costos/proveedor, filtros, selección por identificador y costo auditado del ajuste.

El comprobador de la tienda real solo consulta productos y abre las pantallas: verifica selección fuera de los primeros 30 productos, costo sugerido, tres accesos del grupo y vista móvil sin crear movimientos comerciales.

Validación del flujo integrado: 19 pruebas de Firefox aprobadas, `go test ./...`, `go vet ./...`, compilación de producción y lint correctos.

## Cotización sencilla y bandeja escolar

El catálogo mantiene la cotización a su costado, con carga o pegado antes de coincidencias y contacto. Se retiró la página separada y el acceso duplicado; `/lista` redirige al formulario del catálogo para conservar los enlaces anteriores. Conserva la revisión de cantidades, faltantes y presentaciones. El envío se bloquea si hay texto pendiente de comparar. La prueba `zzzzzzz-list-flow.spec.ts` recorre cliente móvil, enlace privado, filtro por teléfono/estado y apertura por el personal en base temporal. Go verifica filtros con vigencia, paginación en servidor y privacidad. El comprobador real solo abre las pantallas y consulta la bandeja, sin enviar solicitudes.

Validación de la cotización y bandeja actualizadas: las 20 pruebas de Firefox aprobaron; compilación, lint, pruebas Go y vet correctos. Las operaciones de las pruebas se ejecutaron exclusivamente en base temporal.

## Limpieza y pedido desde una lista

`zzzzzzzz-clear-cart.spec.ts` verifica pedido directo desde TXT revisado sin borrar el adjunto, bloqueo mientras el texto tiene cambios sin revisar, autorización explícita del pedido parcial, cantidades enviadas según stock, conservación de faltantes y limpieza persistente al recargar. En caja verifica vaciado de productos, efectivo y cliente, y persistencia de una selección nueva después de limpiar. Las operaciones usan la base temporal.

Validación de limpieza y pedido parcial: 22 pruebas de Firefox aprobadas, compilación de producción y lint correctos.

## Revisión compacta de cotizaciones · 28 de octubre de 2026

La pantalla que abre «Revisar» agrupa cliente y disponibilidad en dos columnas de escritorio. «Preparar propuesta» está dentro del panel del cliente. El editor alinea artículo solicitado, cantidad y producto elegido; alternativas y observaciones quedan plegadas por renglón. La búsqueda muestra sugerencias al escribir. El pie presenta el total estimado actualizado al cambiar cantidades o productos, la vigencia y las acciones de guardado. En móvil los campos se apilan sin desbordamiento y conservan controles táctiles.

Se ejecutaron las 22 pruebas de Firefox y, después del ajuste final de sugerencias, las cinco pruebas del flujo comercial. Compilación y lint correctos. `node scripts/check-quote-review.mjs` comprueba alineación de resumen y campos, actualización del total, despliegue de alternativas y ancho móvil sobre las listas de ejemplo; no guarda propuestas. Capturas en `backend/data/exposicion/revision-compacta.png` y `revision-compacta-movil.png`.

Se añadieron únicamente tres solicitudes ficticias con productos existentes: primaria (solicitada), secundaria (borrador) y arte (enviada). `node scripts/seed-quote-examples.mjs` conserva las existentes si se repite. Los enlaces privados quedan en `backend/data/exposicion/EJEMPLOS_REVISION.json`. Se comparó con el respaldo `respaldo-antes-revision-compacta-20261028.db`: stock, precios, ventas y movimientos permanecen iguales; integridad SQLite correcta.

## Stock sin información repetida · 29 de octubre de 2026

La selección y el formulario de entrada/ajuste comparten un panel. El selector identifica nombre y código; el resumen muestra una sola vez el stock actual y el costo promedio, junto con la presentación. El costo de compra permanece en el formulario porque corresponde a la nueva entrada. Historial y reposición conservan sus funciones.

## Entrada desde Productos sin cambiar de módulo · 29 de octubre de 2026

«Registrar entrada» en Productos abre un diálogo nativo con el producto seleccionado, stock y costo promedio actuales, cantidad, costo de compra, proveedor sugerido, comprobante y motivo. Guardar cierra el diálogo y refresca la lista conservando filtros y página; cancelar no registra movimientos. Cerrar y Escape quedan bloqueados durante el envío. Un error mantiene el formulario abierto con sus valores. Los campos de compra se comparten con el formulario de Stock.

La prueba `zzzzzz-stock-flow.spec.ts` comprueba la permanencia en Productos, cierre por Escape y devolución del foco, error de servidor sin pérdida del formulario, entrada real con actualización de stock/costo, historial, ajuste, reposición y ancho móvil. Las operaciones comerciales de la prueba usan SQLite temporal. Compilación y lint correctos. Captura: `backend/data/exposicion/entrada-productos-movil.png`.

## Stock: ajustes, historial y reposición · 29 de octubre de 2026

Stock conserva únicamente las pestañas Ajustes, Historial y Reposición. Ajustes pide una diferencia positiva o negativa y su motivo, conserva el costo promedio y rechaza cero. Se retiraron el selector de tipo y los campos de compra de esta pantalla. El acceso general desde Proveedores lleva a Productos.

Reposición abre la misma ventana de entrada usada en Productos, precarga la cantidad sugerida y consulta el producto y proveedor actuales. Guardar mantiene los filtros, actualiza la lista de reposición y refresca los datos de Stock; un artículo deja de aparecer si ya supera su mínimo. Cuando desaparece la fila, el foco vuelve al buscador. Los enlaces antiguos de inventario siguen abriendo Stock por producto, sin precargar cantidades de compra como ajustes.

Validación: seis pruebas de Firefox aprobadas (flujo comercial y flujo de stock), compilación y lint correctos. Se comprobaron entrada desde Productos y desde Reposición sin navegación, recálculo de costo y stock, desaparición de pendientes repuestos, ajustes, historial, rechazo de cantidad cero y presentación móvil. Todas las compras y ajustes de las pruebas se registraron en la base temporal.

## Ajustes integrados en Productos · 29 de octubre de 2026

Los ajustes se trasladaron a la ventana «Ajustar stock» de cada producto. Comparte el diálogo de movimientos con las entradas, pero solo pide diferencia de cantidad y motivo; no consulta proveedores ni envía datos de compra. Conserva costo promedio, validación de cantidad distinta de cero, mensajes de error y restauración del foco al cerrar o actualizar la lista. Stock queda únicamente con Historial y Reposición; sus accesos antiguos abren el historial conservando el producto.

Validación del traslado: seis pruebas de Firefox aprobadas, compilación y lint correctos. La prueba integrada verifica ajuste negativo desde Productos sin navegación, rechazo de cero, conservación del costo, refresco de existencias y foco, ausencia del formulario en Stock, reposición y enlaces antiguos. Captura móvil: `backend/data/exposicion/ajuste-productos-movil.png`. Las modificaciones de inventario de la prueba usan una base temporal.

## Nombres del menú de inventario · 29 de octubre de 2026

El grupo «Productos y stock» pasa a «Inventario». El módulo antes llamado «Stock» se presenta como «Control de inventario», con Historial y Reposición. Se actualizan el título de pantalla, el nombre accesible de sus secciones, los recorridos de navegador y la documentación. Las rutas existentes se conservan.

## Cierre integrado en Caja de ventas · 29 de octubre de 2026

El acceso «Cierre de caja» está en la cabecera de Caja de ventas, solo para administradores; se retiró del menú Gestión. Abre una ventana con resumen de pagos, fondo, gastos/retiros, contado, diferencia, observaciones, reapertura con motivo e historial por fecha. La venta actual y sus datos permanecen al abrir o cerrar la ventana. La ruta anterior `/app/cierres-caja` redirige a `/app/caja?cierre=1`.

Caja consulta `/api/caja/estado` para mostrar abierta/cerrada y bloquear cobros cuando está cerrada o no se puede verificar el estado. Solo devuelve fecha de Lima y un booleano; no expone importes al vendedor. Se refresca cada 30 segundos, al recuperar el foco y después de un cierre/reapertura. El servidor conserva su validación transaccional de ventas y anulaciones con caja cerrada.

Validación: 22 pruebas de Firefox aprobadas; `go test ./...`, `go vet ./...`, compilación y lint correctos. La prueba integrada verifica carrito/efectivo conservados, cierre, bloqueo de venta, reapertura, historial, acceso del vendedor y enlace anterior. La prueba Go comprueba autenticación, método de solo consulta, privacidad y ciclo abierto/cerrado/reabierto. Las operaciones comerciales de las pruebas usan SQLite temporal. Se reinició la aplicación local y `node scripts/check-cash-closing.mjs` verificó el estado y la ventana en escritorio/móvil sin registrar cierres ni ventas en la tienda.

## Cotizaciones y pedidos compactos · 29 de octubre de 2026

Cotizaciones conserva revisión, productos, precios y aprobación. La búsqueda y filtros comparten una franja en la bandeja; «Nueva solicitud» abre un diálogo con contacto, lista y datos opcionales, sin desplazar el listado. La revisión mantiene su editor compacto. Una propuesta aceptada permite crear el pedido; después aparece el enlace al pedido concreto. El formulario de cobro se retiró de Cotizaciones.

Pedidos presenta dos pestañas, «De cotizaciones» y «Del catálogo», con tabla compacta, búsqueda por número/cliente/teléfono y filtros Todos, Pendientes, Preparando, Listos y Finalizados. Búsqueda y estado se aplican en SQLite antes de paginar. Cada fila muestra total, pago y estado; «Abrir» muestra una ventana con productos, faltantes fuera del cobro, observaciones y acciones según estado. Los productos tienen un área de consulta acotada para mantener accesible el total y las acciones. En móvil se presentan renglones compactos sin ocultar cantidades ni importes.

La ventana permite cobrar con confirmación manual e idempotencia, preparar, marcar listo y entregar. Entregar requiere venta activa; catálogo exige además código de recojo. Cancelar un pedido sin pago solicita confirmación. Un pedido de cotización cancelado sin pago puede reactivarse cuando su propuesta está aceptada y vigente. Una venta anulada bloquea las acciones. Los filtros se conservan al cerrar la ventana y el foco vuelve al pedido o al buscador si la fila ya no coincide.

Validación: 24 pruebas de Firefox aprobadas, `go test ./...`, `go vet ./...`, compilación y lint correctos. Go verifica filtros combinados, paginación con más de 30 registros, totales y privacidad de los detalles para ambas fuentes. Navegador comprueba solicitud en ventana, cobro/entrega escolar, pago y código de recojo directo, conservación de filtros y reactivación de pedido. Las operaciones usan SQLite temporal. Se reinició la aplicación y `node scripts/check-lists-orders.mjs` revisó las bandejas y ventanas de escritorio/móvil con datos locales bloqueando las escrituras de negocio. No se añadieron solicitudes ni cobros de ejemplo a la tienda.

Capturas: `cotizaciones-bandeja-compacta.png`, `pedidos-bandeja-compacta.png`, `pedido-cotizacion-compacto.png`, `pedido-cotizacion-compacto-movil.png` y `cotizacion-ventana-real-movil.png`, en `backend/data/exposicion/`.
