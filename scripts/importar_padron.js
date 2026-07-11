/**
 * importar_padron.js
 * -------------------------------------------------------------
 * Convierte el CSV del padrón (formato TSJE, Latin-1, filas
 * envueltas en comillas dobles) al esquema que usa la app en
 * Firebase Realtime Database:  padron/{cedula} = { ... }
 *
 * Deja MESA, ORDEN y AFILIACION vacíos a propósito: se completan
 * después con scripts/cruzar_mesas.js (merge seguro).
 *
 * USO:
 *   1) Generar JSON para importar desde la consola de Firebase:
 *        node scripts/importar_padron.js "1-CONCEPCION.CSV.CSV"
 *      -> crea  padron_import.json  (nodo: padron)
 *
 *   2) Subir directamente a Firebase (requiere serviceAccountKey.json):
 *        node scripts/importar_padron.js "1-CONCEPCION.CSV.CSV" --upload
 * -------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const INPUT = process.argv[2] || "1-CONCEPCION.CSV.CSV";
const DO_UPLOAD = process.argv.includes("--upload");
const OUT_JSON = "padron_import.json";

// --- Parser de una línea CSV interna (campos separados por coma,
//     con comillas simples estándar y comas dentro de comillas) ---
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Cada fila de datos viene envuelta como UN campo entrecomillado
// con las comillas internas dobladas ("").  Se "desenvuelve" y
// luego se parsea el CSV real que quedó adentro.
function unwrapRow(raw) {
  let s = raw.replace(/\r$/, "");
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  s = s.replace(/""/g, '"');
  return parseCsvLine(s);
}

function limpiar(v) {
  return (v == null ? "" : String(v)).trim();
}

function main() {
  const csvPath = path.resolve(INPUT);
  if (!fs.existsSync(csvPath)) {
    console.error("❌ No se encontró el archivo:", csvPath);
    process.exit(1);
  }

  console.log("📖 Leyendo (Latin-1):", csvPath);
  const contenido = fs.readFileSync(csvPath, "latin1");
  const lineas = contenido.split("\n");

  // Índices según el encabezado del CSV del TSJE:
  // 0 depart,1 des_dep,2 distrito,3 des_dis,4 zona,5 des_zon,
  // 6 local,7 des_loc,8 talon,9 boleta,10 cedula,11 nombre,
  // 12 apellido,13 sexo,14 fec_nac,...,20 direcc
  const IDX = {
    des_dep: 1, cod_dis: 2, des_dis: 3,
    cod_local: 6, des_loc: 7,
    cedula: 10, nombre: 11, apellido: 12,
    fec_nac: 14, direcc: 20,
  };

  const padron = {};
  let ok = 0, sinCedula = 0, duplicados = 0, errores = 0;

  for (let i = 1; i < lineas.length; i++) {   // i=1: saltar encabezado
    const raw = lineas[i];
    if (!raw || !raw.trim()) continue;
    let f;
    try { f = unwrapRow(raw); } catch { errores++; continue; }

    const cedula = limpiar(f[IDX.cedula]);
    if (!cedula || !/^\d+$/.test(cedula)) { sinCedula++; continue; }
    if (padron[cedula]) { duplicados++; continue; }  // sin duplicar

    padron[cedula] = {
      cedula,
      nombre:       limpiar(f[IDX.nombre]),
      apellido:     limpiar(f[IDX.apellido]),
      departamento: limpiar(f[IDX.des_dep]),
      cod_distrito: limpiar(f[IDX.cod_dis]),
      distrito:     limpiar(f[IDX.des_dis]),   // NOMBRE (la app filtra por esto)
      cod_local:    limpiar(f[IDX.cod_local]),
      local:        limpiar(f[IDX.des_loc]),   // NOMBRE (la app muestra esto)
      fecha_nac:    limpiar(f[IDX.fec_nac]),
      direccion:    limpiar(f[IDX.direcc]),
      mesa:  "",        // se completa luego (merge seguro)
      orden: "",        // se completa luego (merge seguro)
      afiliacion: "",   // se completa luego
    };
    ok++;
  }

  console.log("──────────────────────────────────────");
  console.log("✅ Electores válidos :", ok.toLocaleString());
  console.log("⚠️  Sin cédula válida :", sinCedula.toLocaleString());
  console.log("♻️  Duplicados omitidos:", duplicados.toLocaleString());
  console.log("❌ Filas con error   :", errores.toLocaleString());
  console.log("──────────────────────────────────────");

  if (DO_UPLOAD) return subir(padron);

  const salida = { padron };
  fs.writeFileSync(OUT_JSON, JSON.stringify(salida), "utf8");
  const mb = (fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(1);
  console.log(`💾 Generado ${OUT_JSON} (${mb} MB).`);
  console.log("   Impórtalo en Firebase RTDB en el nodo raíz (Importar JSON).");
  console.log("   O ejecutá con --upload para subirlo por lotes.");
}

// --- Subida por lotes con firebase-admin (opcional) ---
async function subir(padron) {
  let admin;
  try { admin = require("firebase-admin"); }
  catch {
    console.error("❌ Falta firebase-admin. Instalá:  npm i firebase-admin");
    process.exit(1);
  }
  const keyPath = path.resolve("serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) {
    console.error("❌ Falta serviceAccountKey.json (clave de cuenta de servicio).");
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
    databaseURL: "https://canindeyu-bd-default-rtdb.firebaseio.com",
  });
  const db = admin.database();

  const cedulas = Object.keys(padron);
  const LOTE = 5000;
  console.log(`⬆️  Subiendo ${cedulas.length.toLocaleString()} registros en lotes de ${LOTE}...`);
  for (let i = 0; i < cedulas.length; i += LOTE) {
    const chunk = cedulas.slice(i, i + LOTE);
    const updates = {};
    chunk.forEach((ci) => { updates[`padron/${ci}`] = padron[ci]; });
    await db.ref().update(updates);
    console.log(`   ${Math.min(i + LOTE, cedulas.length).toLocaleString()} / ${cedulas.length.toLocaleString()}`);
  }
  console.log("✅ Padrón subido a Firebase.");
  process.exit(0);
}

main();
