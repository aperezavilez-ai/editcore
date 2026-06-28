# EDITCORE Self Debug System

## Flujo

```
Crear cambio → Ejecutar pruebas → ¿Error?
     ↓ sí
Analizar causa (Debug Agent / Coder)
     ↓
Corregir → Volver a probar → ¿OK?
     ↓
Confirmar (máx N ciclos, default 3)
```

## Configuración

`editcore.autonomous.maxDebugCycles` — límite anti-bucle infinito.

## Validación

Usa `postChangeValidator`: npm test, npm run build según package.json.

