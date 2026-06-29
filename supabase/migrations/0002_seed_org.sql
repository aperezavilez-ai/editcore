-- Seed: primera organización real de EditCore + su API key (guardada hasheada).
-- Correr una sola vez en el SQL Editor de Supabase, después de 0001_init.sql.

with new_org as (
  insert into organizations (name, plan)
  values ('EditCore', 'free')
  returning id
)
insert into organization_api_keys (organization_id, key_hash, label)
select id, '338ce92ca61971319eee067e7e180d6b1902db3e6f1949bde21923ef4f24aaa8', 'extension-default'
from new_org
returning organization_id;
