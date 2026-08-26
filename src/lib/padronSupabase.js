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

// Electores por LOCAL (institución) y MESA de un distrito (agregado server-side vía RPC).
// Devuelve { locales: [{cod_local, local, total, mesas:[{mesa, cantidad}]}], totalDistrito }
export async function padronPorLocalMesa(distrito) {
  if (!distrito || distrito === "TODOS") return { locales: [], totalDistrito: 0 };
  const { data, error } = await supabase.rpc("padron_por_local_mesa", { dist: distrito });
  if (error) { console.error("Supabase padrón por local/mesa:", error.message); return { locales: [], totalDistrito: 0 }; }
  const porLocal = {};
  let totalDistrito = 0;
  (data || []).forEach(r => {
    const key = r.cod_local || "0";
    if (!porLocal[key]) porLocal[key] = { cod_local: key, local: r.local || "SIN LOCAL", total: 0, mesas: [] };
    porLocal[key].mesas.push({ mesa: r.mesa, cantidad: Number(r.cantidad) });
    porLocal[key].total += Number(r.cantidad);
    totalDistrito += Number(r.cantidad);
  });
  const locales = Object.values(porLocal)
    .map(l => ({ ...l, mesas: l.mesas.sort((a, b) => (parseInt(a.mesa) || 0) - (parseInt(b.mesa) || 0)) }))
    .sort((a, b) => (parseInt(a.cod_local) || 0) - (parseInt(b.cod_local) || 0));
  return { locales, totalDistrito };
}

// Padrón de UNA mesa puntual (distrito + local + mesa) — los habilitados, ordenados por orden.
export async function padronDeMesa(distrito, codLocal, mesa) {
  const { data, error } = await supabase
    .from("padron")
    .select("cedula,nombre,apellido,orden")
    .eq("distrito", distrito).eq("cod_local", String(codLocal)).eq("mesa", String(mesa))
    .limit(1000);
  if (error) { console.error("Supabase padrón de mesa:", error.message); return []; }
  return (data || []).sort((a, b) => (parseInt(a.orden) || 0) - (parseInt(b.orden) || 0));
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
