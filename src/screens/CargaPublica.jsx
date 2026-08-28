import React, { useState, useEffect } from "react";
import { UserPlus, Send, CheckCircle, Loader } from "lucide-react";
import { cargaInfo, cargaAgregar, cargaEnviar } from "../lib/cargaCoordinador";

// Página PÚBLICA (sin login) a la que entra el coordinador con su link único (?carga=TOKEN)
export default function CargaPublica({ token }) {
  const [info, setInfo] = useState(undefined); // undefined=cargando, null=no existe
  const [texto, setTexto] = useState("");
  const [concejalSel, setConcejalSel] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviado, setEnviado] = useState(false);

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

  const enviar = async () => {
    if (!window.confirm("¿Enviar la lista al equipo? Después no vas a poder agregar más.")) return;
    setGuardando(true);
    try { await cargaEnviar(token); setEnviado(true); await recargar(); }
    catch (e) { alert("⚠️ " + (e.message || "No se pudo enviar")); }
    setGuardando(false);
  };

  if (info === undefined) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><Loader className="animate-spin"/></div>;
  if (info === null) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 text-center"><div><h1 className="text-2xl font-black mb-2">Link inválido</h1><p className="text-slate-400 font-bold">Pedile al concejal un link nuevo.</p></div></div>;

  const cerrada = info.estado !== "cargando" || enviado;

  return (
    <div className="min-h-screen bg-slate-50">
      <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }} className="bg-gradient-to-r from-red-700 to-red-900 text-white p-4 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <span className="bg-white text-red-800 px-2 rounded font-black">BEMO</span>
          <div><h1 className="text-sm font-black uppercase leading-tight">Carga de {info.coordinador_nombre}</h1><p className="text-[10px] text-red-200 font-bold uppercase">{info.distrito}{info.zona ? ` · ${info.zona}` : ""} · {info.filas} cargados</p></div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 mt-4">
        {cerrada ? (
          <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-500 text-center">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3"/>
            <h2 className="text-xl font-black mb-2">¡Lista enviada!</h2>
            <p className="text-sm font-bold text-slate-500">Enviaste {info.filas} personas. El equipo las va a revisar y cargar. Ya podés cerrar esta página.</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-xl border">
            <h2 className="font-black text-lg mb-1 flex items-center gap-2"><UserPlus className="text-emerald-600"/>Cargá tu gente</h2>
            <p className="text-xs text-slate-500 font-bold mb-4">Pegá una cédula por línea. Opcional: "cédula, nombre, teléfono".</p>
            {Array.isArray(info.concejales_disponibles) && info.concejales_disponibles.length > 0 && !info.concejal_fijo && (
              <select className="w-full p-3 border-2 rounded-xl font-bold mb-3 outline-none" value={concejalSel} onChange={e=>setConcejalSel(e.target.value)}>
                <option value="">CONCEJAL (opcional)</option>
                {info.concejales_disponibles.map(c => <option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}
              </select>
            )}
            <textarea rows={8} placeholder={"1234567\n7654321, JUAN PEREZ, 0981123456"} className="w-full p-3 border-2 rounded-xl font-mono text-sm outline-none focus:border-emerald-500 mb-3" value={texto} onChange={e=>setTexto(e.target.value)} />
            <button onClick={agregar} disabled={guardando} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50 mb-2">{guardando ? "GUARDANDO..." : "AGREGAR A LA LISTA"}</button>
            <button onClick={enviar} disabled={guardando || info.filas === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"><Send size={16}/> ENVIAR {info.filas > 0 ? `(${info.filas})` : ""}</button>
          </div>
        )}
      </main>
    </div>
  );
}
