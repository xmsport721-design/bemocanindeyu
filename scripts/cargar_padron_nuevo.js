/**
 * cargar_padron_nuevo.js — Reemplaza el padrón en Supabase con el Excel oficial.
 * -------------------------------------------------------------
 * Lee ~/Downloads/01-CONCEPCION.xlsx (con MESA y ORDEN reales),
 * BORRA el padrón actual y carga el nuevo. Reemplazo limpio.
 *
 * USO (PowerShell):
 *   $env:SUPABASE_URL="https://ukchukteafaoidpffabx.supabase.co"
 *   $env:SUPABASE_SECRET="sb_secret_..."
 *   node --max-old-space-size=4096 scripts/cargar_padron_nuevo.js
 * -------------------------------------------------------------
 */
const XLSX = require("xlsx");
const os = require("os");
const path = require("path");
const fs = require("fs");

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET;
const LOTE = 2000;
if (!URL || !SECRET) { console.error("❌ Faltan SUPABASE_URL / SUPABASE_SECRET."); process.exit(1); }

// Excel serial -> "D/M/AAAA"
function serialAFecha(s) {
  const n = Number(s);
  if (!n || isNaN(n)) return "";
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}
const txt = (v) => (v == null ? "" : String(v)).trim();

async function main() {
  const f = path.join(os.homedir(), "Downloads", "01-CONCEPCION.xlsx");
  console.log("📖 Leyendo:", f);
  const wb = XLSX.readFile(f);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, defval: "" });
  const H = rows[0];
  const idx = (name) => H.indexOf(name);
  const I = {
    dep: idx("NOMBRE_DEP"), codDis: idx("DISTRITO"), dis: idx("NOMBRE_DIS"),
    codLoc: idx("LOCAL"), loc: idx("DESCRI_LOCAL"), mesa: idx("MESA"), orden: idx("ORDEN"),
    ced: idx("CEDULA"), nom: idx("NOMBRE"), ape: idx("APELLIDO"), fnac: idx("FECHA_NACIM"), dir: idx("DIRECCION"),
  };

  const map = new Map(); // cedula -> fila (dedup)
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cedula = txt(r[I.ced]);
    if (!cedula) continue;
    map.set(cedula, {
      cedula,
      nombre: txt(r[I.nom]),
      apellido: txt(r[I.ape]),
      departamento: txt(r[I.dep]),
      cod_distrito: txt(r[I.codDis]),
      distrito: txt(r[I.dis]),
      cod_local: txt(r[I.codLoc]),
      local: txt(r[I.loc]),
      mesa: txt(r[I.mesa]),
      orden: txt(r[I.orden]),
      fecha_nac: serialAFecha(r[I.fnac]),
      direccion: txt(r[I.dir]),
      afiliacion: "",
    });
  }
  const filas = [...map.values()];
  console.log(`✅ ${filas.length.toLocaleString()} electores mapeados (con mesa/orden).`);

  // Backup local del JSON (por si se necesita para RTDB)
  const padronObj = {}; filas.forEach(x => padronObj[x.cedula] = x);
  fs.writeFileSync("padron_import.json", JSON.stringify({ padron: padronObj }), "utf8");
  console.log("💾 padron_import.json regenerado.");

  const endpoint = `${URL.replace(/\/$/, "")}/rest/v1/padron`;
  const H2 = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

  // 1) BORRAR todo el padrón actual (reemplazo limpio)
  console.log("🗑️  Borrando padrón anterior...");
  const del = await fetch(`${endpoint}?cedula=not.is.null`, { method: "DELETE", headers: { ...H2, Prefer: "count=exact" } });
  if (!del.ok) { console.error("❌ Error al borrar:", del.status, (await del.text()).slice(0, 300)); process.exit(1); }
  console.log("   borrado OK (", del.headers.get("content-range"), ")");

  // 2) INSERTAR el nuevo padrón por lotes
  let n = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { ...H2, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(lote),
    });
    if (!res.ok) { console.error(`❌ Lote ${i}:`, res.status, (await res.text()).slice(0, 300)); process.exit(1); }
    n += lote.length;
    if (n % 20000 === 0 || n === filas.length) console.log(`   ${n.toLocaleString()} / ${filas.length.toLocaleString()}`);
  }
  console.log("✅ Padrón nuevo cargado en Supabase (con mesa/orden).");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
