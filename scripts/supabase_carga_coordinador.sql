-- ============================================================================
-- FASE 3 · CARGA DE COORDINADOR POR LINK PÚBLICO  (correr UNA vez en Supabase)
-- ----------------------------------------------------------------------------
-- El coordinador entra a un link único (?carga=TOKEN) SIN usuario/clave, carga
-- una lista de cédulas y la envía. El equipo logueado la revisa, la cruza con el
-- padrón y la importa a votos_seguros.
-- Seguridad: las tablas están 100% bloqueadas por RLS (deny-all). TODO pasa por
-- funciones RPC SECURITY DEFINER. El token es la llave de acceso del coordinador.
-- ============================================================================
create table if not exists cargas_coordinador (
  token text PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'bemo',
  departamento_id text NOT NULL DEFAULT 'concepcion',
  distrito text NOT NULL,
  zona text,
  coordinador_nombre text NOT NULL,
  coordinador_telefono text,
  concejal_fijo text,
  concejales_disponibles text[],
  generado_por text,
  estado text NOT NULL DEFAULT 'cargando' CHECK (estado IN ('cargando','enviado','cruzado','importado')),
  creado timestamptz DEFAULT now(),
  enviado_en timestamptz,
  cruzado_en timestamptz
);

create table if not exists carga_filas (
  id bigserial PRIMARY KEY,
  token text NOT NULL REFERENCES cargas_coordinador(token) ON DELETE CASCADE,
  cedula text NOT NULL,
  nombre text, apellido text, direccion text, telefono text, concejal text,
  local text, mesa text, orden int, distrito_real text,
  encontrado boolean,
  importado boolean NOT NULL DEFAULT false,
  creado timestamptz DEFAULT now()
);
create index if not exists idx_carga_filas_token on carga_filas(token);

alter table cargas_coordinador enable row level security;
alter table carga_filas enable row level security;
-- Sin políticas = deny-all. Todo pasa por las funciones de abajo.
revoke all on cargas_coordinador from anon, authenticated;
revoke all on carga_filas from anon, authenticated;

-- ── Concejal logueado: crea la carga y obtiene el token del link ──
create or replace function carga_crear(p_distrito text, p_zona text, p_coordinador_nombre text, p_coordinador_telefono text, p_concejal_fijo text, p_concejales text[])
returns text language plpgsql security definer set search_path=public as $$
declare v_token text;
begin
  if (auth.jwt() ->> 'sub') is null then raise exception 'no autorizado'; end if;
  v_token := substr(md5(random()::text || clock_timestamp()::text || coalesce(p_coordinador_nombre,'')), 1, 18);
  insert into cargas_coordinador(token, distrito, zona, coordinador_nombre, coordinador_telefono, concejal_fijo, concejales_disponibles, generado_por)
  values (v_token, upper(p_distrito), p_zona, upper(p_coordinador_nombre), p_coordinador_telefono, p_concejal_fijo, p_concejales, coalesce(auth.jwt()->>'email','?'));
  return v_token;
end $$;
grant execute on function carga_crear(text,text,text,text,text,text[]) to anon, authenticated;

-- ── Público (con el token): datos de la carga para mostrar en la página ──
create or replace function carga_info(p_token text)
returns table(token text, distrito text, zona text, coordinador_nombre text, concejal_fijo text, concejales_disponibles text[], estado text, filas bigint)
language sql security definer set search_path=public stable as $$
  select c.token, c.distrito, c.zona, c.coordinador_nombre, c.concejal_fijo, c.concejales_disponibles, c.estado,
         (select count(*) from carga_filas f where f.token=c.token)
  from cargas_coordinador c where c.token=p_token;
$$;
grant execute on function carga_info(text) to anon, authenticated;

-- ── Público (con el token): agrega filas. Solo si estado='cargando' ──
create or replace function carga_agregar(p_token text, p_filas jsonb)
returns int language plpgsql security definer set search_path=public as $$
declare v_estado text; v_n int;
begin
  select estado into v_estado from cargas_coordinador where token=p_token;
  if v_estado is null then raise exception 'link invalido'; end if;
  if v_estado <> 'cargando' then raise exception 'esta lista ya fue enviada'; end if;
  insert into carga_filas(token, cedula, nombre, telefono, concejal)
  select p_token, trim(x->>'cedula'), upper(coalesce(x->>'nombre','')), (x->>'telefono'), (x->>'concejal')
  from jsonb_array_elements(p_filas) x
  where coalesce(trim(x->>'cedula'),'') <> '';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
grant execute on function carga_agregar(text,jsonb) to anon, authenticated;

-- ── Público (con el token): envía la lista (cierra la carga) ──
create or replace function carga_enviar(p_token text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update cargas_coordinador set estado='enviado', enviado_en=now() where token=p_token and estado='cargando';
end $$;
grant execute on function carga_enviar(text) to anon, authenticated;

-- ── Concejal logueado: lista las cargas de un distrito ──
create or replace function carga_listar(p_distrito text)
returns table(token text, distrito text, zona text, coordinador_nombre text, coordinador_telefono text, concejal_fijo text, estado text, creado timestamptz, enviado_en timestamptz, filas bigint)
language sql security definer set search_path=public stable as $$
  select c.token,c.distrito,c.zona,c.coordinador_nombre,c.coordinador_telefono,c.concejal_fijo,c.estado,c.creado,c.enviado_en,
    (select count(*) from carga_filas f where f.token=c.token)
  from cargas_coordinador c
  where (auth.jwt()->>'sub') is not null and (p_distrito is null or c.distrito=upper(p_distrito))
  order by c.creado desc;
$$;
grant execute on function carga_listar(text) to anon, authenticated;

-- ── Concejal logueado: filas de una carga (para revisar/importar) ──
create or replace function carga_filas_get(p_token text)
returns table(id bigint, cedula text, nombre text, telefono text, concejal text)
language sql security definer set search_path=public stable as $$
  select f.id, f.cedula, f.nombre, f.telefono, f.concejal
  from carga_filas f
  where (auth.jwt()->>'sub') is not null and f.token=p_token order by f.id;
$$;
grant execute on function carga_filas_get(text) to anon, authenticated;

-- ── Concejal logueado: marca la carga como importada ──
create or replace function carga_marcar_importada(p_token text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if (auth.jwt() ->> 'sub') is null then raise exception 'no autorizado'; end if;
  update cargas_coordinador set estado='importado' where token=p_token;
end $$;
grant execute on function carga_marcar_importada(text) to anon, authenticated;
