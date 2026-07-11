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
const admin = require("firebase-admin");

const keyPath = path.resolve("serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error("❌ Falta serviceAccountKey.json en la raíz del proyecto.");
  console.error("   Firebase Console → ⚙️ → Cuentas de servicio → Generar nueva clave privada.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
  databaseURL: "https://canindeyu-bd-default-rtdb.firebaseio.com",
});

const DISTRITO_LOCAL = "CONCEPCION";           // distrito del admin local (ajustable)
const SERGIO_UID = "uGSL9CwAmbg5fwPLbFAPRkctP9g2";
const COMANDO = { email: "comando@bemo.com", pass: "bemo2026" };

async function main() {
  const db = admin.database();
  const authAdmin = admin.auth();

  // 1) Crear (o recuperar) el usuario COMANDO en Firebase Auth
  let comandoUid;
  try {
    const u = await authAdmin.createUser({ email: COMANDO.email, password: COMANDO.pass });
    comandoUid = u.uid;
    console.log("✅ Usuario creado en Auth:", COMANDO.email);
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      const u = await authAdmin.getUserByEmail(COMANDO.email);
      comandoUid = u.uid;
      await authAdmin.updateUser(comandoUid, { password: COMANDO.pass });
      console.log("ℹ️  Ya existía; contraseña actualizada:", COMANDO.email);
    } else throw e;
  }

  // 2) Perfil COMANDO = master_departamental (ve TODO el departamento)
  await db.ref(`usuarios/${comandoUid}`).set({
    email: COMANDO.email,
    password_plain: COMANDO.pass,
    rol: "master_departamental",
    distrito: DISTRITO_LOCAL,
    nombre_oficial: "COMANDO",
  });
  console.log("✅ COMANDO (master_departamental) -> UID", comandoUid);

  // 3) Perfil SERGIO = super_admin (intendente / admin local)
  await db.ref(`usuarios/${SERGIO_UID}`).set({
    email: "sergio2026@bemo.com",
    password_plain: "",            // cosmético; completalo desde el panel si querés
    rol: "super_admin",
    distrito: DISTRITO_LOCAL,
    nombre_oficial: "SERGIO CARRILLO",
  });
  console.log("✅ SERGIO (super_admin / admin local) -> UID", SERGIO_UID);

  console.log("\n🎉 Listo:");
  console.log("   • comando@bemo.com  / bemo2026  -> COMANDO DEPARTAMENTAL (ve todos los distritos)");
  console.log("   • sergio2026@bemo.com           -> ADMIN LOCAL de", DISTRITO_LOCAL);
  process.exit(0);
}

main().catch((e) => { console.error("❌ Error:", e.code || "", e.message); process.exit(1); });
