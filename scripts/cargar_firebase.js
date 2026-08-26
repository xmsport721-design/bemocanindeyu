/**
 * cargar_firebase.js — Sube padron_import.json a Firebase RTDB (reemplazo limpio por lotes).
 * 1) upsert del padrón nuevo (lotes)  2) borra las cédulas viejas que ya no están.
 * Requiere: firebase-admin + serviceAccountKey (*firebase-adminsdk*.json)
 * USO:  node scripts/cargar_firebase.js
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const keyFile = fs.readdirSync(".").find(f => /firebase-adminsdk.*\.json$/i.test(f)) ||
  (fs.existsSync("serviceAccountKey.json") ? "serviceAccountKey.json" : null);
if (!keyFile) { console.error("❌ Falta la clave de servicio de Firebase."); process.exit(1); }

const DBURL = "https://concepcion-7e55e-default-rtdb.firebaseio.com";
const cred = cert(require(path.resolve(keyFile)));
initializeApp({ credential: cred, databaseURL: DBURL });

async function main() {
  const { padron } = JSON.parse(fs.readFileSync("padron_import.json", "utf8"));
  const nuevas = Object.keys(padron);
  const db = getDatabase();
  const LOTE = 5000;

  // 1) UPSERT del padrón nuevo (lotes chicos, no WRITE_TOO_BIG)
  console.log(`⬆️  Subiendo ${nuevas.length.toLocaleString()} electores...`);
  for (let i = 0; i < nuevas.length; i += LOTE) {
    const u = {};
    nuevas.slice(i, i + LOTE).forEach(ci => { u[`padron/${ci}`] = padron[ci]; });
    await db.ref().update(u);
    console.log(`   ${Math.min(i + LOTE, nuevas.length).toLocaleString()} / ${nuevas.length.toLocaleString()}`);
  }

  // 2) BORRAR las cédulas viejas que ya no están en el padrón nuevo
  console.log("🔎 Buscando electores viejos a borrar...");
  const tok = (await cred.getAccessToken()).access_token;
  const r = await fetch(`${DBURL}/padron.json?shallow=true&access_token=${tok}`);
  const allKeys = Object.keys((await r.json()) || {});
  const set = new Set(nuevas);
  const stale = allKeys.filter(k => !set.has(k));
  console.log(`🗑️  Borrando ${stale.length.toLocaleString()} viejos...`);
  for (let i = 0; i < stale.length; i += LOTE) {
    const u = {};
    stale.slice(i, i + LOTE).forEach(ci => { u[`padron/${ci}`] = null; });
    await db.ref().update(u);
  }

  console.log("✅ Firebase RTDB actualizado (170.460 con mesa/orden, sin viejos).");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
