// ============================================================================
// CONSULTAS DEL PADRÓN EN SUPABASE (Postgres) — point queries, sin bajar 49 MB
// ============================================================================
import { supabase } from "../supabase";

// "¿Dónde vota fulano?" — 1 registro por cédula.
// Vía RPC (SECURITY DEFINER) para NO depender del claim RLS del usuario.
export async function buscarPadronPorCedula(cedula) {
  const ci = String(cedula || "").trim();
  if (!ci) return null;
  const { data, error } = await supabase.rpc("buscar_padron", { q: ci, dist: null });
  if (error) { console.error("Supabase padrón (cédula):", error.message); return null; }
  return (data || []).find(r => String(r.cedula) === ci) || null;
}

// Cruzamiento masivo: dado un array de cédulas, devuelve las que figuran en el padrón (1 viaje).
export async function buscarPadronPorCedulasLote(cedulas, distrito) {
  const lista = Array.from(new Set((cedulas || []).map(c => String(c).trim()).filter(Boolean)));
  if (lista.length === 0) return [];
  const { data, error } = await supabase.rpc("buscar_padron_cedulas", { cedulas: lista, dist: distrito || null });
  if (error) { console.error("Supabase cruzamiento cédulas:", error.message); return []; }
  return data || [];
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

// Búsqueda por nombre y/o apellido (en cualquier orden), opcional por distrito.
// Vía RPC: saltea RLS, matchea todas las palabras y usa índice trigram (rápido).
export async function buscarPadronPorNombre(texto, distrito) {
  const t = String(texto || "").trim();
  if (t.length < 3) return [];
  const { data, error } = await supabase.rpc("buscar_padron", { q: t, dist: distrito || null });
  if (error) { console.error("Supabase padrón (nombre):", error.message); return []; }
  return data || [];
}
