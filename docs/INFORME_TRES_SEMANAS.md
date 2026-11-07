# Informe de actividades del proyecto · tres semanas

## Datos generales

- **Proyecto:** Sistema web de ventas, inventario y listas escolares — ÚtilVenta Ayacucho
- **Estudiante:** [Nombre completo]
- **Institución / curso:** [Completar]
- **Docente / asesor:** [Completar]
- **Periodo:** [Fecha de inicio] al [Fecha de término]
- **Lugar:** Huamanga, Ayacucho

> **Antes de entregar:** el repositorio describe las funciones y validaciones del sistema, pero no contiene una bitácora que confirme las actividades de cada semana. La distribución de abajo es una propuesta por fases; ajusta fechas, actividades y resultados a lo que realizaste realmente.

## Resumen

Se implementó un sistema web para apoyar la operación de una librería y tienda de útiles escolares. La aplicación reúne catálogo, ventas, clientes, cotizaciones de listas escolares, pedidos para recoger, proveedores, inventario y reportes. Se construyó con React, TypeScript y Vite en el frontend; Go en el backend; y SQLite para almacenar la información. La interfaz está en español y presenta importes en soles.

El catálogo académico documentado contiene 44 productos, 8 marcas y 44 fotografías locales. También incluye seis fichas de proveedores y operaciones de ejemplo para mostrar los flujos. Los precios, existencias, clientes y operaciones de demostración no representan actividad comercial real.

## 1. Introducción

Una librería necesita consultar productos, responder solicitudes de listas escolares, registrar ventas y mantener existencias actualizadas. Cuando esas tareas se llevan en registros separados, puede ser difícil saber qué productos están disponibles, qué pedidos siguen pendientes y qué movimientos modificaron el stock.

El proyecto ÚtilVenta Ayacucho integra esos procesos en una sola aplicación. El cliente puede explorar el catálogo y solicitar una cotización; el personal administra ventas, pedidos y productos; y el administrador revisa reportes, movimientos, proveedores, cierres y respaldos.

## 2. Objetivos

### Objetivo general

Desarrollar un sistema web que centralice la venta de útiles escolares, la atención de listas y el control de inventario de una librería.

### Objetivos específicos

- Organizar un catálogo con búsqueda por nombre, código, categoría y marca.
- Registrar ventas y actualizar existencias con validaciones.
- Facilitar la recepción y revisión de listas escolares para preparar cotizaciones.
- Gestionar pedidos, clientes y proveedores desde el panel del personal.
- Registrar entradas, ajustes y reposiciones, manteniendo un historial de movimientos.
- Consultar ventas y operaciones mediante reportes y cierres de caja.

## 3. Herramientas y metodología

El trabajo se organizó en tres fases: definición de necesidades y catálogo; construcción de los flujos de venta y listas escolares; y consolidación del inventario, reportes y controles administrativos. Se utilizó una arquitectura cliente-servidor: React, TypeScript y Vite presentan la interfaz; Go valida las solicitudes y las reglas del negocio; SQLite conserva productos, clientes, ventas y movimientos. Para leer listas adjuntas se usan herramientas locales de lectura de PDF y OCR en español.

## 4. Actividades por semana

### Semana 1 · Análisis, estructura y catálogo

**Objetivo de la semana:** definir los procesos principales y preparar la base de la aplicación.

**Actividades propuestas según las funciones documentadas:**

1. Identificar las necesidades de una librería: búsqueda de útiles, consulta de stock, venta, cotización de listas y seguimiento de pedidos.
2. Definir los módulos y los roles del personal, vendedor y administrador.
3. Preparar la estructura del frontend, backend y base de datos.
4. Crear el catálogo con productos, categorías, códigos, marcas, precios de ejemplo e imágenes locales.
5. Incorporar la administración de productos y fichas de proveedores.

**Resultado:** quedó organizada la base del sistema y se preparó un catálogo de demostración con 44 productos, ocho marcas y fotografías almacenadas localmente. La administración permite buscar y filtrar productos y consultar stock y proveedor.

**Evidencia 1.** Pantalla de productos con filtros y fotografías del catálogo.

![Administración de productos de ÚtilVenta](../backend/data/exposicion/productos-fotos.png)

*Figura 1. Módulo de productos. La información visible corresponde a datos de demostración.*

### Semana 2 · Ventas, listas escolares y pedidos

**Objetivo de la semana:** conectar la atención al cliente con los procesos de cotización y venta.

**Actividades propuestas según las funciones documentadas:**

1. Implementar la caja de ventas y el registro de clientes.
2. Permitir que el cliente agregue productos del catálogo y solicite la cotización de una lista.
3. Admitir listas adjuntas en imagen, PDF o texto; comparar los artículos reconocidos con el inventario y separar disponibles, faltantes y coincidencias que requieren revisión.
4. Crear el flujo interno para revisar solicitudes, preparar propuestas y consultar su estado mediante un enlace privado.
5. Gestionar pedidos para recoger, su pago registrado por el personal y la confirmación de entrega.

**Resultado:** el cliente puede armar una lista desde el catálogo o adjuntar un archivo; el personal puede revisar la solicitud, preparar una cotización y gestionar el pedido. La lectura de imagen usa OCR local en español; el texto reconocido debe revisarse antes de confirmar una propuesta.

