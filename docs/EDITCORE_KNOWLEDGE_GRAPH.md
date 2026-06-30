# EditCore Global AI Knowledge Graph

Estado: **implementado** con tablas `knowledge_nodes` y `knowledge_edges`.
El grafo es consultable via API y el dashboard muestra los nodos.
Visualizacion grafica (D3.js) no implementada aun.

## 1. Tipos de nodos

| Tipo | Que representa |
|---|---|
| `project` | Un proyecto completo con stack, arquitectura y decisiones |
| `solution` | Una solucion especifica a un problema tecnico |
| `component` | Un componente reutilizable (auth, billing, API) |
| `pattern` | Un patron de diseno o arquitectura probado |
| `experience` | Una leccion aprendida de un proyecto real |
| `technology` | Un framework, lenguaje o herramienta evaluada |
| `research` | Un hallazgo de investigacion del AI Research Network |

## 2. Tipos de relaciones (aristas)

| Relacion | Significado |
|---|---|
| `uses` | Un nodo usa a otro (proyecto usa componente) |
| `implements` | Un nodo implementa un patron |
| `extends` | Un nodo extiende o especializa otro |
| `references` | Referencia informativa |
| `learned_from` | Experiencia derivada de otro nodo |
| `improves` | Un nodo mejora a otro |
| `replaces` | Un nodo reemplaza a otro (migracion) |
| `depends_on` | Dependencia directa |

## 3. API

```
# Listar nodos (publicos + propios)
GET /api/v1/network/knowledge

# Filtrar por tipo
GET /api/v1/network/knowledge?type=pattern

# Filtrar por tag
GET /api/v1/network/knowledge?tag=auth

# Solo publicos
GET /api/v1/network/knowledge?public=true

# Crear nodo
POST /api/v1/network/knowledge
{ "node_type": "pattern", "title": "JWT Auth con Supabase", "tags": ["auth","jwt"], "is_public": true, "confidence": 90 }

# Conectar nodos
POST /api/v1/network/knowledge/edges
{ "from_node_id": "<uuid>", "to_node_id": "<uuid>", "relation_type": "implements", "weight": 80 }
```

## 4. Como poblar el grafo

Los agentes del IDE pueden agregar nodos al grafo despues de cada sesion:
- `@enterprise-architect` → nodos tipo `pattern`, `solution`
- `@ai-architect` → nodos tipo `technology`, `research`
- `@maintenance-agent` → nodos tipo `experience` (lecciones aprendidas)
- `@saas-builder` → nodos tipo `component`
- `@release-manager` → nodos tipo `project`

## 5. Lo que falta

- Visualizacion del grafo con D3.js o Cytoscape.js en el dashboard.
- Busqueda semantica por similitud (requiere embeddings vectoriales en pgvector).
- Proceso automatico que conecta nodos cuando el orquestador usa un patron.
