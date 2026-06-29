# EditCore Developer Portal

Estado: **primera versión real**. Existe un portal mínimo donde un usuario
con cuenta de EditCore puede generar y gestionar sus propias claves de API.
Sigue siendo muy limitado frente a la visión de "Developers Center" completo.

## 1. Lo que sí existe (real, en producción)

- `web/developers.html` — página real: requiere sesión de Supabase Auth (la misma cuenta de `login.html`), permite crear claves de API (`/api/developer/keys`), las lista con prefijo/fecha/estado, y permite revocarlas.
- Ejemplo de uso real con `curl` mostrado directamente en la página.
- `sdk/typescript/` — código fuente del SDK, usable localmente (`npm install` + `npm run build` dentro de `sdk/typescript/`), referenciado desde el portal.
- Enlace al portal desde `web/account.html` ("Panel de desarrolladores (API keys)").

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Documentación de API navegable/generada**: el portal solo tiene un ejemplo de `curl`, no una referencia completa (porque la API solo tiene un endpoint real, ver `EDITCORE_API_PLATFORM.md`).
- **Guías y tutoriales**: no hay contenido educativo más allá del ejemplo mínimo.
- **Claves de prueba / sandbox separado de producción**: las claves que se generan en `developers.html` son reales contra producción, no hay entorno de pruebas aislado.
- **Comunidad técnica**: no hay foro, Discord, ni espacio de discusión.
- **SDKs en otros lenguajes** (Python, etc.): no existen.

## 3. Próximos pasos honestos

1. Ampliar la documentación del portal a medida que se agreguen endpoints reales a `/api/v1/*`.
2. Sandbox real con límites bajos y datos de prueba, separado de organizaciones reales.
3. Canal de comunidad (Discord o GitHub Discussions) enlazado desde el portal.
