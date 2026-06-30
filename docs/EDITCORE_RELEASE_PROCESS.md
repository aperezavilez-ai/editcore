# EditCore Release Process

Estado: **proceso real con tracking en base de datos**. El versionado
semántico, checklist de pre-release y registro de releases están
implementados (agente `@release-manager` + tabla `factory_releases`).

## 1. Proceso de release paso a paso

### Pre-release (checklist del @release-manager)
```
□ Todos los tests del sprint pasaron
□ Revisión de seguridad completada para cambios críticos
□ Variables de entorno nuevas documentadas en .env.example (no en el repo)
□ Release notes redactadas con: ✨ Nuevo | 🐛 Corregido | ⚡ Mejorado | ⚠️ Incompatible
□ Backup reciente de base de datos verificado
□ Si hay migraciones de DB: compatibles en ambas direcciones
```

### Numeración semántica (SemVer)
- `PATCH` (1.0.**x**): bugfix sin cambio de comportamiento visible.
- `MINOR` (1.**x**.0): feature nueva sin romper integraciones existentes.
- `MAJOR` (**x**.0.0): cambio de API o comportamiento que rompe integraciones — requiere changelog detallado y período de deprecación si hay clientes externos.

### Flujo de canales
```
Rama de feature → merge a main → deploy automático Vercel (production)
                                     ↑
                              Usar canal alpha/beta
                              para versiones de prueba
                              antes de marcar como production
```

### Registro en la base de datos
```bash
# Vía API (con sesión activa)
curl -X POST https://editcore.mx/api/v1/factory/releases \
  -H "Authorization: Bearer TOKEN" \
  -H "content-type: application/json" \
  -d '{"project_id":"UUID","version":"1.2.0","channel":"production","release_notes":"...", "commit_sha":"abc123"}'

# O desde el dashboard web/factory.html
```

## 2. Rollback

- **Rollback de código**: `git revert <commit>` (seguro, crea un commit nuevo que deshace) o `git reset --hard <commit>` (destructivo, solo para ramas no compartidas).
- **Rollback de base de datos**: restaurar desde el backup automático de Supabase (Point in Time Recovery, disponible en plan Pro). Los `factory_releases` tienen `is_active` para marcar visualmente qué versión está activa, pero el rollback real de código/DB es manual.
- **Rollback de Vercel**: en el dashboard de Vercel → proyecto → Deployments → clic en un deploy anterior → "Redeploy". Esto no revierte migraciones de base de datos.

## 2. Lo que NO existe todavía

- GitHub Releases automáticas: el registro de releases está en `factory_releases` (Supabase), pero no se crea automáticamente un Release de GitHub con el `.zip`/`.exe` correspondiente — eso requiere GitHub Actions con permiso de escritura en releases.
- Notificaciones de release: no hay email, webhook ni Slack cuando se publica una versión nueva.
