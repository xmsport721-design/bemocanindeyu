// ============================================================================
// k6 — Prueba de rendimiento Día D (04-oct, 07:00–18:00)
// Objetivo: 300 veedores + 200 usuarios = ~500 concurrentes en tiempo real.
// ----------------------------------------------------------------------------
// QUÉ TESTEA (capa HTTP, sin login, seguro / solo lectura):
//   1) Supabase RPC buscar_padron          (concejal/dirigente/coordinador/veedor)
//   2) Supabase RPC buscar_padron_cedulas   (cruzamiento masivo del coordinador)
//   3) Carga del SPA en Cloudflare          (arranque de la app)
// NO testea el pintado/paso-pc/escrutinio (Firebase RTDB) porque requieren login
// y escribirían datos reales. Para esa capa: ver el análisis (Blaze + métricas).
//
// USO:
//   1) Instalá k6: https://k6.io/docs/get-started/installation/
//   2) Corré ANTES del día D (no el 04/10):   k6 run scripts/k6_dia_d.js
//   3) Ideal: con Supabase en el plan que vayas a usar el día D (Pro recomendado).
// ============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const SUPA = 'https://ukchukteafaoidpffabx.supabase.co';
const ANON = 'sb_publishable_QJoGkzPltJnUZF2aAlOdPw_cntghqVM';
const APP  = 'https://sergiocarrillo2026.bemo.workers.dev';

const tBuscar   = new Trend('t_buscar_padron_ms');
const tCedulas  = new Trend('t_buscar_cedulas_ms');
const errores   = new Rate('errores');

const APELLIDOS = ['GONZALEZ','GIMENEZ','BENITEZ','MARTINEZ','LOPEZ','RAMIREZ','FERREIRA','VILLALBA','ROJAS','AGUERO','MEDINA','RUIZ','CABRERA','ORTIZ','DUARTE','PAREDES','GAYOSO','GOSSEN','FLORENTIN','GAUTO'];
const DISTRITOS = ['CONCEPCION','HORQUETA','BELEN','LORETO','SAN LAZARO','YBY YA\'U','AZOTEY'];

const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cedula = () => String(1000000 + Math.floor(Math.random() * 6500000));

export const options = {
  scenarios: {
    dia_d: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // apertura de mesas 07:00
        { duration: '2m', target: 300 },  // ritmo normal
        { duration: '2m', target: 500 },  // objetivo: 300 veedores + 200 usuarios
        { duration: '3m', target: 500 },  // SOSTENIDO en el objetivo
        { duration: '2m', target: 700 },  // buscar el techo (margen)
        { duration: '1m', target: 0 },    // enfriamiento
      ],
    },
  },
  thresholds: {
    't_buscar_padron_ms':  ['p(95)<1500', 'p(99)<3000'],
    't_buscar_cedulas_ms': ['p(95)<2000'],
    'errores':             ['rate<0.02'],   // < 2% de errores
    'http_req_failed':     ['rate<0.02'],
  },
};

export default function () {
  const r = Math.random();

  if (r < 0.60) {
    // Consulta por nombre o cédula, acotada por distrito (lo más común)
    const q = Math.random() < 0.5 ? pick(APELLIDOS) : cedula();
    const res = http.post(`${SUPA}/rest/v1/rpc/buscar_padron`,
      JSON.stringify({ q, dist: pick(DISTRITOS) }), { headers: H, tags: { name: 'buscar_padron' } });
    tBuscar.add(res.timings.duration);
    errores.add(res.status !== 200);
    check(res, { 'buscar 200': (x) => x.status === 200 });

  } else if (r < 0.75) {
    // Consulta global por cédula (dirigente / búsqueda Día D)
    const res = http.post(`${SUPA}/rest/v1/rpc/buscar_padron`,
      JSON.stringify({ q: cedula(), dist: null }), { headers: H, tags: { name: 'buscar_global' } });
    tBuscar.add(res.timings.duration);
    errores.add(res.status !== 200);
    check(res, { 'global 200': (x) => x.status === 200 });

  } else if (r < 0.90) {
    // Cruzamiento masivo (coordinador importando ~20 cédulas)
    const ceds = Array.from({ length: 20 }, cedula);
    const res = http.post(`${SUPA}/rest/v1/rpc/buscar_padron_cedulas`,
      JSON.stringify({ cedulas: ceds, dist: pick(DISTRITOS) }), { headers: H, tags: { name: 'buscar_cedulas' } });
    tCedulas.add(res.timings.duration);
    errores.add(res.status !== 200);
    check(res, { 'cedulas 200': (x) => x.status === 200 });

  } else {
    // Arranque de la app (Cloudflare estático)
    const res = http.get(`${APP}/`, { tags: { name: 'app_html' } });
    errores.add(res.status !== 200);
    check(res, { 'app 200': (x) => x.status === 200 });
  }

  sleep(Math.random() * 2 + 1); // 1–3s entre acciones (ritmo humano real)
}
