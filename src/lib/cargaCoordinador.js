// ============================================================================
// FASE 3 · Carga de coordinador por link público — wrappers de las RPCs Supabase
// Todo pasa por funciones SECURITY DEFINER (las tablas están deny-all por RLS).
// ============================================================================
import { supabase } from "../supabase";

// Concejal logueado: crea la carga, devuelve el token del link
export async function cargaCrear({ distrito, zona, coordinador, telefono, concejalFijo, concejales, coordinadorCedula }) {
  const { data, error } = await supabase.rpc("carga_crear", {
    p_distrito: distrito, p_zona: zona || null, p_coordinador_nombre: coordinador,
    p_coordinador_telefono: telefono || null, p_concejal_fijo: concejalFijo || null, p_concejales: concejales || [],
    p_coordinador_cedula: coordinadorCedula || null,
  });
  if (error) throw error;
  return data; // token
}

// Valida la cédula del coordinador para dar acceso a la carga (medida de seguridad)
export async function cargaValidar(token, cedula) {
  const { data, error } = await supabase.rpc("carga_validar", { p_token: token, p_cedula: String(cedula || "") });
  if (error) throw error;
  return !!data;
}

// Público (con token): info de la carga
export async function cargaInfo(token) {
  const { data, error } = await supabase.rpc("carga_info", { p_token: token });
  if (error) throw error;
  return (data && data[0]) || null;
}

// Público (con token): agrega filas (array de {cedula, nombre, telefono, concejal, semaforo})
export async function cargaAgregar(token, filas, cedula) {
  const { data, error } = await supabase.rpc("carga_agregar", { p_token: token, p_filas: filas, p_cedula: cedula || null });
  if (error) throw error;
  return data; // cantidad insertada
}

// Público (con token): envía/cierra la carga
export async function cargaEnviar(token, cedula) {
  const { error } = await supabase.rpc("carga_enviar", { p_token: token, p_cedula: cedula || null });
  if (error) throw error;
}

// Concejal logueado: lista cargas de un distrito
export async function cargaListar(distrito) {
  const { data, error } = await supabase.rpc("carga_listar", { p_distrito: distrito || null });
  if (error) { console.error("carga_listar:", error.message); return []; }
  return data || [];
}

// Concejal logueado: filas de una carga
export async function cargaFilasGet(token) {
  const { data, error } = await supabase.rpc("carga_filas_get", { p_token: token });
  if (error) { console.error("carga_filas_get:", error.message); return []; }
  return data || [];
}

// Concejal logueado: marca la carga como importada
export async function cargaMarcarImportada(token) {
  const { error } = await supabase.rpc("carga_marcar_importada", { p_token: token });
  if (error) throw error;
}

// Concejal logueado: elimina una carga (link) y sus filas
export async function cargaEliminar(token) {
  const { error } = await supabase.rpc("carga_eliminar", { p_token: token });
  if (error) throw error;
}
