# EditCore — Research System

## Componentes reales del sistema de investigacion

### 1. Global Research Agent (lab_research_reports)

Almacena reportes de investigacion por tipo:
- `technology` — frameworks, herramientas, lenguajes
- `market` — analisis de mercado y oportunidades
- `competitor` — analisis de competidores especificos
- `trend` — tendencias emergentes
- `opportunity` — oportunidades de negocio detectadas
- `ai_models` — nuevos modelos de IA y capacidades

### 2. Trend Intelligence System (lab_trend_signals)

Registra senales de tendencia con:
- Categoria (technology, market, business_model, regulation, consumer, ai)
- Intensidad (emerging, growing, mainstream, declining)
- Score de oportunidad (0-100)
- Sectores relacionados

### 3. Competitive Intelligence Agent (lab_competitive_intel)

Analiza competidores con:
- Categoria (direct, indirect, emerging, adjacent)
- Fortalezas, debilidades, features
- Nivel de amenaza (low, medium, high, critical)
- Recomendaciones estrategicas

## APIs

- `GET/POST /api/v1/lab/research` — reportes de investigacion
- `GET/POST /api/v1/lab/trends` — senales de tendencia ordenadas por score
- `GET/POST /api/v1/lab/competitive` — inteligencia competitiva

## Lo que NO existe aun

- Web scraping o fetch automatico de fuentes externas (el sistema almacena lo que el usuario o agente ingresa)
- Integracion con APIs de noticias o papers de investigacion
- Actualizacion automatica de scores de tendencia
- Alertas cuando un competidor lanza feature nueva
