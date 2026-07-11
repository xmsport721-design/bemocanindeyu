/**
 * crear_usuarios.js — Crea el usuario COMANDO y asigna roles (Dpto. Concepción).
 * -------------------------------------------------------------
 *   • comando@bemo.com / bemo2026  -> master_departamental (control total)
 *   • sergio2026@bemo.com (UID existente) -> super_admin (admin local)
 *
 * Usa el ADMIN SDK (no depende de la API key web, que está restringida).
 * Requiere:  npm i firebase-admin   +   serviceAccountKey.json en la raíz.
 *
 * USO:  node scripts/crear_usuarios.js
 * -------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

// Busca el archivo de clave de servicio (nombre exacto o el que descarga Firebase).
function hallarKey() {
  if (fs.existsSync("serviceAccountKey.json")) return "serviceAccountKey.json";
  const cand = fs.readdirSync(".").find(f => /firebase-adminsdk.*\.json$/i.test(f));
  return cand || null;
}
const keyFile = hallarKey();
if (!keyFile) {
  console.error("❌ No encontré la clave de servicio (serviceAccountKey.json o *firebase-adminsdk*.json) en la raíz.");
  process.exit(1);
}
console.log("🔑 Usando clave:", keyFile);

initializeApp({
  credential: cert(require(path.resolve(keyFile))),
  databaseURL: "https://concepcion-7e55e-default-rtdb.firebaseio.com",
});

const DISTRITO_LOCAL = "CONCEPCION";           // distrito del admin local (ajustable)
const COMANDO = { email: "comando@bemo.com", pass: "bemo2026" };
const SERGIO  = { email: "sergio2026@bemo.com", pass: "sergio2026" }; // por si hay que crearlo

// Crea el usuario si no existe; si existe, actualiza la contraseña. Devuelve el UID.
async function asegurarUsuario(authAdmin, email, pass) {
  try {
    const u = await authAdmin.createUser({ email, password: pass });
    console.log("✅ Creado en Auth:", email, "(contraseña:", pass + ")");
    return u.uid;
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      const u = await authAdmin.getUserByEmail(email);
      console.log("ℹ️  Ya existía:", email);
      return u.uid;
    }
    throw e;
  }
}

async function main() {
  const db = getDatabase();
  const authAdmin = getAuth();

  // 1) COMANDO = master_departamental (ve TODO el departamento)
  const comandoUid = await asegurarUsuario(authAdmin, COMANDO.email, COMANDO.pass);
  await db.ref(`usuarios/${comandoUid}`).set({
    email: COMANDO.email,
    password_plain: COMANDO.pass,
    rol: "master_departamental",
    distrito: DISTRITO_LOCAL,
    nombre_oficial: "COMANDO",
  });
  console.log("✅ COMANDO (master_departamental) -> UID", comandoUid);

  // 2) SERGIO = super_admin (intendente / admin local)
  const sergioUid = await asegurarUsuario(authAdmin, SERGIO.email, SERGIO.pass);
  await db.ref(`usuarios/${sergioUid}`).set({
    email: SERGIO.email,
    password_plain: SERGIO.pass,
    rol: "super_admin",
    distrito: DISTRITO_LOCAL,
    nombre_oficial: "SERGIO CARRILLO",
  });
  console.log("✅ SERGIO (super_admin / admin local) -> UID", sergioUid);

  console.log("\n🎉 Listo:");
  console.log("   • comando@bemo.com   / bemo2026    -> COMANDO DEPARTAMENTAL (ve todos los distritos)");
  console.log("   • sergio2026@bemo.com / sergio2026 -> ADMIN LOCAL de", DISTRITO_LOCAL);
  process.exit(0);
}

main().catch((e) => { console.error("❌ Error:", e.code || "", e.message); process.exit(1); });
