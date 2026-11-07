# ÚtilVenta Ayacucho

Sistema para una librería y un almacén en Huamanga, Ayacucho. React + Vite + TypeScript, Bootstrap 5, Go `net/http` y SQLite mediante `modernc.org/sqlite` (sin CGO). Interfaz en español y moneda PEN.

Incluye catálogo público, lectura de listas escolares, cotizaciones revisables, seguimiento mediante enlace privado, pedidos para recoger, clientes, caja de ventas, historial con anulación administrativa, cierre diario y reapertura, reposición por proveedor, respaldos descargables, inventario trazable, usuarios y reportes CSV. Los documentos internos se imprimen o descargan como PDF. No incluye SUNAT, pagos en línea ni reservas de stock.

## Pedidos directos, configuración y respaldos automáticos

El catálogo permite hacer un pedido directo con nombre y teléfono cuando el carrito no tiene faltantes. El servidor valida precios y existencias, evita duplicados y reconoce reintentos. El pedido conserva sus precios y vence sin pago en 24 horas inicialmente; no reserva stock. Su enlace privado muestra el estado y el código de recojo.

En **Listas escolares → Pedidos**, el personal registra el pago, prepara y entrega los pedidos directos con un código de un solo uso. La entrega exige una venta activa y registra responsable y fecha. Una captura de pago no confirma el abono: Yape, Plin y transferencias siguen verificándose manualmente. Los pedidos de cotizaciones escolares se gestionan en la pestaña **De cotizaciones**; los directos están en **Del catálogo**. Cada pedido abre una ventana con sus productos, pago y siguiente acción.

En **Gestión → Configuración**, el administrador edita los datos de la tienda, la vigencia y el intervalo de respaldos. Los respaldos automáticos están activos cada 24 horas mientras Go está encendido y muestran su última ejecución y error. Son copias locales; conserva también una fuera del equipo. Consulta [la operación y reglas completas](docs/PEDIDOS_DIRECTOS.md).

## Cierre del proyecto

Las seis mejoras están documentadas en [Operación y cierre del proyecto](docs/CIERRE_PROYECTO.md): anulaciones con trazabilidad, borradores recuperables, cierre diario, útiles por revisar, reposición y respaldos. Los accesos administrativos están en **Gestión** y **Inventario**. Las ventas anuladas se conservan y se excluyen de los totales vigentes. Una caja cerrada debe reabrirse con motivo antes de registrar ventas o anular una venta de ese día.

## Módulos e historias de usuario

El panel agrupa las funciones en cinco accesos: **Inicio**, **Caja de ventas**, **Listas escolares** (cotizaciones y pedidos), **Inventario** (Productos, Control de inventario y Proveedores) y **Gestión** (clientes, reportes y usuarios). Los submódulos se despliegan por grupo y se muestran según el rol. El historial de ventas está en **Gestión → Reportes**.

Consulta las **[38 historias de usuario con criterios de aceptación](docs/HISTORIAS_DE_USUARIO.md)** para presentar los actores, los procesos y las reglas del sistema.

## Proveedores y marcas · Huamanga

En **Inventario → Proveedores** el administrador registra empresas, RUC opcional (11 dígitos, sin verificación externa), contacto, teléfono, correo, dirección, ciudad y condiciones de compra. La ciudad inicial es Huamanga y se puede cambiar para proveedores de otras localidades. Se pueden editar o desactivar; su historial se conserva.

Cada proveedor admite hasta 30 marcas separadas por comas. La tabla muestra esas marcas y las de sus productos vinculados. La búsqueda encuentra empresas por nombre, RUC, ciudad o marca. En **Productos** se asigna un proveedor principal opcional; la ventana **Registrar entrada**, disponible en Productos y Reposición, permite registrar un proveedor diferente y un comprobante de compra. Los ajustes no llevan proveedor ni comprobante. Una entrada rechazada no modifica stock ni costo promedio. Proveedores inactivos permanecen en los registros anteriores y no admiten nuevas asignaciones.

