# EditCore Customer Platform

Estado: **mínimo, parcialmente real**. No existe un "dashboard" web ni un
asistente de onboarding. Lo que existe es un comando dentro de la extensión
de VS Code que consulta datos reales del backend.

## 1. Lo que sí existe

- Comando `EditCore: Ver plan y consumo de la organización` (`editcore.showOrgPlan`) — llama a `/api/org/plan` y `/api/usage/summary` reales y muestra el resultado en un `showInformationMessage` de VS Code (nombre de organización, plan, tokens usados vs. límite, si superó el límite).
- Comando `EditCore: Conectar con organización (backend)` (`editcore.setOrgApiKey`) — pide la clave de organización y la valida contra `/api/org/plan` antes de guardarla.
- Comando `EditCore: Desconectar organización (backend)` (`editcore.clearOrgApiKey`) — borra la clave guardada.
- La clave se guarda cifrada con `context.secrets` de VS Code (igual que las API keys de Anthropic/OpenAI), nunca en texto plano.

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Dashboard web para clientes**: no hay ninguna página en `web/` ni ninguna ruta donde un cliente pueda iniciar sesión y ver su organización, equipo, consumo histórico o facturas. Todo el "dashboard" hoy es el mensaje emergente de un comando de VS Code.
- **Asistente de onboarding**: no existe ningún flujo guiado de bienvenida, tutorial interactivo, ni checklist de primeros pasos. Un usuario nuevo que instala la extensión no recibe ninguna guía automática más allá de la documentación en el repo.
- **Gestión de equipo / asientos**: no hay UI para invitar miembros, asignar roles, ni ver quién usa la cuenta de la organización. La tabla `profiles` soporta esto a nivel de datos, pero no hay endpoint ni interfaz para gestionarlo.
- **Historial de consumo**: `/api/usage/summary` solo devuelve el total del mes actual, no hay gráficas, no hay desglose por día/usuario/herramienta, no hay exportación.
- **Notificaciones proactivas**: nadie avisa al usuario cuando se acerca al límite de su plan; debe ejecutar el comando manualmente para enterarse.

## 3. Próximos pasos sugeridos (no implementados)

1. Página web en `web/dashboard` con login (depende de la autenticación de usuario final, ver `EDITCORE_SAAS_ARCHITECTURE.md` §5).
2. Endpoint `/api/usage/history` con desglose diario para graficar consumo.
3. Webview de VS Code (en vez de `showInformationMessage`) con una vista más rica del plan y consumo.
4. Flujo de onboarding: al activar la extensión por primera vez, ofrecer conectar clave de organización con un tutorial paso a paso.

Nada de esto está construido — se documenta como ruta futura, no como funcionalidad actual.
