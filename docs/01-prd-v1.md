# PRD v1 — Sistema de Order-Ahead, Wallet y Loyalty

## 1. Resumen ejecutivo
Este documento define la versión 1 (v1) del sistema para una cafetería con compra anticipada (order-ahead), billetera prepaga (wallet) y programa de puntos (loyalty). El objetivo es reducir filas, asegurar el cobro por anticipado y entregar una base operativa robusta para escalar de 1 a 3 tiendas.

## 2. Objetivos de negocio
- Incrementar ventas en horas pico mediante pedidos anticipados con retiro en tienda.
- Asegurar pago 100% anticipado con saldo wallet para minimizar contracargos y tiempos en caja.
- Mejorar recurrencia con acumulación de puntos y canje por bebida gratis.
- Operar de forma segura con control manual del staff (aceptación/rechazo por orden).

## 3. Alcance v1
### Incluye
- Registro/login principal por teléfono.
- 1 tienda inicial (arquitectura preparada para 3).
- Pedido con retiro en una tienda específica.
- Ventanas de retiro fijas de 10 o 15 minutos.
- Pago exclusivo con wallet prepago.
- Activación/desactivación manual de order-ahead por tienda.
- Aceptación manual de cada orden por barista/owner.
- Cancelación por cliente dentro de los primeros 5 minutos.
- Reversión de wallet en cancelación o rechazo.
- Regla no-show v1: pedido perdido (sin reembolso), sólo contador.
- Menú por tienda con variación de productos, precios, stock y horarios.
- Roles: owner, barista, customer.
- Puntos por orden, por producto y ajuste manual.
- Recompensa v1: bebida gratis.

### Excluye (fuera de v1)
- Pago con tarjeta/efectivo para order-ahead.
- Delivery.
- Cupones complejos, niveles gamificados o catálogo de recompensas avanzado.
- Reembolso automático por no-show.

## 4. Usuarios y necesidades
### Customer
- Ver si order-ahead está disponible antes de iniciar pedido.
- Seleccionar tienda, productos y ventana de retiro disponible.
- Pagar con saldo wallet y recibir confirmación.
- Cancelar rápidamente si se equivocó (hasta 5 minutos).
- Ver saldo, movimientos y puntos.

### Barista
- Activar/desactivar order-ahead según capacidad operativa.
- Revisar cola de órdenes y aceptarlas/rechazarlas manualmente.
- Registrar no-show al vencer ventana de retiro.

### Owner
- Configurar reglas por tienda (ventanas, horarios, menú, stock).
- Consultar métricas operativas: aceptación, rechazo, cancelación, no-show.
- Ajustar puntos manualmente por incidencias o promociones.

## 5. Requerimientos funcionales
1. **Autenticación por teléfono**
   - El teléfono identifica al cliente de forma única.
   - Debe existir verificación de propiedad (OTP o proveedor equivalente).

2. **Selección de tienda y disponibilidad**
   - El cliente elige tienda antes de armar pedido.
   - Dashboard muestra estado de order-ahead por tienda de manera prominente.

3. **Menú por tienda**
   - Cada tienda mantiene su propio catálogo, precios, stock y franjas activas.

4. **Checkout con wallet**
   - Si saldo wallet < total, no se puede crear orden.
   - Si saldo wallet >= total, se descuenta al crear orden.

5. **Aprobación manual de orden**
   - Toda orden creada inicia en estado `PENDING_ACCEPTANCE`.
   - Staff debe pasarla a aceptada o rechazada.

6. **Cancelación por cliente (5 min)**
   - Permitida hasta 5 minutos desde `created_at`.
   - Al cancelar, se revierte wallet inmediatamente.

7. **Rechazo por staff**
   - Al rechazar, se revierte wallet inmediatamente.

8. **No-show v1**
   - Si cliente no retira, se marca no-show.
   - No hay devolución en v1.
   - Se incrementa contador de no-show por cliente.

9. **Loyalty**
   - Acumulación por orden (monto/condición), por producto y ajuste manual.
   - Canje v1 disponible: una bebida gratis bajo reglas configurables.

## 6. Requerimientos no funcionales
- **Consistencia financiera:** operaciones wallet deben ser atómicas e idempotentes.
- **Trazabilidad:** auditoría completa de cambios de estado de orden, wallet y puntos.
- **Concurrencia:** evitar sobreventa por stock con bloqueo lógico/transaccional.
- **Escalabilidad:** diseño multi-tienda desde inicio, aunque se opere una.
- **Observabilidad:** métricas y logs estructurados por tienda y estado.
- **Seguridad:** control estricto por roles y minimización de datos sensibles.

## 7. KPIs sugeridos para v1
- Tasa de adopción order-ahead (% órdenes anticipadas / órdenes totales).
- Tasa de aceptación de órdenes.
- Tasa de cancelación en 5 minutos.
- Tasa de rechazo por tienda y franja horaria.
- Tasa de no-show.
- Tiempo medio de aceptación por staff.
- Recompensas canjeadas vs puntos emitidos.

## 8. Riesgos y mitigaciones
- **Riesgo:** picos operativos superan capacidad de preparación.  
  **Mitigación:** toggle de order-ahead por tienda + ventanas de retiro y cupos.
- **Riesgo:** errores de reversión wallet.  
  **Mitigación:** ledger inmutable e idempotencia por evento.
- **Riesgo:** frustración por órdenes rechazadas.  
  **Mitigación:** SLA interno de aceptación y comunicación clara en UI.

## 9. Criterios de aceptación de producto (alto nivel)
- Cliente puede crear orden y pagar sólo con wallet.
- Staff puede aceptar/rechazar cada orden manualmente.
- Cancelaciones dentro de 5 min revierten saldo.
- Rechazos revierten saldo.
- No-show queda registrado sin reversión.
- Dashboard refleja disponibilidad de order-ahead por tienda.