**Productos** integra categorías en una ventana y filtros de stock bajo, agotados e inactivos. Cada producto permite registrar una entrada o consultar sus movimientos. **Productos** permite ajustar existencias desde la ventana **Ajustar stock**, con diferencia positiva o negativa y motivo obligatorio. **Control de inventario** reúne únicamente historial y reposición. Las compras se registran únicamente en la ventana **Registrar entrada** de Productos o Reposición, conservando la lista y sus filtros. La ventana sugiere el costo promedio y proveedor principal activo; confirma el costo real de compra antes de guardar. Desde reposición también se propone la cantidad necesaria para superar el mínimo y se actualiza la lista al guardar. Los ajustes conservan el costo y exigen motivo. **Proveedores** permite abrir sus productos vinculados. Las rutas anteriores de inventario, categorías y reposición redirigen al nuevo flujo.

El catálogo público y el panel buscan por **nombre, código o marca**. El filtro de marca se combina con la categoría y la búsqueda; las marcas públicas proceden únicamente de productos activos. La marca aparece destacada en cada tarjeta y se conserva en el texto de la solicitud. Los datos de proveedores y costos se consultan solo como administrador. Las fichas iniciales de empresas y marcas usan fuentes públicas documentadas; las asignaciones de productos son ejemplos académicos y se pueden ajustar para una tienda real.

El panel usa un menú flotante con submódulos agrupados y un modo compacto de iconos, activable con el botón junto al logo. La preferencia se conserva en este navegador. En celular se abre como panel superpuesto y se cierra al navegar o con Escape. Las tablas y los controles se adaptan al móvil. Consulta [los siguientes pasos propuestos](docs/SIGUIENTES_PASOS.md) para cerrar la puesta en marcha.

## Cotizar una lista adjunta

El catálogo presenta productos compactos a la izquierda y una lista para cotizar a la derecha. La cotización se realiza en el mismo catálogo: agrega productos o sube tu lista, revisa las cantidades y envía tus datos. La ayuda y las plantillas quedan plegadas debajo del formulario. Se retiraron los cuadros por grado escolar. Permite adjuntar **JPG, PNG, WebP, PDF o TXT de hasta 5 MB**, agregar productos del catálogo y anotar útiles faltantes. Una cantidad mayor al stock se separa entre disponibles y faltantes, sin reservar existencias.

Al subir un TXT, PDF con texto, PDF escaneado o foto impresa, se lee el contenido en el navegador y se compara con todas las páginas del inventario público. Los PDF admiten hasta diez páginas; el texto, hasta 10 000 caracteres y 100 artículos. La lectura de imágenes usa OCR en español con archivos locales, sin enviar documentos a servicios externos. Los artículos con una coincidencia clara aparecen en **Disponibles**; se muestran por separado las cantidades sin stock, los artículos sin coincidencia y aquellos con varias marcas o presentaciones, que necesitan elección manual.

El texto queda editable. **Comparar con inventario** vuelve a analizarlo y reemplaza la selección actual, sin duplicarla. Cada línea puede comenzar por una cantidad: `3 Cuadernos Artesco`. También se admite `Producto;cantidad`. Las fotos deben ser nítidas, de texto impreso; la lectura no garantiza reconocer manuscritos o tablas complejas. Se ofrece una [plantilla TXT](frontend/public/plantilla-lista-escolar.txt). El personal confirma la propuesta antes de aceptar la venta.

