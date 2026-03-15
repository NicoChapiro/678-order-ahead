# Reglas de Wallet (Dinero Prepago)

## 1. Principios
- Wallet es dinero real del cliente y no expira.
- El saldo disponible se calcula desde un ledger de transacciones inmutable.
- No se permite modificar o borrar transacciones históricas.
- Correcciones se realizan con transacciones compensatorias.

## 2. Modelo de transacciones
Tipos mínimos recomendados:
- `TOPUP_CREDIT`: carga de saldo.
- `ORDER_CREATED_DEBIT`: débito al crear pedido.
- `ORDER_REVERSAL_CREDIT`: devolución por rechazo/cancelación.
- `MANUAL_ADJUSTMENT_CREDIT` / `MANUAL_ADJUSTMENT_DEBIT`: ajustes administrativos.

Campos críticos por transacción:
- `transaction_id` (UUID)
- `user_id`
- `order_id` (nullable)
- `amount` (decimal positivo)
- `direction` (`CREDIT`/`DEBIT`)
- `type`
- `idempotency_key` (única por operación de negocio)
- `created_at`
- `metadata` (motivo, actor, canal)

## 3. Reglas de negocio obligatorias
1. Todo débito de orden valida saldo suficiente antes de confirmar.
2. Si no hay saldo suficiente, la orden no se crea.
3. Toda reversión debe apuntar a la orden origen.
4. No se revierte en no-show v1.
5. Doble procesamiento del mismo evento no puede duplicar movimientos.

## 4. Idempotencia y concurrencia
- Definir `idempotency_key` por operación (ej. `order:{id}:debit`, `order:{id}:reversal`).
- Crear índice único sobre (`user_id`, `idempotency_key`).
- Usar transacción DB para:
  1. validar saldo,
  2. insertar movimiento,
  3. actualizar proyección de saldo (si existe snapshot).
- En alta concurrencia, serializar por `user_id` o usar bloqueo optimista robusto.

## 5. Flujo financiero por orden
1. **Create Order**
   - Débito inmediato wallet por total de orden.
2. **Reject Order**
   - Crédito por mismo total.
3. **Cancel Order (<=5 min)**
   - Crédito por mismo total.
4. **No-show**
   - Sin crédito.

## 6. Auditoría y cumplimiento
- Cada transacción debe ser trazable a un evento de negocio.
- Exponer historial legible para cliente (fecha, concepto, monto, signo).
- Registrar actor y motivo en ajustes manuales.
- Mantener bitácora apta para conciliación diaria por tienda/sistema.

## 7. Métricas operativas sugeridas
- Volumen diario de topups.
- Órdenes fallidas por saldo insuficiente.
- Ratio de reversión (reversals / debits).
- Diferencia de conciliación (debe tender a cero).
- Latencia p95 de operación de débito/reversión.
