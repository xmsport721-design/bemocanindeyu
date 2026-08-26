// ============================================================================
// GENERADORES DE LLAVES — identifican voto y mesa de forma ÚNICA.
// IMPORTANTE: incluye cod_local porque el N° de mesa se repite entre locales
// (Mesa 1 existe en varios locales). Sin cod_local habría choques (~32k).
// Formato: distrito_codlocal_mesa_orden  y  distrito_codlocal_mesa
// ============================================================================
const limpiar = (s) => String(s == null ? "" : s).toUpperCase().replace(/[.$#[\]/]/g, "").trim();

export const generarLlave = (distrito, codLocal, mesa, orden) =>
  limpiar(`${distrito}_${codLocal}_${mesa}_${orden}`);

export const generarLlaveMesa = (distrito, codLocal, mesa) =>
  limpiar(`${distrito}_${codLocal}_${mesa}`);
