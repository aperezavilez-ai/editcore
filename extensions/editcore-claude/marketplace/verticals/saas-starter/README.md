# SaaS Starter — vertical EditCore

## Objetivo
Aplicación SaaS multi-tenant con auth, roles y API REST.

## Estructura sugerida
```
apps/web/          # Frontend (Next.js o React)
apps/api/          # Backend (Node/Fastify o Nest)
packages/shared/   # Tipos compartidos
infra/             # Docker, CI/CD
```

## Checklist MVP
- [ ] Login/registro (email + OAuth opcional)
- [ ] Roles: admin, member
- [ ] API con JWT
- [ ] Postgres + migraciones
- [ ] Deploy Vercel (web) + Supabase/Railway (API/DB)
- [ ] Billing stub (Stripe fase 2)

Pide al agente @architect o @fullstack que implemente paso a paso.
