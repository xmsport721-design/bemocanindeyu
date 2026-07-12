/**
 * cargar_supabase.js — Carga el padrón (padron_import.json) a Supabase (PostgREST).
 * -------------------------------------------------------------
 * Usa el SECRET KEY (service_role) → bypassa RLS para insertar.
 * Upsert por cédula (merge-duplicates) → no duplica, seguro de re-correr.
 *
 * La tabla `padron` debe existir antes (ver el SQL que se corre en el dashboard).
 *
 * USO (PowerShell):
 *   $env:SUPABASE_URL="https://ukchukteafaoidpffabx.supabase.co"
 *   $env:SUPABASE_SECRET="sb_secret_..."
 *   node scripts/cargar_supabase.js
 * -------------------------------------------------------------
 */
const fs = require("fs");

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET;
const LOTE = 2000;

if (!URL || !SECRET) {
  console.error("❌ Faltan variables SUPABASE_URL y/o SUPABASE_SECRET en el entorno.");
  process.exit(1);
}

async function main() {
  const { padron } = JSON.parse(fs.readFileSync("padron_import.json", "utf8"));
  const filas = Object.values(padron);
  console.log(`📤 Subiendo ${filas.length.toLocaleString()} electores a Supabase en lotes de ${LOTE}...`);

  const endpoint = `${URL.replace(/\/$/, "")}/rest/v1/padron`;
  let subidos = 0;

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": SECRET,
        "Authorization": `Bearer ${SECRET}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(lote),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`❌ Error en lote ${i}-${i + lote.length}: ${res.status} ${txt.slice(0, 300)}`);
      process.exit(1);
    }
    subidos += lote.length;
    console.log(`   ${subidos.toLocaleString()} / ${filas.length.toLocaleString()}`);
  }

  console.log("✅ Padrón cargado en Supabase.");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
