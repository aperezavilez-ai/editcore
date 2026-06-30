# EditCore — Observabilidad

Estado: **scripts de Vercel Web Analytics y Speed Insights instalados en
todas las páginas web**. Falta solo activarlos en el dashboard de Vercel
(un toggle, sin código ni claves).

## 1. Lo que existe

Las 15 páginas estáticas de `web/*.html` cargan, antes de `</body>`:

```html
<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>
```

Son los scripts oficiales de Vercel para sitios sin framework/bundler — no
son un SDK de npm, no llevan clave ni configuración: Vercel los sirve solo
si el proyecto tiene Analytics o Speed Insights activado.

## 2. Lo que falta (responsabilidad del usuario)

1. En el dashboard de Vercel del proyecto `editcore`: **Analytics** (pestaña
   del proyecto) → activar. Lo mismo para **Speed Insights**.

## 3. Decisión: sin Sentry ni herramientas externas nuevas

Se evaluó agregar Sentry para errores de backend (`api/*.ts`), pero el
usuario decidió explícitamente **no** darse de alta en herramientas nuevas
que generen costo adicional — la prioridad es no gastar más de lo que el
proyecto factura todavía. Por eso la observabilidad de EditCore se queda
en lo que ya está activo y sin costo extra: **Vercel Analytics + Speed
Insights** (gratis en el plan actual) y los **logs nativos de Vercel**
(`vercel logs` / pestaña "Logs" del proyecto, ya disponibles sin
configuración) para ver errores de las funciones `api/*.ts`. Si en el
futuro el negocio justifica el gasto, Sentry queda como opción documentada
acá, no como pendiente activo.

## 4. Qué mide cada uno

- **Web Analytics**: vistas de página, visitantes únicos, por página/ruta.
- **Speed Insights**: Core Web Vitals reales (LCP, FID/INP, CLS) medidos en
  los navegadores de los usuarios reales.

Ninguno de los dos requiere cambios futuros en el código — una vez
activado el toggle, los datos empiezan a aparecer en el dashboard de
Vercel sin que EditCore tenga que hacer nada más.
