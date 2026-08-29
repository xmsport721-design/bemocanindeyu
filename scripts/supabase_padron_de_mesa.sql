-- ============================================================================
-- PADRÓN DE UNA MESA  (correr UNA vez en el SQL Editor de Supabase)
-- El veedor descarga SOLO los electores de su mesa (no todo el distrito).
-- SECURITY DEFINER -> saltea RLS (sirve al veedor logueado por Firebase).
-- ============================================================================

-- Índice compuesto: hace instantánea la consulta por distrito+local+mesa
create index if not exists idx_padron_dlm on padron (distrito, cod_local, mesa);

create or replace function padron_de_mesa(dist text, cl text, m text)
returns table (cedula text, nombre text, apellido text, orden text, direccion text)
language sql
security definer
set search_path = public
stable
as $$
  select p.cedula, p.nombre, p.apellido, p.orden, p.direccion
  from padron p
  where p.distrito = dist and p.cod_local = cl and p.mesa = m;
$$;

grant execute on function padron_de_mesa(text,text,text) to anon, authenticated;
