-- ============================================================================
-- BÚSQUEDA DE PADRÓN RÁPIDA Y ROBUSTA  (correr UNA vez en el SQL Editor de Supabase)
-- ----------------------------------------------------------------------------
-- Resuelve:
--   1) "No encuentra el elector": el SELECT directo lo bloquea RLS cuando el
--      token de Firebase no trae el claim role:'authenticated' (usuarios nuevos).
--      -> Esta función es SECURITY DEFINER: saltea RLS y funciona para TODOS
--         los usuarios logueados (y se le da EXECUTE a anon + authenticated).
--   2) Buscar por nombre Y apellido juntos, en cualquier orden ("PEREZ JUAN").
--   3) Velocidad: índice trigram (GIN) sobre el nombre completo -> ILIKE veloz.
-- ============================================================================

create extension if not exists pg_trgm;

-- Índice para acelerar el "contiene" sobre nombre + apellido (en MAYÚSCULAS)
create index if not exists idx_padron_nombrecompleto_trgm
  on padron using gin (upper(nombre || ' ' || apellido) gin_trgm_ops);

-- Índice para búsqueda por prefijo de cédula (texto)
create index if not exists idx_padron_cedula_pat
  on padron (cedula text_pattern_ops);

-- Índice para el filtro por distrito (si aún no existe)
create index if not exists idx_padron_distrito on padron (distrito);

-- Función de búsqueda: por cédula (prefijo) o por palabras de nombre/apellido.
create or replace function buscar_padron(q text, dist text default null)
returns table (
  cedula text, nombre text, apellido text, distrito text,
  cod_local text, local text, mesa text, orden text, direccion text
)
language sql
security definer
set search_path = public
stable
as $$
  with parts as (
    select
      upper(trim(regexp_replace(coalesce(q,''), '\s+', ' ', 'g')))              as qq,
      string_to_array(upper(trim(regexp_replace(coalesce(q,''), '\s+', ' ', 'g'))), ' ') as palabras
  ),
  p1 as (select (palabras)[1] as w1, qq, palabras from parts)
  select p.cedula, p.nombre, p.apellido, p.distrito,
         p.cod_local, p.local, p.mesa, p.orden, p.direccion
  from padron p, p1
  where p1.qq <> ''
    and (dist is null or p.distrito = dist)
    and (
      -- por cédula: empieza con lo escrito
      p.cedula like p1.qq || '%'
      or (
        -- 1er palabra con índice trigram (rápido) ...
        upper(p.nombre || ' ' || p.apellido) like '%' || p1.w1 || '%'
        -- ... y TODAS las palabras presentes (nombre/apellido en cualquier orden)
        and (
          select bool_and(upper(p.nombre || ' ' || p.apellido) like '%' || w || '%')
          from unnest(p1.palabras) w
          where w <> ''
        )
      )
    )
  limit 25;
$$;

-- Permitir ejecutarla a los roles que usa la app (con o sin el claim)
grant execute on function buscar_padron(text, text) to anon, authenticated;
