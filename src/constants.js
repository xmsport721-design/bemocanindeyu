// ============================================================================
// CONSTANTES DEL SISTEMA — Departamento de CONCEPCIÓN
// ============================================================================

export const DISTRITOS_CONCEPCION = [
  "CONCEPCION", "BELEN", "HORQUETA", "LORETO", "SAN LAZARO",
  "YBY YA'U", "AZOTEY", "SGTO.JOSE FELIX LOPEZ", "SAN CARLOS DEL APA",
  "SAN ALFREDO", "PASO BARRETO", "ARROYITO", "PASO HORQUETA", "ITACUA",
];

export const NOMBRE_DEPARTAMENTO = "CONCEPCIÓN";

// ── FASES ──
// La carga de datos (registro, masiva, links de coordinador) está habilitada
// hasta el 02-oct inclusive. Desde el 03-oct = "Modo Día D": solo consulta
// (dirigentes, buscador Día D, veedor, escrutinio, métricas). Se cierra la carga
// para no ensuciar el gráfico con cargas de último momento.
export const FECHA_CIERRE_CARGA = new Date('2026-10-03T03:00:00Z'); // 03-oct 00:00 Paraguay (UTC-3)
export const enModoDiaD = () => Date.now() >= FECHA_CIERRE_CARGA.getTime();

// Instituciones (coordinadores institucionales del adm local). Agregar libremente.
export const INSTITUCIONES = [
  "SENASA", "CRÉDITO AGRÍCOLA", "IPS", "HOSPITAL DISTRITAL", "APS",
  "ANDE", "TENONDERÁ", "DOCENTES",
];

// --- DICCIONARIO DE FOTOS LOCALES (claves normalizadas) ---
export const FOTOS_LOCALES_CONCEJALES = {
  "FABIOPORTILLO": "/fotos/1-fabio_portillo.jpg",
  "JULIOCABRERA": "/fotos/2- julio_cabrera.jpg",
  "JOELVILLASANTI": "/fotos/3-joel_villasanti.jpg",
  "ELENOVERON": "/fotos/4-eleno_verón.jpg",
  "GLADYSSANTANDER": "/fotos/5-gladys_santander.jpg",
  "EDGARMONZON": "/fotos/6-edgar_verón.jpg",
  "MARCELINOGONZALEZ": "/fotos/7-marcelino_gonzález.jpg",
  "ISMAELFERNANDEZ": "/fotos/8-ismael_fernández.jpg",
  "LUZMABELR": "/fotos/9-luz_mabel_r.jpg",

  // --- HORQUETA (intendente + 12 concejales) ---
  "SERGIOCARRILLO": "/fotos/horqueta/intendente-sergio_carrillo.jpg",
  "RAQUELPAREDES": "/fotos/horqueta/1-raquel_paredes.jpg",
  "JOSEVILLALBA": "/fotos/horqueta/2-jose_villalba.jpg",
  "JAVIERGAYOSO": "/fotos/horqueta/3-javier_gayoso.jpg",
  "CRISTINOVILLALBA": "/fotos/horqueta/4-cristino_villalba.jpg",
  "FARIDGOSSEN": "/fotos/horqueta/5-farid_gossen.jpg",
  "LUISAGUERO": "/fotos/horqueta/6-luis_aguero.jpg",
  "RICARDOIBANEZ": "/fotos/horqueta/7-ricardo_ibanez.jpg",
  "NENEFLORENTIN": "/fotos/horqueta/8-nene_florentin.jpg",
  "CECILIOFERREIRA": "/fotos/horqueta/9-cecilio_ferreira.jpg",
  "ALBERTHGAUTO": "/fotos/horqueta/10-alberth_gauto.jpg",
  "OSCARMEDINA": "/fotos/horqueta/11-oscar_medina.jpg",
  "NELSONRUIZ": "/fotos/horqueta/12-nelson_ruiz.jpg",
};
