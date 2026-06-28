# EDITCORE Team System

## Visión

Organizaciones colaborativas con miembros, roles, permisos y recursos compartidos.

## Módulos

```
ecosystem/teamService.ts      → org.json, miembros, recursos compartidos
ecosystem/teamRoles.ts        → owner, admin, developer, reviewer, client, readonly
ecosystem/enterpriseSecurity.ts → assertOrgPermission, aislamiento org
```

## Roles y permisos

| Rol | Permisos clave |
|-----|----------------|
| Owner | Todo |
| Admin | Usuarios, marketplace, APIs |
| Developer | Código, agentes, APIs |
| Reviewer | Ver, ejecutar agentes |
| Client | Ver proyectos |
| Readonly | Solo lectura |

## Comandos

- `editcore.ecosystem.manageTeam`
- `editcore.initOrg`

## Configuración

`editcore.ecosystem.security.enabled` — activa control RBAC por rol.