**Evidencia 2.** Bandeja interna para consultar y revisar solicitudes de cotización.

![Bandeja de listas escolares y cotizaciones](../backend/data/exposicion/listas-escolares.png)

*Figura 2. Módulo de listas escolares y cotizaciones. Los registros de la captura son ejemplos de presentación.*

### Semana 3 · Inventario, reportes y cierre

**Objetivo de la semana:** reforzar el control de existencias y completar las funciones de seguimiento administrativo.

**Actividades propuestas según las funciones documentadas:**

1. Registrar entradas de mercadería con cantidad, costo, proveedor y comprobante opcional.
2. Permitir ajustes de stock con motivo e historial de movimientos.
3. Agregar alertas y una lista de reposición para productos en el mínimo o por debajo.
4. Incorporar reportes de ventas, anulación administrativa con trazabilidad y cierre/reapertura diaria de caja.
5. Añadir respaldos de la base de datos y revisar las pantallas en tamaños de escritorio y móvil.
6. Verificar los flujos y documentar los límites del sistema.

**Resultado:** el panel reúne el historial y la reposición de inventario, las ventas y reportes, y los controles de cierre y respaldo. Los movimientos y las ventas conservan datos históricos para facilitar su seguimiento.

**Evidencia 3.** Formulario de cierre diario de caja.

![Cierre diario de caja en ÚtilVenta](../backend/data/exposicion/cierre-integrado-real.png)

*Figura 3. Ventana de cierre de caja, con resumen por medio de pago y registro del efectivo contado. La captura corresponde al entorno de demostración.*

**Evidencia 4.** Registro de entradas y control de existencias.

![Registro de entrada de mercadería](../backend/data/exposicion/stock-integrado.png)

*Figura 4. Registro de una entrada de inventario con costo y proveedor.*

## 5. Resultados generales

- Se integraron catálogo público, caja, clientes, listas escolares, cotizaciones, pedidos, productos, proveedores, inventario, gestión y reportes.
- El sistema valida existencias al registrar una venta y conserva el historial de movimientos de inventario.
- Los artículos con coincidencia ambigua en una lista pueden revisarse antes de cotizar.
- El acceso a datos internos, como costos y proveedores, depende del rol del usuario.
- Se documentaron verificaciones del backend, compilación y revisión de interfaz, además de recorridos funcionales con datos temporales.
- La base académica de exposición tiene 44 productos, ocho marcas, 44 fotografías, seis proveedores y registros comerciales de ejemplo.

## 6. Dificultades y soluciones

| Dificultad | Solución aplicada |
|---|---|
| Los nombres de una lista escolar pueden no coincidir exactamente con los productos. | Se comparan los artículos con el catálogo y se separan las coincidencias ambiguas o no encontradas para revisión manual. |
| El stock debe mantenerse coherente entre ventas y almacén. | Las operaciones validan existencias y registran los movimientos junto con la operación correspondiente. |
| Una foto o documento puede leerse con errores. | El texto reconocido queda editable y el personal revisa la propuesta antes de confirmarla. |
| Las operaciones requieren control y recuperación. | Se agregaron cierres de caja, historial de acciones y respaldos descargables. |

## 7. Conclusiones

1. La aplicación reúne en un mismo sistema procesos que suelen manejarse por separado: venta, cotización, pedido e inventario.
2. El catálogo y la lectura asistida de listas ayudan a preparar solicitudes escolares con mayor orden, manteniendo una revisión humana antes de concretar la cotización.
3. El historial de movimientos, los reportes y los cierres de caja ofrecen herramientas para supervisar las operaciones registradas.
4. La aplicación está preparada como entrega académica local; antes de operar con una tienda real se deben ingresar datos comerciales, precios y existencias reales, y configurar un entorno de alojamiento y copias externas.

## 8. Recomendaciones

- Confirmar productos, precios, costos, mínimos y datos de proveedores antes de usar el sistema con información real.
- Capacitar al personal para verificar pagos digitales, revisar listas reconocidas y registrar motivos de ajustes o reaperturas.
- Conservar respaldos fuera del equipo donde corre el servidor y comprobar periódicamente que se puedan restaurar.
- Si se publica el sistema, preparar HTTPS, alojamiento permanente y configuración de producción.

## 9. Límites del alcance

El sistema no incluye facturación electrónica SUNAT, pagos en línea ni reserva de stock. Yape, Plin y las transferencias se registran manualmente y el personal debe confirmar el abono. Los datos de clientes, precios, existencias y operaciones de demostración no deben presentarse como transacciones reales.

## 10. Fuentes consultadas en el proyecto

- `README.md`: módulos, instalación, alcance y reglas de operación.
- `docs/HISTORIAS_DE_USUARIO.md`: necesidades y criterios de aceptación.
- `docs/VERIFICACION.md`: registro de verificaciones documentadas.
- `docs/CIERRE_PROYECTO.md`: historial, inventario, cierres y respaldos.
- `docs/FUENTES_CATALOGO.md`: referencias de productos, fotografías y proveedores.
- `PRESENTACION.md`: contenido de la entrega y recorrido de demostración.
