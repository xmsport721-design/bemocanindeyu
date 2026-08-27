-- ============================================================================
-- CRUZAMIENTO MASIVO DE CÉDULAS  (correr UNA vez en el SQL Editor de Supabase)
-- ----------------------------------------------------------------------------
-- Recibe una lista de cédulas y devuelve, en UN solo viaje, las que figuran en
-- el padrón (con local, mesa, orden). SECURITY DEFINER -> saltea RLS, funciona
-- para todos los usuarios. Se usa en la "Carga masiva por coordinador".
-- ============================================================================
create or replace function buscar_padron_cedulas(cedulas text[], dist text default null)
returns table (
  cedula text, nombre text, apellido text, distrito text,
  cod_local text, local text, mesa text, orden text, direccion text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.cedula, p.nombre, p.apellido, p.distrito,
         p.cod_local, p.local, p.mesa, p.orden, p.direccion
  from padron p
  where p.cedula = any (cedulas)
    and (dist is null or p.distrito = dist);
$$;

grant execute on function buscar_padron_cedulas(text[], text) to anon, authenticated;
