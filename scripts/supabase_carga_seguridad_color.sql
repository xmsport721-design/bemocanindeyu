-- ============================================================================
-- FASE 3.1 — Seguridad por CÉDULA del coordinador + COLOR por lista
-- Correr UNA vez en el SQL Editor de Supabase.
-- ============================================================================
alter table cargas_coordinador add column if not exists coordinador_cedula text;
alter table carga_filas       add column if not exists semaforo text default 'VERDE';

-- Se cambian firmas/retornos → hay que DROPear antes de recrear
drop function if exists carga_crear(text,text,text,text,text,text[]);
drop function if exists carga_info(text);
drop function if exists carga_agregar(text,jsonb);
drop function if exists carga_enviar(text);
drop function if exists carga_filas_get(text);

-- CREAR (concejal/adm): guarda la cédula del coordinador
create or replace function carga_crear(p_distrito text, p_zona text, p_coordinador_nombre text, p_coordinador_telefono text, p_concejal_fijo text, p_concejales text[], p_coordinador_cedula text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_token text;
begin
  if (auth.jwt() ->> 'sub') is null then raise exception 'no autorizado'; end if;
  v_token := substr(md5(random()::text || clock_timestamp()::text || coalesce(p_coordinador_nombre,'')), 1, 18);
  insert into cargas_coordinador(token, distrito, zona, coordinador_nombre, coordinador_telefono, concejal_fijo, concejales_disponibles, generado_por, coordinador_cedula)
  values (v_token, upper(p_distrito), p_zona, upper(p_coordinador_nombre), p_coordinador_telefono, p_concejal_fijo, p_concejales, coalesce(auth.jwt()->>'email','?'), nullif(trim(coalesce(p_coordinador_cedula,'')),''));
  return v_token;
end $$;
grant execute on function carga_crear(text,text,text,text,text,text[],text) to anon, authenticated;

-- INFO (público): NO expone la cédula, solo si hace falta
create or replace function carga_info(p_token text)
returns table(token text, distrito text, zona text, coordinador_nombre text, concejal_fijo text, concejales_disponibles text[], estado text, filas bigint, req_cedula boolean)
language sql security definer set search_path=public stable as $$
  select c.token, c.distrito, c.zona, c.coordinador_nombre, c.concejal_fijo, c.concejales_disponibles, c.estado,
         (select count(*) from carga_filas f where f.token=c.token),
         (c.coordinador_cedula is not null and c.coordinador_cedula <> '')
  from cargas_coordinador c where c.token=p_token;
$$;
grant execute on function carga_info(text) to anon, authenticated;

-- VALIDAR cédula (público)
create or replace function carga_validar(p_token text, p_cedula text)
returns boolean language sql security definer set search_path=public stable as $$
  select exists(select 1 from cargas_coordinador where token=p_token
    and (coordinador_cedula is null or coordinador_cedula='' or coordinador_cedula = trim(p_cedula)));
$$;
grant execute on function carga_validar(text,text) to anon, authenticated;

-- AGREGAR (público): verifica cédula + guarda color por fila
create or replace function carga_agregar(p_token text, p_filas jsonb, p_cedula text default null)
returns int language plpgsql security definer set search_path=public as $$
declare v_estado text; v_ced text; v_n int;
begin
  select estado, coordinador_cedula into v_estado, v_ced from cargas_coordinador where token=p_token;
  if v_estado is null then raise exception 'link invalido'; end if;
  if v_ced is not null and v_ced <> '' and v_ced <> trim(coalesce(p_cedula,'')) then raise exception 'cedula incorrecta'; end if;
  insert into carga_filas(token, cedula, nombre, telefono, concejal, semaforo)
  select p_token, trim(x->>'cedula'), upper(coalesce(x->>'nombre','')), (x->>'telefono'), (x->>'concejal'), upper(coalesce(nullif(x->>'semaforo',''),'VERDE'))
  from jsonb_array_elements(p_filas) x
  where coalesce(trim(x->>'cedula'),'') <> '';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function carga_agregar(text,jsonb,text) to anon, authenticated;

-- ENVIAR (público): verifica cédula
create or replace function carga_enviar(p_token text, p_cedula text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_ced text;
begin
  select coordinador_cedula into v_ced from cargas_coordinador where token=p_token;
  if v_ced is not null and v_ced <> '' and v_ced <> trim(coalesce(p_cedula,'')) then raise exception 'cedula incorrecta'; end if;
  update cargas_coordinador set estado='enviado', enviado_en=coalesce(enviado_en, now()) where token=p_token;
end $$;
grant execute on function carga_enviar(text,text) to anon, authenticated;

-- BÚSQUEDA POR CÉDULA EXACTA (usa la PK → instantánea, trae todos los datos)
create index if not exists idx_padron_cedula on padron (cedula);
create or replace function padron_por_cedula(ci text)
returns table(cedula text, nombre text, apellido text, distrito text, cod_local text, local text, mesa text, orden text, direccion text)
language sql security definer set search_path=public stable as $$
  select p.cedula, p.nombre, p.apellido, p.distrito, p.cod_local, p.local, p.mesa, p.orden, p.direccion
  from padron p where p.cedula = trim(ci) limit 1;
$$;
grant execute on function padron_por_cedula(text) to anon, authenticated;

-- FILAS (equipo logueado): devuelve el color
create or replace function carga_filas_get(p_token text)
returns table(id bigint, cedula text, nombre text, telefono text, concejal text, semaforo text)
language sql security definer set search_path=public stable as $$
  select f.id, f.cedula, f.nombre, f.telefono, f.concejal, coalesce(f.semaforo,'VERDE')
  from carga_filas f
  where (auth.jwt()->>'sub') is not null and f.token=p_token order by f.id;
$$;
grant execute on function carga_filas_get(text) to anon, authenticated;
