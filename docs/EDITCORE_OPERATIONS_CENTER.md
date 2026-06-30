# EditCore — Operations Center

## URL

`/web/operations-center.html`

## Tabs disponibles

| Tab | Contenido |
|-----|-----------|
| Organigrama | Vista del org chart con roles humanos y agentes |
| OKRs | Objetivos activos con barra de progreso |
| Procesos | Procesos registrados con estado y conteo de ejecuciones |
| Clientes | CRM con valor de contrato y agente asignado |
| Reuniones | Actas con decisiones y action items |
| Finanzas | Revenue, costos, margen neto del periodo |
| Reportes | Generacion y visualizacion de reportes ejecutivos |

## Acceso

Requiere token Bearer de Supabase Auth. Las llamadas a la API se hacen con el token del usuario autenticado.

## Paleta de colores

Gold/orange (#f59e0b, #d97706) sobre fondo oscuro (#0f172a, #1e293b).

## Caracteristicas reales

- Carga datos reales de todas las tablas biz_*
- Generacion de reporte ejecutivo con un clic (agrega datos de factory_projects, biz_okrs, biz_customers, biz_finance_records, quality_reviews)
- Formularios de creacion para cada entidad

## Lo que NO existe aún

- Graficas/charts de tendencias financieras
- Exportacion a PDF/Excel
- Notificaciones en tiempo real (websockets)
- Vista de calendario para reuniones
