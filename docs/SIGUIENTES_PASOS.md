# Cierre del sistema · 28 de octubre de 2026

La entrega incluye ventas, inventario, clientes, proveedores, cotizaciones, pedidos escolares y directos, reportes, anulaciones, cierre de caja, configuración del negocio y respaldos manuales y automáticos. Buscar, categoría y marca permanecen en una fila, sin filtros duplicados.

El cierre nuevo se describe en [Pedidos directos y operación segura](PEDIDOS_DIRECTOS.md). Los resultados comprobados están en [VERIFICACION.md](VERIFICACION.md).

## Funciones de cierre implementadas

- Pedido directo desde el catálogo sin cuenta pública, con enlace privado de seguimiento.
- Precios y stock validados por el servidor, reintentos seguros y límites contra duplicados y abuso.
- Vencimiento de pedidos sin pago, sin bloquear existencias.
- Pago registrado por el personal y entrega con código de un solo uso para pedidos directos, con responsable y fecha.
- Configuración comercial editable por administrador y con historial de cambios.
- Respaldos locales automáticos mientras el servidor está encendido, estado de última ejecución y errores visibles.

## Antes de operar una tienda real

| Pendiente | Acción del negocio |
| --- | --- |
| Datos comerciales | Completar nombre, logo opcional, dirección de recojo, teléfono y horario desde Gestión → Configuración. |
| Inventario inicial | Acordar una puesta en marcha con precios, costos y existencias reales, conservando la base académica por separado. No borrar operaciones para empezar sin un respaldo y un procedimiento acordado. |
| Personal | Practicar recepción, venta, verificación de abonos, recojo con código, anulación y cierre en una base de práctica. |
| Recuperación | Elegir responsable y frecuencia; guardar una copia fuera del equipo y probar restauraciones periódicas. Las copias locales no protegen contra la pérdida del equipo completo. |
| Entorno permanente | Instalar las herramientas del README de forma estable. Si se publicará, preparar alojamiento, dominio, HTTPS, mismo origen para interfaz/API y arranque permanente. El entorno abierto es local y usa Vite de desarrollo. |

No se cargaron datos comerciales inventados ni pedidos de prueba en la base de la tienda.

## Otra etapa, si el negocio la requiere

Compras con cuentas por pagar; devoluciones parciales; facturación electrónica; verificación automática de pagos mediante una pasarela; avisos por SMS o WhatsApp. Los pagos digitales actuales requieren comprobación del personal. No hay reservas de stock y los documentos emitidos son internos.
