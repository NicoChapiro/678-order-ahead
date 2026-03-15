# Plan de Implementación v1 (Orientado a Producción)

## 1. Estrategia general
Implementar en verticales de negocio con entregas incrementales, priorizando primero la consistencia financiera (wallet + estados de orden), luego operación de tienda y finalmente loyalty.

## 2. Fases y entregables

### Fase 0 — Fundaciones técnicas
**Objetivo:** dejar lista la base para construir de forma segura.

Entregables:
- Modelo de roles y autorización (`owner`, `barista`, `customer`).
- Estructura multi-tienda (aunque haya una activa).
- Auditoría base (tabla/eventos de acciones críticas).
- Soporte de idempotencia y `correlation_id` transversal.

Criterio de salida:
- Se pueden crear entidades de tienda/usuario con permisos correctos y auditoría funcional.

### Fase 1 — Wallet primero
**Objetivo:** garantizar integridad del dinero prepago.

Entregables:
- Ledger inmutable de wallet.
- API de top-up (interna o backoffice para pruebas v1).
- API/servicio de débito y reversión idempotente.
- Consulta de saldo e historial.

Criterio de salida:
- Débitos/reversiones pasan pruebas de concurrencia e idempotencia.

### Fase 2 — Núcleo de order-ahead
**Objetivo:** crear, aceptar/rechazar y cancelar órdenes con reglas v1.

Entregables:
- Creación de orden por tienda con validación de stock y ventana 10/15 min.
- Estado inicial `PENDING_ACCEPTANCE` con pago wallet obligatorio.
- Backoffice staff para aceptar/rechazar manualmente.
- Cancelación por cliente dentro de 5 min.
- Reversión wallet automática en rechazo/cancelación.
- Registro de no-show (sin reversión) y contador por cliente.

Criterio de salida:
- Máquina de estados protegida por reglas de dominio + pruebas de transición.

### Fase 3 — Menú y operación por tienda
**Objetivo:** habilitar operación real diferenciada por tienda.

Entregables:
- CRUD de menú por tienda: productos, precios, stock, horarios.
- Toggle de order-ahead por tienda (owner/barista).
- Dashboard cliente con disponibilidad clara de order-ahead.
- Validaciones de capacidad por ventana (si se activa cupo).

Criterio de salida:
- Dos tiendas de prueba con menús distintos operan sin interferencias.

### Fase 4 — Loyalty v1
**Objetivo:** incentivar recurrencia con reglas simples y auditables.

Entregables:
- Cuenta de puntos y ledger de transacciones de loyalty.
- Reglas de acumulación por orden, por producto y ajuste manual.
- Canje v1 de bebida gratis.
- Visualización de saldo de puntos e historial.

Criterio de salida:
- Flujo completo acumular/canjear validado end-to-end.

### Fase 5 — Hardening y go-live
**Objetivo:** preparar operación estable en producción.

Entregables:
- Monitoreo (métricas, logs estructurados, alertas).
- Jobs operativos (detección de órdenes estancadas, reportes diarios).
- Suite de pruebas E2E de casos críticos.
- Runbooks de incidentes (wallet, stock, cola de órdenes).

Criterio de salida:
- Checklists de salida en verde y piloto controlado en tienda inicial.

## 3. Matriz de pruebas críticas
1. Crear orden con saldo exacto.
2. Crear orden con saldo insuficiente (debe fallar).
3. Reintento de débito con mismo idempotency key (sin duplicado).
4. Rechazo de orden revierte wallet una sola vez.
5. Cancelación a los 4m59s permitida y revierte.
6. Cancelación a los 5m01s denegada.
7. No-show no genera reversión.
8. Cambio de toggle order-ahead impacta dashboard y bloqueo de nuevas órdenes.
9. Dos clientes comprando último stock (evitar sobreventa).

## 4. Riesgos técnicos y plan de mitigación
- **Concurrencia de stock/wallet:** usar transacciones atómicas + índices únicos + pruebas de carrera.
- **Estados inválidos de orden:** guardas de dominio y pruebas de contrato.
- **Errores operativos staff:** UX con confirmaciones y motivos obligatorios en rechazo/no-show.
- **Escalado multi-tienda:** particionar métricas y consultas por `store_id` desde el inicio.

## 5. Definición de listo para producción (DoR/DoD)
### DoR por historia
- Regla de negocio documentada.
- Eventos y auditoría definidos.
- Criterios de aceptación y pruebas identificadas.

### DoD por historia
- Pruebas unitarias + integración + E2E de camino crítico.
- Observabilidad (logs/métricas) incorporada.
- Feature flag/toggle cuando aplique.
- Documentación técnica y operativa actualizada.
