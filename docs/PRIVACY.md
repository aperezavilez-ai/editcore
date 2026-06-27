# Política de privacidad — EditCore IDE

**Última actualización:** junio 2026

## Resumen

EditCore es un IDE **local**. Por defecto **no envía telemetría** a EditCore ni a Microsoft.

## Qué se guarda en tu PC

| Dato | Dónde |
|------|--------|
| API keys (Anthropic, OpenAI, etc.) | SecretStorage de la extensión EditCore Claude (cifrado del SO) |
| Tokens Vercel / Supabase | SecretStorage |
| Configuración del editor | `%APPDATA%\EditCore` (Windows) |
| Índices RAG / memoria proyecto | Carpeta `.editcore` en cada workspace |
| Licencia (opcional) | SecretStorage |

**Migración legacy:** si existía `%APPDATA%\EditCore\api-keys.json` (versiones antiguas),
EditCore lo importa una sola vez a SecretStorage y lo borra del disco al arrancar.
No se conservan copias de respaldo en texto plano.

## Qué sale de tu PC (solo si lo configurás)

- Llamadas a **Anthropic / OpenAI** con tu API key
- **GitHub, Vercel, Supabase** con tus tokens
- **Comprobación de actualizaciones**: lectura de `releases/latest.json` en GitHub (sin datos personales)
- **Open VSX** al instalar extensiones del marketplace abierto

## Telemetría

Desactivada en `product.json` y settings por defecto. No usamos analytics propios en esta versión.

## Crash reporting

No hay envío automático de crashes. Podés reportar problemas manualmente en GitHub Issues.

## Cambios futuros

Si se añade telemetría o cuenta cloud opcional, esta política se actualizará y se pedirá consentimiento explícito.

## Contacto

https://github.com/aperezavilez-ai/editcore/issues
