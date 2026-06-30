-- Vincula un usuario de Supabase Auth (que ya se registró por web/login.html)
-- a la organización "EditCore" sembrada en 0002_seed_org.sql.
-- Correr en el SQL Editor de Supabase DESPUÉS de que el usuario se haya
-- registrado al menos una vez (si no, auth.users no lo tiene). Cambiar el
-- correo de la cláusula WHERE por el del usuario a vincular.

insert into profiles (id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u
join organizations o on o.name = 'EditCore'
where u.email = 'alfonsoavilery@icloud.com'
on conflict (id) do update set organization_id = excluded.organization_id, role = excluded.role;
