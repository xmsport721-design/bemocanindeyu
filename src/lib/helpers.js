// ============================================================================
// HELPERS PUROS COMPARTIDOS — normalización de nombres, carnets (WhatsApp/impresión)
// ============================================================================

export const normalizarNombre = (str) => {
    if (!str) return "";
    return String(str).toUpperCase()
              .normalize("NFD")
              .replace(/LISTA/g, '')
              .replace(/[0-9]/g, '')
              .replace(/[^A-Z]/g, '');
};

export const concejalCoincide = (votoConcejal, configConcejal) => {
    if (!votoConcejal || !configConcejal) return false;
    return normalizarNombre(votoConcejal) === normalizarNombre(configConcejal);
};

export const enviarWhatsAppCarnet = (v) => {
    if (!v.telefono) return alert("Este votante no tiene número de teléfono registrado.");
    let tel = v.telefono.replace(/\s+/g, '');
    if (tel.startsWith('0')) tel = '595' + tel.substring(1);
    const msj = `*🗳️ CARNET ELECTORAL*\n\nHola *${v.nombre} ${v.apellido}*,\nEstos son tus datos para el Día D:\n\n*C.I:* ${v.cedula}\n*DISTRITO:* ${v.distrito}\n*LOCAL:* ${v.local}\n*MESA:* ${v.mesa} | *ORDEN:* ${v.orden}\n\n¡Contamos con tu apoyo!`;
    window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(msj)}`, '_blank');
};

export const imprimirCarnetFisico = (v, fotoBaseConcejal) => {
    const vent = window.open('', '_blank');
    vent.document.write(`<html><head><title>Carnet Electoral</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#eee}@media print{body{background:white}.carnet{box-shadow:none;border:2px solid #991e1e}}.carnet{width:6cm;height:9cm;background:white;border:2px solid #991e1e;border-radius:12px;padding:12px;box-shadow:0 5px 10px rgba(0,0,0,0.2);display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;position:relative}.img-base{position:absolute;top:0;left:0;width:100%;height:3.5cm;object-fit:cover;z-index:1;opacity:0.15}.header{background:#991e1e;color:white;text-align:center;padding:8px;font-weight:bold;font-size:16px;border-radius:6px;z-index:10;position:relative}.concej-nombre{font-size:10px;text-transform:uppercase;color:#ffcccc;margin-top:2px}.datos{font-size:12px;line-height:1.5;margin-top:15px;z-index:10;position:relative}.dato-tit{color:#888;font-size:10px;margin-bottom:-5px;font-weight:bold;text-transform:uppercase}.dato-val{font-weight:900;font-size:15px;color:#111;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:2px}.footer{text-align:center;font-size:11px;color:white;background:#1e293b;padding:6px;border-radius:6px;font-weight:bold;z-index:10;position:relative}</style></head><body><div class="carnet">${fotoBaseConcejal?`<img src="${fotoBaseConcejal}" class="img-base"/>`:''}<div class="header">CARNET OFICIAL<div class="concej-nombre">Candidato: ${v.concejal || 'SIN ASIGNAR'}</div></div><div class="datos"><div class="dato-tit">CÉDULA</div><div class="dato-val">${v.cedula}</div><div class="dato-tit">ELECTOR</div><div class="dato-val">${v.nombre} ${v.apellido}</div><div class="dato-tit">LOCAL</div><div class="dato-val" style="font-size:13px;line-height:1.2">${v.local}</div><div style="display:flex;justify-content:space-between;margin-top:15px;border-top:2px solid #eee;padding-top:10px"><div><div class="dato-tit">MESA</div><div class="dato-val" style="font-size:28px;color:#991e1e;border:none;padding:0">${v.mesa}</div></div><div style="text-align:right"><div class="dato-tit">ORDEN</div><div class="dato-val" style="font-size:28px;color:#991e1e;border:none;padding:0">${v.orden}</div></div></div></div><div class="footer">Válido para Día D</div></div><script>window.print();setTimeout(()=>window.close(),500);</script></body></html>`);
    vent.document.close();
};
