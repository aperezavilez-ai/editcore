# EDITCORE Agent Builder

## Visión

Crear agentes personalizados sin programar: nombre, objetivo, modelo, herramientas, memoria e instrucciones.

## Módulos

```
ecosystem/agentBuilder.ts     → wizard + persistencia
ecosystem/agentCatalog.ts     → @custom:{id} en chat
```

## Almacenamiento

`.editcore/agents/custom/{id}.json` + `{id}.md`

## Uso en chat

```
@custom:my-agent refactoriza el módulo de auth
```

## Comandos

- `editcore.ecosystem.agentBuilder`
- `editcore.ecosystem.listAgents`

