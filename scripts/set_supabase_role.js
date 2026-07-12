/**
 * set_supabase_role.js
 * -------------------------------------------------------------
 * Le asigna el custom claim { role: 'authenticated' } a TODOS los
 * usuarios de Firebase Auth. Sin esto, Supabase trata los tokens de
 * Firebase como `anon` y las políticas RLS (solo authenticated) los
 * bloquean.
 *
 * Se corre UNA vez ahora (usuarios existentes). Para los NUEVOS
 * usuarios que cree la app, hay que volver a correrlo, o agregar el
 * claim al momento de crearlos.
 *
 * Requiere: firebase-admin + serviceAccountKey (*firebase-adminsdk*.json)
 * USO:  node scripts/set_supabase_role.js
 * -------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const keyFile = fs.readdirSync(".").find(f => /firebase-adminsdk.*\.json$/i.test(f)) ||
  (fs.existsSync("serviceAccountKey.json") ? "serviceAccountKey.json" : null);
if (!keyFile) { console.error("❌ Falta la clave de servicio de Firebase."); process.exit(1); }

initializeApp({ credential: cert(require(path.resolve(keyFile))) });

async function main() {
  const auth = getAuth();
  let nextPageToken, total = 0;
  do {
    const lista = await auth.listUsers(1000, nextPageToken);
    nextPageToken = lista.pageToken;
    await Promise.all(lista.users.map(async (u) => {
      const claims = u.customClaims || {};
      if (claims.role === "authenticated") return; // ya lo tiene
      await auth.setCustomUserClaims(u.uid, { ...claims, role: "authenticated" });
      total++;
      console.log("  ✓", u.email || u.uid);
    }));
  } while (nextPageToken);
  console.log(`✅ Listo. ${total} usuario(s) marcados como 'authenticated'.`);
  console.log("   (Deben cerrar sesión y volver a entrar para recibir el token nuevo.)");
  process.exit(0);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