`npm run dev` y `npm run build` preparan automáticamente el lector y el modelo español desde las dependencias instaladas. La primera lectura de una imagen puede tardar varios segundos. Referencias técnicas: [PDF.js](https://mozilla.github.io/pdf.js/examples/) y [Tesseract.js: instalación local](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

El archivo, la lista y los renglones se guardan juntos en SQLite. El personal puede descargar el adjunto y recibe una propuesta precargada con disponibles y faltantes, que puede completar. El cliente ve ambos grupos desde su enlace privado. Los archivos no se publican como recursos abiertos; solo los consulta el personal o quien tenga el enlace privado.

## Trabajo final listo para exponer

Abre **http://localhost:5173**. El sistema usa ahora `backend/data/utilventa.db`, sin aviso de modo demo. Conserva el acceso administrativo anterior; consulta el archivo privado `backend/data/ACCESO_PRESENTACION.txt`. La base antigua `presentacion.db` permanece intacta y separada.

Se cargaron **44 productos**, **8 marcas reales** (Artesco, Pilot, Faber-Castell, Standford, Vinifan, Layconsa, UHU y Chamex), **44 fotografías locales**, **6 proveedores reales**, **8 clientes**, **14 ventas**, **6 cotizaciones**, **2 pedidos** y **6 entradas de mercadería** de ejemplo. Los proveedores son Disum, Artesco, Continental/Standford, Tai Loy, Navarrete y Ofimarket.

Las empresas, contactos publicados, marcas y fotos tienen [fuentes documentadas](docs/FUENTES_CATALOGO.md). Precios, stock, clientes y operaciones son ejemplos académicos. La asignación de proveedores a cada producto sirve para mostrar el flujo; no acredita contratos comerciales. No se inventaron contactos o RUC faltantes.

Desde `frontend`, para abrirlo otra vez:

```bash
npm run start
```

Para repetir la carga explícita sin duplicar ventas, restablecer existencias ni cambiar ediciones:

```bash
npm run start -- --seed-examples
```

Consulta el [guion de exposición](PRESENTACION.md). Las fotos se sirven desde `frontend/public/productos`; el catálogo, productos, caja y portada usan fotografías reales. Las ilustraciones solo se conservan como respaldo para productos nuevos sin foto.

## Requisitos

- Go 1.23 o posterior.
- Node.js 22 LTS y npm.
- Acceso a los registros de dependencias durante la primera instalación.
- Python 3 solamente para el script opcional de respaldo/restauración.

No hay contraseñas predeterminadas. Los productos y operaciones de ejemplo se cargan solo por una orden explícita.

## Instalación en Linux

Desde la raíz del proyecto, en una primera terminal:

```bash
cd backend
go mod tidy
go run ./cmd/setup
# Solicita nombre, usuario y contraseña dos veces, sin mostrar la contraseña.
go run ./cmd/server
```

En otra terminal, desde la raíz:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. El catálogo está en `/catalogo` y el ingreso del personal en `/login`. Usa `localhost` (el origen configurado); no alternes con `127.0.0.1` en el navegador.

## Instalación en Windows PowerShell

Primera terminal, desde la raíz:

```powershell
Set-Location backend
go mod tidy
go run ./cmd/setup
go run ./cmd/server
```

Segunda terminal, desde la raíz:

```powershell
Set-Location frontend
npm install
npm run dev
```

## Configuración

`.env.example` documenta las variables; **Go no carga archivos `.env` automáticamente**. Define las variables en la terminal antes de ejecutar setup y servidor. La ruta relativa de la base se resuelve desde el directorio actual: ejecuta ambos comandos desde `backend`.

| Variable     | Predeterminado          | Uso                                               |
| ------------ | ----------------------- | ------------------------------------------------- |
| `PORT`       | `8080`                  | Puerto Go en `127.0.0.1`                          |
| `DB_PATH`    | `data/utilventa.db`     | SQLite, fuera del directorio público              |
| `APP_ENV`    | `development`           | `production` activa cookie Secure; requiere HTTPS |
| `APP_ORIGIN` | `http://localhost:5173` | Origen exacto admitido en escrituras              |

Linux:

```bash
export PORT=8080
export DB_PATH=data/utilventa.db
export APP_ENV=development
export APP_ORIGIN=http://localhost:5173
go run ./cmd/server
```

PowerShell:

```powershell
$env:PORT = '8080'
$env:DB_PATH = 'data/utilventa.db'
$env:APP_ENV = 'development'
$env:APP_ORIGIN = 'http://localhost:5173'
go run ./cmd/server
```

El proxy de desarrollo está en `frontend/vite.config.ts`. Al usar `npm run start`, su destino se calcula automáticamente. Al iniciar los servidores por separado y cambiar `PORT`, define `VITE_API_TARGET` con la dirección correspondiente antes de iniciar Vite. No se ha publicado el sistema. Para un alojamiento futuro hará falta un servidor de archivos con fallback a `index.html` y proxy `/api` al backend, en el mismo origen HTTPS; `vite preview` no es un servidor de producción.

## Migraciones y administrador

Cada archivo SQL de `backend/migrations` se aplica una vez, dentro de una transacción, y se registra en `migraciones`. Se habilitan claves foráneas, WAL y tiempo de espera. Las migraciones se ejecutan al abrir el servidor o setup. También puedes aplicarlas explícitamente:

```bash
cd backend
go run ./cmd/setup migrate
```

`go run ./cmd/setup` crea el primer administrador y rechaza crear otro cuando ya existe uno. Luego se administran empleados en **Usuarios**. Contraseñas de 10 a 72 bytes, bcrypt. Sesiones de ocho horas, hash SHA-256 del token aleatorio, cookie HttpOnly y SameSite=Lax. Los cambios de usuario invalidan sus sesiones. No desactives todas las cuentas administradoras. El sistema impide desactivar o degradar la propia cuenta.

### Carga del catálogo para clase

Después de crear un administrador, el comando siguiente carga las referencias y operaciones de ejemplo:

```bash
cd backend
go run ./cmd/setup ejemplos
```

La carga es explícita y repetible. Las fotos ya forman parte del proyecto; el comando no descarga archivos ni necesita páginas externas. El manifiesto está en `backend/internal/services/school_catalog.json`. Los enlaces de seguimiento se guardan con permisos restringidos en `backend/data/exposicion/ENLACES_LISTAS.md`; son privados y corresponden a las seis listas nuevas de la base habitual.

Los comandos históricos `setup demo` y `--demo` siguen disponibles solo para la antigua base `presentacion.db`; no se utilizan en la exposición actual. La interfaz no muestra avisos ni etiquetas de modo demo.

## Cómo demostrar el flujo

1. Crear administrador, ingresar y registrar productos en **Productos**. El stock inicial deja un movimiento.
2. Registrar una **entrada** con cantidad, costo unitario y motivo desde la ventana **Registrar entrada** de Productos o Reposición. El costo promedio se recalcula. En **Productos → Ajustar stock**, una cantidad positiva suma y una negativa resta existencias, conservando el costo promedio; cero no registra un movimiento.
3. Abrir el catálogo sin sesión, agregar productos o pegar una lista y enviar la solicitud. **Guardar el enlace privado mostrado**: se entrega una sola vez y no se puede reconstruir desde su hash.
4. En **Cotizaciones**, revisar la lista manualmente. Agregar artículos, registrar hasta diez alternativas por artículo, elegir una para el total o marcar el artículo como no disponible. Se conservan los precios históricos de todas las alternativas. Definir vigencia, guardar borrador o enviar.
5. Consultar el enlace privado. El cliente ve la propuesta enviada, puede aceptarla o rechazarla y consultar el pedido. No necesita una cuenta.
6. Desde una propuesta aceptada y vigente, crear un pedido y pulsar **Ver pedido**. En **Pedidos → De cotizaciones**, abrirlo y usar **Preparar pedido** y **Marcar listo**. Cobrar desde la ventana del pedido; entregar exige pago registrado. Preparar no reserva ni descuenta stock.
7. Registrar el pago y convertir la propuesta en venta. Se respetan los precios enviados y se comprueban nuevamente productos activos y stock. Si falta stock, resolver con inventario o crear una revisión y obtener nueva aceptación.
8. Entregar el pedido solo después de vincular una venta pagada. También se puede vender directamente en **Caja**, con cliente registrado o consumidor final.

La caja ofrece **Consumidor final**, **Persona** y **Empresa con RUC**. El primero permite cobrar sin crear una ficha. Para una persona basta el nombre; documento, teléfono y dirección son opcionales. Para una empresa se pide razón social, un RUC con formato de 11 dígitos y dirección (no se consulta SUNAT). **Nuevo cliente** permite registrarlo y seleccionarlo sin abandonar la caja ni perder el carrito. Se puede buscar por nombre, documento o teléfono, con paginación. Las ventas guardan una copia del nombre, documento y dirección que se muestra en el comprobante interno y PDF; editar la ficha después no cambia esa copia.
9. Consultar reportes por fechas y descargar CSV. En ventas, abrir el número para ver el documento histórico.

Las solicitudes crean o reutilizan una ficha de cliente por nombre y teléfono exactos, sin crear cuentas públicas. La venta convertida conserva esa vinculación para el historial.

Una revisión de una propuesta enviada crea otra versión, invalida la aceptación anterior y cancela la preparación previa sin pago. Reactiva el pedido existente desde **Pedidos** una vez aceptada la nueva revisión. Una cotización convertida no se modifica ni se convierte otra vez. Las ventas no se editan ni se eliminan.

Yape, Plin y transferencia son **registros manuales**. El personal debe comprobar el abono antes de registrar la venta. El sistema no verifica pagos. En efectivo valida recibido y calcula vuelto.

## Dinero, stock y fechas

- Base de datos: enteros en céntimos. API de formularios: texto decimal, por ejemplo `"3.50"`; respuestas: `350`.
- Máximo por importe/venta: S/ 1 000 000.00. Stock y cantidades: máximo 1 000 000; máximo 100 líneas por venta o propuesta.
- Costo promedio de entrada: `(stock × costo anterior + entrada × costo nuevo) / nuevo stock`, con redondeo al céntimo más cercano y empate hacia arriba. Se usa aritmética entera.
- Una conexión SQLite serializa las transacciones de esta tienda. Cada salida usa además un `UPDATE ... WHERE stock >= cantidad`; ventas, detalles y movimientos se confirman o revierten juntos.
- Los precios y costos históricos se conservan en los detalles. El costo usado es el vigente al concretar la venta; el precio de una cotización enviada se conserva en su revisión.
- Fechas UTC RFC3339. Filtros inclusivos por días de America/Lima, convertidos a un intervalo UTC de inicio inclusivo y fin exclusivo. La vigencia termina a las 23:59:59 de Lima.
- El margen bruto resta el costo histórico; **no descuenta gastos operativos**.

## Permisos y API

Consulta [docs/API.md](docs/API.md). Las escrituras requieren JSON y cabecera `Origin` igual a `APP_ORIGIN`. El frontend utiliza cookies del mismo origen. No se habilita CORS. Solicitudes públicas y login tienen límite por IP; no se confía en `X-Forwarded-For`.

Imágenes mediante ruta local controlada `/productos/archivo.jpg` (también PNG, WebP o AVIF) o URL HTTPS; las listas escolares sí permiten adjuntar un archivo privado con los formatos y límites indicados arriba. No ingreses enlaces con información privada. Sin imagen se muestra un marcador visual.

## Verificación

Backend, desde `backend`:

```bash
go test ./...
go vet ./...
# Opcional, con Go instalado y plataforma compatible:
go test -race ./...
```

Frontend, desde `frontend`:

```bash
npm run build
npm run lint
```

Las pruebas del backend cubren autenticación y expiración, permisos, CSRF, hash de sesión, importes, stock insuficiente, rechazo de cantidades y productos inactivos, transacciones, concurrencia, idempotencia, precios/costos históricos, revisiones, vencimiento, enlaces privados, conversión única, pedidos, costo ponderado y fechas de Lima.

**Estado de esta entrega:** se instalaron las herramientas en directorios temporales del entorno y se generaron `backend/go.sum` y `frontend/package-lock.json`. Pasaron `go test ./...`, `go test -race ./...`, `go vet ./...`, `npm run build`, `npm run lint` y `python scripts/check_sqlite.py`.

Las **tres pruebas de Playwright en Firefox también pasaron**, incluyendo el recorrido completo y las restricciones del vendedor. Se usaron puertos de pruebas separados (8082 y 5174), una base temporal y servidores cerrados al finalizar. La demostración abierta usa 8081 y 5173; el puerto 8080 pertenece a otra aplicación y se conserva.

Para repetir las pruebas en tu equipo, desde `frontend`:

```bash
npm run test:e2e:install
npm run test:e2e
```

Necesita Go en `PATH` y los puertos 8082 y 5174 libres. Puedes cambiarlos mediante `E2E_API_PORT` y `E2E_WEB_PORT`. En esta sesión, con las herramientas temporales instaladas, también funciona `npm run start -- --tests`.

Playwright crea automáticamente Go, Vite y una base temporal. Sus credenciales son exclusivas de los tests y nunca se cargan en la base de la tienda. Se verificaron productos, solicitud pública, alternativas, aceptación, pedido, cobro, entrega, PDF, CSV, vista móvil y permisos del vendedor. También se comprobó en Firefox el servidor real de presentación; las capturas y documentos están en `backend/data/presentacion/`.

Para revisar la base habitual abierta sin registrar operaciones comerciales, desde `frontend`, ejecuta `npm run start -- --check`. Comprueba catálogo, fotografías, filtros, panel, caja, proveedores y vista móvil. Requiere la carga de exposición y su archivo privado de acceso. El recorrido histórico con operaciones sigue reservado a `npm run start -- --demo --check`.

La aplicación se ha validado para demostración local; no se ha publicado ni se ha evaluado un despliegue de producción. Los resultados están en [docs/VERIFICACION.md](docs/VERIFICACION.md).

## Respaldo y restauración segura

No copies únicamente el `.db` mientras SQLite está activo: puede haber cambios en WAL. El script usa la API online backup de SQLite y verifica integridad; funciona con el servidor activo. Desde la raíz, con Python 3 (en Windows puede usarse `py` en vez de `python`):

```bash
python scripts/backup.py backend/data/utilventa.db respaldo-2026-10-27.db
```

No sobrescribe destinos existentes y crea los archivos con permisos 0600 en sistemas POSIX. Protege los respaldos: contienen información personal y hashes.

Para restaurar, detén primero Go, restaura en **un nombre nuevo**, y configura el servidor con esa ruta:

```bash
python scripts/backup.py respaldo-2026-10-27.db backend/data/restaurada.db
cd backend
# Linux:
export DB_PATH=data/restaurada.db
go run ./cmd/server
```

PowerShell, después de ejecutar el mismo script y entrar en `backend`:

```powershell
$env:DB_PATH = 'data/restaurada.db'
go run ./cmd/server
```

La base anterior se conserva. Comprueba usuarios, inventario y últimas ventas tras restaurar. Un respaldo recupera el estado completo, incluidas sesiones no vencidas: almacénalo bajo acceso restringido.

La bandeja de Listas escolares permite filtrar por listas por revisar, enviadas, aceptadas y finalizadas. La búsqueda encuentra nombre, teléfono o número; los filtros se aplican antes de paginar. Las propuestas vencidas se clasifican por su vigencia actual. El detalle muestra revisión, aceptación, pago y recojo junto al siguiente paso, respetando las validaciones existentes de stock y cobro.

**Limpiar todo** vacía la selección del catálogo, sus faltantes, texto y archivo, conservando los datos de contacto. En caja vacía productos y reinicia cliente, medio de pago y efectivo recibido; el nuevo carrito vuelve a guardarse normalmente. No modifica ventas o pedidos existentes.

El pedido directo admite una lista ya revisada, aunque conserve texto o archivo. Si hay faltantes o cantidades parcialmente disponibles, el cliente debe marcar **Pedir solo los disponibles**. Se envían únicamente cantidades con stock; tras confirmar, los pendientes quedan en la lista, su texto se actualiza y el adjunto se conserva si aún hay pendientes. El servidor sigue comprobando precios y disponibilidad. El texto modificado requiere una nueva revisión antes de pedir.


El cierre diario se abre con **Caja de ventas → Cierre de caja**, solo para administradores. La ventana permite cerrar, reabrir con motivo y consultar el historial por fecha sin perder los productos, el cliente ni el efectivo de la venta en curso. Caja muestra su estado y deshabilita el cobro cuando está cerrada; el servidor también rechaza ventas. El estado se actualiza al cerrar/reabrir, al recuperar el foco y cada 30 segundos. Los vendedores consultan únicamente si la caja está abierta, sin acceso a importes del cierre. El enlace antiguo `/app/cierres-caja` abre esta ventana dentro de Caja.


**Listas escolares:** Cotizaciones mantiene revisión, precios y aprobación; **Nueva solicitud** abre una ventana sobre la bandeja. Pedidos concentra cobro, preparación y entrega, con pestañas **De cotizaciones** y **Del catálogo**. Ambas tienen búsqueda por número/cliente/teléfono y filtros Todos, Pendientes, Preparando, Listos y Finalizados, aplicados en el servidor antes de paginar. La ventana del pedido muestra productos, faltantes fuera del cobro, total y acciones según estado. El código de recojo se solicita para entregar pedidos del catálogo. Un pedido escolar cancelado sin pago puede reactivarse tras la aceptación vigente de la propuesta. Las ventas anuladas bloquean preparación y entrega.
