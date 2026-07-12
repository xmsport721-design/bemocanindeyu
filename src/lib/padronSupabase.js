// ============================================================================
// CONSULTAS DEL PADRÓN EN SUPABASE (Postgres) — point queries, sin bajar 49 MB
// ============================================================================
import { supabase } from "../supabase";

// "¿Dónde vota fulano?" — 1 registro por cédula (indexado por PK)
export async function buscarPadronPorCedula(cedula) {
  const ci = String(cedula || "").trim();
  if (!ci) return null;
  const { data, error } = await supabase
    .from("padron")
    .select("cedula,nombre,apellido,distrito,local,mesa,orden,direccion")
    .eq("cedula", ci)
    .maybeSingle();
  if (error) { console.error("Supabase padrón (cédula):", error.message); return null; }
  return data;
}

// Conteo del padrón de un distrito (server-side, sin traer filas)
export async function contarPadronDistrito(distrito) {
  if (!distrito) return 0;
  const { count, error } = await supabase
    .from("padron")
    .select("*", { count: "exact", head: true })
    .eq("distrito", distrito);
  if (error) { console.error("Supabase padrón (conteo):", error.message); return 0; }
  return count || 0;
}

// Búsqueda por nombre/apellido (opcional: acotar por distrito). Máx 20.
export async function buscarPadronPorNombre(texto, distrito) {
  const t = String(texto || "").trim();
  if (t.length < 3) return [];
  const patron = `%${t}%`;
  let q = supabase
    .from("padron")
    .select("cedula,nombre,apellido,distrito,local,mesa,orden")
    .or(`nombre.ilike.${patron},apellido.ilike.${patron}`)
    .limit(20);
  if (distrito) q = q.eq("distrito", distrito);
  const { data, error } = await q;
  if (error) { console.error("Supabase padrón (nombre):", error.message); return []; }
  return data || [];
}
