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
2. Opcional, para errores del backend (`api/*.ts`), no solo de páginas:
   crear cuenta en Sentry, copiar el `SENTRY_DSN` y cargarlo como variable
   de entorno en Vercel (nunca en el repo). Esto no está implementado
   todavía — es un paso aparte si se decide agregar Sentry.

## 3. Qué mide cada uno

- **Web Analytics**: vistas de página, visitantes únicos, por página/ruta.
- **Speed Insights**: Core Web Vitals reales (LCP, FID/INP, CLS) medidos en
  los navegadores de los usuarios reales.

Ninguno de los dos requiere cambios futuros en el código — una vez
activado el toggle, los datos empiezan a aparecer en el dashboard de
Vercel sin que EditCore tenga que hacer nada más.
