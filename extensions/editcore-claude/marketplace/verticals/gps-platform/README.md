# GPS Platform — vertical EditCore

## Objetivo
Plataforma de monitoreo de flotas con ingesta GPS en tiempo real.

## Estructura sugerida
```
services/ingest/     # TCP listener, parsers Teltonika/Codec8
services/api/        # REST + WebSocket para posiciones en vivo
services/worker/     # Geocercas, alertas, agregaciones
apps/dashboard/      # Mapa, flotas, alertas, reportes
infra/               # Docker, Redis, Postgres+PostGIS
```

## Checklist MVP
- [ ] Parser Codec8 básico
- [ ] Almacén de posiciones (PostGIS o Timescale)
- [ ] Mapa en vivo (WebSocket)
- [ ] Geocercas + alerta velocidad
- [ ] Panel admin: dispositivos, flotas, usuarios

Usá @gps para diseño de protocolos e ingesta.
