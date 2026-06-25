# Reglas del proyecto EditCore

Escribe aquí estándares que @claude debe seguir en este workspace.

## Estilo de código
- TypeScript estricto; sin `any` salvo integraciones externas.
- Cambios mínimos y enfocados; no refactorizar sin pedirlo.
- Comentarios solo para lógica no obvia.

## Agent Mode
- Preferir `apply_patch` sobre `write_file` en archivos existentes.
- Explorar con `search_files` / `glob_files` antes de editar.
- Pedir confirmación antes de comandos destructivos.

## Stack
- EditCore = Code-OSS + extensiones `editcore-claude` y `editcore-connect`.
- No romper el chat nativo `@claude` ni el pipeline `scripts/build-editcore.ps1`.
