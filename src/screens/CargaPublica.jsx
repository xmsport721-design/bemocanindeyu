import React, { useState, useEffect } from "react";
import { UserPlus, Send, Loader, Search } from "lucide-react";
import { cargaInfo, cargaAgregar, cargaEnviar } from "../lib/cargaCoordinador";
import { buscarPadronPorCedula } from "../lib/padronSupabase";
import { enModoDiaD } from "../constants";

// Página PÚBLICA (sin login) a la que entra el coordinador con su link único (?carga=TOKEN)
export default function CargaPublica({ token }) {
  const [info, setInfo] = useState(undefined); // undefined=cargando, null=no existe
  const [texto, setTexto] = useState("");
  const [concejalSel, setConcejalSel] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Búsqueda por cédula (rápida): busca en el padrón y agrega de a uno
  const [buscarCi, setBuscarCi] = useState("");
  const [resultado, setResultado] = useState(null); // null | "NO" | {padron}
  const [buscando, setBuscando] = useState(false);
  const [telProv, setTelProv] = useState("");

  const recargar = () => cargaInfo(token).then(setInfo).catch(() => setInfo(null));
  useEffect(() => { recargar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsear = () => texto.split(/\r?\n/).map(l => {
    const nums = l.match(/\d+/g) || [];
    if (!nums.length) return null;
    const cedula = nums[0];
    const telefono = nums[1] && nums[1].length >= 6 ? nums[1] : "";
    const nombre = l.replace(/[\d,;]+/g, " ").replace(/\s+/g, " ").trim();
    return { cedula, nombre, telefono, concejal: concejalSel || info?.concejal_fijo || "" };
  }).filter(Boolean);

  const agregar = async () => {
    const filas = parsear();
    if (!filas.length) return alert("Pegá al menos una cédula (una por línea).");
    setGuardando(true);
    try { const n = await cargaAgregar(token, filas); setTexto(""); await recargar(); alert(`✅ Agregados ${n}.`); }
    catch (e) { alert("⚠️ " + (e.message || "No se pudo agregar")); }
    setGuardando(false);
  };

  const buscarCoord = async () => {
    const ci = String(buscarCi).trim();
    if (!ci) return;
    setBuscando(true); setResultado(null);
    const p = await buscarPadronPorCedula(ci);
    setResultado(p || "NO");
    setBuscando(false);
  };

  const agregarUno = async () => {
    if (!resultado || resultado === "NO") return;
    setGuardando(true);
    try {
      await cargaAgregar(token, [{ cedula: String(resultado.cedula), nombre: `${resultado.nombre} ${resultado.apellido}`.trim(), telefono: telProv, concejal: concejalSel || info?.concejal_fijo || "" }]);
      setResultado(null); setBuscarCi(""); setTelProv(""); await recargar();
    } catch (e) { alert("⚠️ " + (e.message || "No se pudo agregar")); }
    setGuardando(false);
  };

  const enviar = async () => {
    setGuardando(true);
    try { await cargaEnviar(token); await recargar(); alert("✅ Enviado al equipo. Podés seguir cargando más gente y volver a tocar ENVIAR cuando agregues. No cierres el link."); }
    catch (e) { alert("⚠️ " + (e.message || "No se pudo enviar")); }
    setGuardando(false);
  };

  if (info === undefined) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><Loader className="animate-spin"/></div>;
  if (info === null) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 text-center"><div><h1 className="text-2xl font-black mb-2">Link inválido</h1><p className="text-slate-400 font-bold">Pedile al concejal un link nuevo.</p></div></div>;

  if (enModoDiaD()) return (
    <div className="min-h-screen bg-slate-50">
      <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }} className="bg-gradient-to-r from-red-700 to-red-900 text-white p-4 shadow-lg"><div className="max-w-lg mx-auto flex items-center gap-3"><span className="bg-white text-red-800 px-2 rounded font-black">BEMO</span><h1 className="text-sm font-black uppercase">{info.coordinador_nombre}</h1></div></header>
      <main className="max-w-lg mx-auto p-4 mt-10"><div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-slate-800 text-center"><h2 className="text-xl font-black mb-2">🗳️ Carga cerrada</h2><p className="text-sm font-bold text-slate-500">El período de carga terminó (llegó el Día D). Cargaste {info.filas} personas. ¡Gracias por tu trabajo!</p></div></main>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }} className="bg-gradient-to-r from-red-700 to-red-900 text-white p-4 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <span className="bg-white text-red-800 px-2 rounded font-black">BEMO</span>
          <div><h1 className="text-sm font-black uppercase leading-tight">Carga de {info.coordinador_nombre}</h1><p className="text-[10px] text-red-200 font-bold uppercase">{info.distrito}{info.zona ? ` · ${info.zona}` : ""} · {info.filas} cargados</p></div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 mt-4">
          <div className="space-y-4">
          {info.estado !== "cargando" && <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center"><p className="text-sm font-black text-green-700">✅ Ya enviaste {info.filas}. Podés seguir cargando más y volver a enviar.</p></div>}
          <div className="bg-white p-6 rounded-3xl shadow-xl border">
            <h2 className="font-black text-lg mb-1 flex items-center gap-2"><Search className="text-red-600"/>Buscar por cédula</h2>
            <p className="text-xs text-slate-500 font-bold mb-3">Buscá la cédula, confirmá el nombre y agregalo. (Más rápido y seguro.)</p>
            <div className="flex gap-2">
              <input type="number" placeholder="N° de cédula" className="flex-1 p-3 border-2 rounded-xl font-bold text-center outline-none focus:border-red-500" value={buscarCi} onChange={e=>setBuscarCi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&buscarCoord()} />
              <button onClick={buscarCoord} disabled={buscando} className="bg-slate-800 text-white px-5 rounded-xl font-black disabled:opacity-50">{buscando ? '...' : <Search size={18}/>}</button>
            </div>
            {resultado === "NO" && <div className="mt-3 p-3 bg-red-50 text-red-600 font-bold text-center rounded-xl text-sm">Cédula no encontrada en el padrón.</div>}
            {resultado && resultado !== "NO" && (
              <div className="mt-3 border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-3">
                <div className="font-black uppercase">{resultado.nombre} {resultado.apellido}</div>
                <div className="text-[11px] font-bold text-slate-500 mb-2">CI {resultado.cedula} · Mesa {resultado.mesa} · {resultado.local}</div>
                <input type="text" placeholder="Teléfono (opcional)" className="w-full p-2 border-2 rounded-lg font-bold text-sm mb-2 outline-none" value={telProv} onChange={e=>setTelProv(e.target.value)} />
                <button onClick={agregarUno} disabled={guardando} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black disabled:opacity-50">+ AGREGAR ESTA PERSONA</button>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-xl border">
            <h2 className="font-black text-lg mb-1 flex items-center gap-2"><UserPlus className="text-emerald-600"/>O pegá varias de una</h2>
            <p className="text-xs text-slate-500 font-bold mb-4">Pegá una cédula por línea. Opcional: "cédula, nombre, teléfono".</p>
            {Array.isArray(info.concejales_disponibles) && info.concejales_disponibles.length > 0 && !info.concejal_fijo && (
              <select className="w-full p-3 border-2 rounded-xl font-bold mb-3 outline-none" value={concejalSel} onChange={e=>setConcejalSel(e.target.value)}>
                <option value="">CONCEJAL (opcional)</option>
                {info.concejales_disponibles.map(c => <option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}
              </select>
            )}
            <textarea rows={8} placeholder={"1234567\n7654321, JUAN PEREZ, 0981123456"} className="w-full p-3 border-2 rounded-xl font-mono text-sm outline-none focus:border-emerald-500 mb-3" value={texto} onChange={e=>setTexto(e.target.value)} />
            <button onClick={agregar} disabled={guardando} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50 mb-2">{guardando ? "GUARDANDO..." : "AGREGAR A LA LISTA"}</button>
            <button onClick={enviar} disabled={guardando || info.filas === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><Send size={16}/> ENVIAR AL EQUIPO {info.filas > 0 ? `(${info.filas})` : ""}</button>
            <p className="text-[10px] font-bold text-slate-400 text-center mt-2">Podés enviar y <b>seguir cargando</b>. El link no se cierra.</p>
          </div>
          </div>
      </main>
    </div>
  );
}
