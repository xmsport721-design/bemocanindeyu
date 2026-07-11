/**
 * upsert_sql.js — Carga y MERGE SEGURO contra Google Cloud SQL (PostgreSQL)
 * -------------------------------------------------------------
 * Alternativa a Firebase RTDB: mismo padrón, misma lógica, pero en Cloud SQL.
 *
 *  • Carga inicial desde padron_import.json  (INSERT ... ON CONFLICT DO UPDATE).
 *  • Cruzamiento de mesa/orden: UPDATE que toca SOLO mesa y orden,
 *    con COALESCE para no borrar lo existente si viene vacío.
 *  • La cédula es PRIMARY KEY → nunca duplica.
 *
 * USO:
 *   npm i pg
 *   # variables de entorno de conexión (Cloud SQL):
 *   set PGHOST=127.0.0.1 & set PGUSER=postgres & set PGPASSWORD=... & set PGDATABASE=electoral
 *
 *   node scripts/upsert_sql.js init   padron_import.json
 *   node scripts/upsert_sql.js mesas  MESAS_FINAL.csv
 * -------------------------------------------------------------
 */
const fs = require("fs");
const { Client } = require("pg");

const MODO = process.argv[2];   // "init" | "mesas"
const ARCH = process.argv[3];

const DDL = `
CREATE TABLE IF NOT EXISTS padron (
  cedula       TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  apellido     TEXT NOT NULL,
  departamento TEXT,
  cod_distrito TEXT,
  distrito     TEXT,
  cod_local    TEXT,
  local        TEXT,
  fecha_nac    TEXT,
  direccion    TEXT,
  mesa         TEXT DEFAULT '',
  orden        TEXT DEFAULT '',
  afiliacion   TEXT DEFAULT '',
  actualizado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_padron_distrito ON padron (distrito);
CREATE INDEX IF NOT EXISTS idx_padron_mesa     ON padron (distrito, mesa);
`;

async function main() {
  const client = new Client();          // toma PGHOST/PGUSER/... del entorno
  await client.connect();
  await client.query(DDL);

  if (MODO === "init") return cargaInicial(client);
  if (MODO === "mesas") return cruzarMesas(client);
  console.error('Modo inválido. Usá: init <json> | mesas <csv>');
  process.exit(1);
}

// ---- Carga inicial: upsert por cédula (no duplica, no pierde mesa/orden) ----
async function cargaInicial(client) {
  const { padron } = JSON.parse(fs.readFileSync(ARCH, "utf8"));
  const cedulas = Object.keys(padron);
  console.log(`Insertando/actualizando ${cedulas.length.toLocaleString()} electores...`);

  const SQL = `
    INSERT INTO padron
      (cedula,nombre,apellido,departamento,cod_distrito,distrito,cod_local,local,fecha_nac,direccion)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (cedula) DO UPDATE SET
      nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido,
      departamento=EXCLUDED.departamento, cod_distrito=EXCLUDED.cod_distrito,
      distrito=EXCLUDED.distrito, cod_local=EXCLUDED.cod_local,
      local=EXCLUDED.local, fecha_nac=EXCLUDED.fecha_nac, direccion=EXCLUDED.direccion,
      actualizado_en=now();
      -- OJO: NO se tocan mesa/orden/afiliacion aquí → no se sobrescriben.
  `;
  await client.query("BEGIN");
  let n = 0;
  for (const ci of cedulas) {
    const p = padron[ci];
    await client.query(SQL, [
      p.cedula, p.nombre, p.apellido, p.departamento, p.cod_distrito,
      p.distrito, p.cod_local, p.local, p.fecha_nac, p.direccion,
    ]);
    if (++n % 5000 === 0) { await client.query("COMMIT"); await client.query("BEGIN"); console.log("  ", n.toLocaleString()); }
  }
  await client.query("COMMIT");
  console.log("✅ Carga inicial completa.");
  await client.end();
}

// ---- Cruzamiento seguro: SOLO mesa y orden ----
async function cruzarMesas(client) {
  const lineas = fs.readFileSync(ARCH, "latin1").split("\n").filter(l => l.trim());
  const sep = lineas[0].split(";").length > lineas[0].split(",").length ? ";" : ",";
  const H = lineas[0].split(sep).map(h => h.trim().toLowerCase());
  const iC = H.findIndex(h => ["cedula", "ci"].includes(h));
  const iM = H.indexOf("mesa");
  const iO = H.findIndex(h => ["orden", "ord"].includes(h));
  if (iC < 0 || iM < 0 || iO < 0) { console.error("CSV necesita cedula,mesa,orden"); process.exit(1); }

  // COALESCE(NULLIF(...)) → si viene vacío, conserva lo que ya había.
  const SQL = `
    UPDATE padron SET
      mesa  = COALESCE(NULLIF($2,''), mesa),
      orden = COALESCE(NULLIF($3,''), orden),
      actualizado_en = now()
    WHERE cedula = $1;`;   // solo mesa/orden; no crea filas nuevas
  await client.query("BEGIN");
  let n = 0, faltan = 0;
  for (let i = 1; i < lineas.length; i++) {
    const f = lineas[i].split(sep);
    const ci = (f[iC] || "").trim(); if (!ci) continue;
    const r = await client.query(SQL, [ci, (f[iM] || "").trim(), (f[iO] || "").trim()]);
    if (r.rowCount === 0) faltan++;
    if (++n % 5000 === 0) { await client.query("COMMIT"); await client.query("BEGIN"); console.log("  ", n.toLocaleString()); }
  }
  await client.query("COMMIT");
  console.log(`✅ Merge de mesa/orden completo. Cédulas no encontradas: ${faltan.toLocaleString()}`);
  await client.end();
}

main().catch(e => { console.error("❌", e); process.exit(1); });
