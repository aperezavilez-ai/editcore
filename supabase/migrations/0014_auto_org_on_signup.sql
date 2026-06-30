-- Automatiza lo que hasta ahora se hacía a mano en 0003_link_user_to_org.sql:
-- al registrarse un usuario nuevo en Supabase Auth, se le crea automáticamente
-- una organización propia en el plan "free" (Community) y su perfil como owner.
-- Sin esto, cada registro nuevo quedaba sin organización hasta que alguien
-- corriera SQL manual — no escala más allá de un usuario de prueba.

create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name, plan)
  values (coalesce(new.email, 'Organización personal'), 'free')
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, role)
  values (new.id, new_org_id, 'owner')
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_signup();
