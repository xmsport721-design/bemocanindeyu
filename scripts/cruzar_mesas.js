/**
 * cruzar_mesas.js  —  MERGE SEGURO de MESA y ORDEN
 * -------------------------------------------------------------
 * Cuando tengas el CSV final con la MESA y el ORDEN de cada
 * elector, este script actualiza SOLO esos dos campos sobre el
 * padrón ya cargado.
 *
 * GARANTÍAS (reglas estrictas):
 *   • Escribe únicamente los hijos  padron/{cedula}/mesa  y
 *     padron/{cedula}/orden  → NUNCA toca nombre, apellido,
 *     distrito, local, etc.
 *   • Usa la cédula como clave → NUNCA duplica un elector.
 *   • Si la cédula no existe en el padrón, la reporta y la omite
 *     (no crea registros basura).
 *   • Con --solo-vacios solo completa los que están vacíos
 *     (no pisa una mesa/orden ya asignada).
 *
 * USO:
 *   node scripts/cruzar_mesas.js "MESAS_FINAL.csv"
 *   node scripts/cruzar_mesas.js "MESAS_FINAL.csv" --solo-vacios
 *   node scripts/cruzar_mesas.js "MESAS_FINAL.csv" --dry-run   (simula, no escribe)
 *
 * Requiere:  npm i firebase-admin   +   serviceAccountKey.json
 *
 * El CSV debe tener encabezados que incluyan (en cualquier orden):
 *   cedula , mesa , orden
 * (acepta variantes: CEDULA/CI, MESA, ORDEN/ORD). Separador , o ;
 * -------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const INPUT = process.argv[2];
const SOLO_VACIOS = process.argv.includes("--solo-vacios");
const DRY_RUN = process.argv.includes("--dry-run");

if (!INPUT) {
  console.error('Uso: node scripts/cruzar_mesas.js "MESAS_FINAL.csv" [--solo-vacios] [--dry-run]');
  process.exit(1);
}

function parseLine(line, sep) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function detectarSep(headerLine) {
  return (headerLine.split(";").length > headerLine.split(",").length) ? ";" : ",";
}

function idxDe(headers, nombres) {
  const norm = headers.map(h => h.trim().toLowerCase());
  for (const n of nombres) { const i = norm.indexOf(n); if (i !== -1) return i; }
  return -1;
}

async function main() {
  const csvPath = path.resolve(INPUT);
  if (!fs.existsSync(csvPath)) { console.error("❌ No existe:", csvPath); process.exit(1); }

  let admin;
  try { admin = require("firebase-admin"); }
  catch { console.error("❌ Falta firebase-admin. Ejecutá: npm i firebase-admin"); process.exit(1); }
  const keyPath = path.resolve("serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) { console.error("❌ Falta serviceAccountKey.json"); process.exit(1); }

  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
    databaseURL: "https://canindeyu-bd-default-rtdb.firebaseio.com",
  });
  const db = admin.database();

  console.log("📖 Leyendo CSV de mesas:", csvPath);
  const lineas = fs.readFileSync(csvPath, "latin1").split("\n").filter(l => l.trim());
  const sep = detectarSep(lineas[0]);
  const headers = parseLine(lineas[0], sep);
  const iCed = idxDe(headers, ["cedula", "ci", "documento", "nro_ci"]);
  const iMesa = idxDe(headers, ["mesa", "nro_mesa"]);
  const iOrden = idxDe(headers, ["orden", "ord", "nro_orden"]);
  if (iCed === -1 || iMesa === -1 || iOrden === -1) {
    console.error("❌ El CSV debe tener columnas: cedula, mesa, orden. Encontrado:", headers);
    process.exit(1);
  }

  // 1) Cargar el padrón actual una sola vez (para validar existencia y --solo-vacios)
  console.log("📥 Descargando índice del padrón actual...");
  const snap = await db.ref("padron").get();
  const padron = snap.val() || {};
  console.log(`   Padrón en Firebase: ${Object.keys(padron).length.toLocaleString()} registros.`);

  const updates = {};
  let aplicar = 0, noExiste = 0, yaAsignado = 0, sinDatos = 0;

  for (let i = 1; i < lineas.length; i++) {
    const f = parseLine(lineas[i], sep);
    const ci = (f[iCed] || "").trim();
    const mesa = (f[iMesa] || "").trim();
    const orden = (f[iOrden] || "").trim();
    if (!ci) continue;
    if (!mesa && !orden) { sinDatos++; continue; }

    const actual = padron[ci];
    if (!actual) { noExiste++; continue; }           // no crea registros nuevos

    if (SOLO_VACIOS && (actual.mesa || actual.orden)) { yaAsignado++; continue; }

    // SOLO los hijos mesa/orden → no toca ningún otro campo, no duplica
    updates[`padron/${ci}/mesa`] = mesa;
    updates[`padron/${ci}/orden`] = orden;
    aplicar++;
  }

  console.log("──────────────────────────────────────");
  console.log("✏️  A actualizar (mesa/orden):", aplicar.toLocaleString());
  console.log("🚫 Cédula no está en padrón  :", noExiste.toLocaleString());
  console.log("⏭️  Ya tenían asignación      :", yaAsignado.toLocaleString());
  console.log("➖ Filas sin mesa/orden       :", sinDatos.toLocaleString());
  console.log("──────────────────────────────────────");

  if (DRY_RUN) { console.log("🧪 --dry-run: no se escribió nada."); process.exit(0); }
  if (aplicar === 0) { console.log("Nada que actualizar."); process.exit(0); }

  // 2) Escribir por lotes (update multi-path: seguro, no duplica)
  const keys = Object.keys(updates);
  const LOTE = 10000; // cada elector aporta 2 claves
  for (let i = 0; i < keys.length; i += LOTE) {
    const parcial = {};
    keys.slice(i, i + LOTE).forEach(k => { parcial[k] = updates[k]; });
    await db.ref().update(parcial);
    console.log(`   escritas ${Math.min(i + LOTE, keys.length).toLocaleString()} / ${keys.length.toLocaleString()} claves`);
  }
  console.log("✅ Merge completo. Solo se tocaron mesa y orden.");
  process.exit(0);
}

main().catch(e => { console.error("❌ Error:", e); process.exit(1); });
