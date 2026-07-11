// ============================================================================
// GENERADORES DE LLAVES — identifican voto (distrito_mesa_orden) y mesa
// Se normalizan a MAYÚSCULAS y se quitan caracteres inválidos para Firebase.
// ============================================================================

export const generarLlave = (distrito, mesa, orden) =>
  `${distrito}_${mesa}_${orden}`.toUpperCase().replace(/[.$#[\]/]/g, "").trim();

export const generarLlaveMesa = (distrito, mesa) =>
  `${distrito}_${mesa}`.toUpperCase().replace(/[.$#[\]/]/g, "").trim();
