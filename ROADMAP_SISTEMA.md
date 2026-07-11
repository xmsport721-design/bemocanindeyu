# Sistema Electoral BEMO 2026 — Carga de padrón, Cloud SQL, Cloudflare y arquitectura

## FASE 1 — Cargar el nuevo padrón AHORA (Firebase RTDB, ya funciona con la app actual)

El CSV `1-CONCEPCION.CSV.CSV` (171.112 electores) ya fue procesado:

```
node scripts/importar_padron.js "1-CONCEPCION.CSV.CSV"
```
Genera **`padron_import.json`** (49 MB) con SOLO lo fundamental y **mesa/orden/afiliación vacíos**:
`cedula, nombre, apellido, departamento, cod_distrito, distrito(nombre), cod_local, local(nombre), fecha_nac, direccion`.

**Para subirlo a Firebase — 2 opciones:**

- **A) Consola (simple):** Firebase Console → Realtime Database → menú ⋮ → *Importar JSON* → subir `padron_import.json` en el **nodo raíz**. (Queda en `padron/{cedula}`.)
- **B) Por lotes (recomendado para 49 MB):**
  1. Firebase Console → ⚙️ → *Cuentas de servicio* → *Generar clave privada* → guardar como `serviceAccountKey.json` en la raíz del proyecto.
  2. `npm i firebase-admin`
  3. `node scripts/importar_padron.js "1-CONCEPCION.CSV.CSV" --upload`

> `serviceAccountKey.json` NO debe subirse a git (agregar a `.gitignore`).

## FASE 2 — Cruzar MESA y ORDEN (merge seguro, cuando tengas el CSV final)

```
node scripts/cruzar_mesas.js "MESAS_FINAL.csv"            # completa mesa/orden
node scripts/cruzar_mesas.js "MESAS_FINAL.csv" --dry-run  # simula sin escribir
node scripts/cruzar_mesas.js "MESAS_FINAL.csv" --solo-vacios
```
Reglas garantizadas: escribe **solo** `padron/{ci}/mesa` y `padron/{ci}/orden`; **no** toca otros campos; **no** duplica (clave = cédula); si la cédula no existe, la omite. El CSV solo necesita columnas `cedula, mesa, orden`.

---

## Google Cloud SQL + Firebase Data Connect (migración opcional a SQL)

Data Connect es la pieza de Firebase que se apoya en **Cloud SQL (PostgreSQL)** y convive con Auth/RTDB.

**Pasos:**
1. **Crear la instancia Cloud SQL:** Consola Google Cloud → SQL → *Crear instancia* → PostgreSQL → región `southamerica-east1` (São Paulo, más cercana). Crear base `electoral`.
2. **Habilitar Data Connect:** Firebase Console → *Build → Data Connect* → *Comenzar* → vincular el proyecto `canindeyu-bd` a esa instancia Cloud SQL.
3. **Definir el esquema:** ya está en `dataconnect/schema/schema.gql` (tabla `padron`, cédula = clave). Deploy: `firebase deploy --only dataconnect`.
4. **Cargar datos:** `node scripts/upsert_sql.js init padron_import.json` (usa `ON CONFLICT` → no duplica).
5. **Cruzar mesas:** `node scripts/upsert_sql.js mesas MESAS_FINAL.csv` (UPDATE solo mesa/orden).

**Firebase + SQL juntos:** Auth (teléfono) y presencia siguen en Firebase; el padrón vive en Cloud SQL vía Data Connect. La app usa el mismo SDK de Firebase para ambos.

**Autenticación por teléfono:** Firebase Console → *Authentication → Sign-in method* → habilitar **Teléfono**; agregar dominios autorizados (el de Cloudflare). En el frontend: `signInWithPhoneNumber` + `RecaptchaVerifier`.

### Ejemplo de mutación en el frontend React (Data Connect)
```js
import { getDataConnect } from "firebase/data-connect";
import { asignarMesaOrden } from "@dataconnect/generated"; // hooks generados

// Merge seguro de mesa/orden desde la UI (solo toca esos 2 campos):
await asignarMesaOrden({ cedula: "3467143", mesa: "12", orden: "45" });
```

---

## Despliegue en Cloudflare (reemplazo de Netlify)

El proyecto es un React estático (`react-scripts build` → carpeta `build/`). En **Cloudflare Pages/Workers**:

1. Dashboard Cloudflare → *Workers & Pages* → conectar el repo de GitHub.
2. Build command: `npm run build` — Output dir: `build`.
3. Variables de entorno: las claves de Firebase ya están en `src/App.js` (públicas, es normal en Firebase web).
4. El archivo `wrangler.toml` (incluido) y `public/_redirects` sirven la SPA (todas las rutas → `index.html`).

> Quitar Netlify: borrar `netlify.toml`/`_redirects` de Netlify si existen y desconectar el sitio.

---

## Arquitectura limpia (modularización de `src/App.js`)

Hoy `App.js` es monolítico (~1900 líneas). Propuesta de estructura (Fase 3, refactor incremental sin cambiar comportamiento):

```
src/
├─ firebase.js                 # init de Firebase (config, db, auth)  ← extraer de App.js
├─ App.js                      # router de roles (delgado)
├─ lib/
│  ├─ llaves.js                # generarLlave(distrito, mesa, orden)
│  └─ padron.js                # helpers de búsqueda/filtrado
├─ hooks/
│  ├─ usePadron.js             # carga/filtra padrón por distrito
│  └─ usePresencia.js          # estado_online / onDisconnect
├─ components/                 # reutilizables
│  ├─ BuscadorCedula.jsx
│  ├─ TarjetaElector.jsx
│  ├─ StatCard.jsx
│  └─ ModalMesa.jsx
└─ screens/
   ├─ LoginScreen.jsx
   ├─ AppVeedor.jsx
   ├─ AppDirigente.jsx
   ├─ AppConcejal.jsx
   └─ AppSuperAdmin.jsx
```

Elementos repetidos a extraer como componentes: tarjetas de estadística, buscador por cédula, tarjeta de elector, modales de mesa, badges de estado. Se hace pantalla por pantalla para no romper nada.
