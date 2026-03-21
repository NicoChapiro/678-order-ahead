# 678-order-ahead

Base técnica de producción para una plataforma **order-ahead + wallet + loyalty**.

> Este commit **no** implementa módulos de negocio; sólo deja la fundación tecnológica y la estructura inicial para un sistema transaccional.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Drizzle ORM
- Zod (validación de entorno)
- PWA (`next-pwa`)
- Testing: Vitest + Testing Library + Playwright
- Calidad: ESLint + Prettier

## Estructura principal

```txt
src/
  app/
    (client)/client/page.tsx
    (admin)/admin/page.tsx
    layout.tsx
    page.tsx
  server/
    env/index.ts
    db/
      client.ts
      schema.ts
      migrations/
  lib/
    health.ts
docs/
  01-prd-v1.md
  02-domain-rules.md
  03-order-state-machine.md
  04-wallet-rules.md
  05-implementation-plan.md
tests/
  unit/
  e2e/
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar valores reales.

Variables mínimas:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `PHONE_AUTH_PROVIDER`
- `PHONE_AUTH_API_KEY`

## PWA durante estabilización

Para desactivar temporalmente el PWA durante iteración y estabilización, configurar:

- `NEXT_PUBLIC_DISABLE_PWA=true`

Notas:

- Requiere un redeploy limpio después de cambiar esta variable de entorno.
- Si venías de una versión con PWA habilitado, puede hacer falta limpiar una vez los site data / service worker del navegador para evitar caché vieja.
- Para re-habilitarlo, quitar la variable o dejarla distinta de `true` y volver a desplegar.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run admin:bootstrap-owner`

## Próximos pasos (módulos de negocio)

1. Autenticación por teléfono (OTP provider real).
2. Modelo de dominio de órdenes + máquina de estados.
3. Ledger wallet transaccional e idempotente.
4. Menú/stock por tienda y backoffice admin.
5. Loyalty points + canje de bebida gratis.

## Bootstrap del primer owner admin

Ejecutar una vez con variables de entorno configuradas:

- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_NAME`

Comando:

- `npm run admin:bootstrap-owner`

El script crea el owner sólo si no existe uno previo.

