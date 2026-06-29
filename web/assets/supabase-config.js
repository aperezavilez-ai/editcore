// Configuración pública de Supabase Auth para el sitio web de EditCore.
// SUPABASE_ANON_KEY es la clave "anon"/"publishable" (segura para exponer en el cliente,
// distinta de SUPABASE_SERVICE_ROLE_KEY que solo vive server-side en lib/supabaseAdmin.ts).
// PENDIENTE: reemplazar con la clave real del proyecto Supabase de EditCore
// (Project Settings → API → anon/public key en https://supabase.com/dashboard).
window.EDITCORE_SUPABASE_URL = "https://xhoxplbeggvtxdujcxqn.supabase.co";
window.EDITCORE_SUPABASE_ANON_KEY = "REEMPLAZAR_CON_TU_ANON_KEY";
