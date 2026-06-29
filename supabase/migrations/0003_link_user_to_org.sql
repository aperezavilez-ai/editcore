-- Vincula un usuario de Supabase Auth (que ya inició sesión por magic link)
-- a la organización "EditCore" sembrada en 0002_seed_org.sql.
-- Correr en el SQL Editor de Supabase DESPUÉS de que el usuario haya iniciado
-- sesión al menos una vez por web/login.html (si no, auth.users no lo tiene).

insert into profiles (id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u
join organizations o on o.name = 'EditCore'
where u.email = 'aperezavilez@gmail.com'
on conflict (id) do update set organization_id = excluded.organization_id, role = excluded.role;
