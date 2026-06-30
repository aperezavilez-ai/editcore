# Convenciones de rutas de API — EditCore

## Regla

Toda ruta nueva del backend (`api/`) se crea bajo `api/v1/<módulo>/`.

Las rutas legacy sin prefijo de versión (`api/auth`, `api/community`,
`api/developer`, `api/evolution`, `api/org`, `api/usage`) se mantienen
funcionando — `vercel.json` y el frontend ya apuntan a ellas — pero **no se
expanden**: no se agregan endpoints nuevos ahí. Cualquier funcionalidad nueva
relacionada con esos dominios va en `api/v1/<dominio-equivalente>/`.

## Por qué

- Evita mezclar convenciones de versionado dentro del mismo dominio.
- Permite migrar las rutas legacy a `/v1` en el futuro (Prioridad 2 del
  roadmap) sin que la superficie de API siga creciendo en el formato viejo
  mientras tanto.

## Migración futura

Migrar `api/{auth,community,developer,evolution,org,usage}` a `api/v1/*` es
una tarea de Prioridad 2 (ver `EDITCORE_MASTER_ROADMAP.md`, P2.1) con riesgo
medio porque `vercel.json` y el frontend ya apuntan a las rutas actuales —
requiere actualizar ambos en el mismo cambio, no solo mover archivos.
