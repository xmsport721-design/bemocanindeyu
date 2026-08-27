import React, { useState, useEffect } from "react";
import { ref, set, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { LogOut, Search, IdCard } from "lucide-react";
import { generarLlave } from "../lib/llaves";
import { buscarPadronPorCedula } from "../lib/padronSupabase";

export default function AppDirigente({ yaVotaronGlobal, pasoPCGlobal, asignacionesDirigentes, configApp, auth, db }) {
    // El dirigente se identifica con SU cédula (cuenta compartida). Sesión persistida local.
    const [ds, setDs] = useState(null);
    const [ciIn, setCiIn] = useState("");
    const [b, setB] = useState("");
    const [res, setRes] = useState(null);
    const [cargando, setCargando] = useState(false);

    useEffect(() => { try { const g = localStorage.getItem('dirigente_bemo_sesion'); if (g) setDs(JSON.parse(g)); } catch {} }, []);

    // Reenvía check-ins de paso PC que quedaron pendientes (app cerrada antes de confirmar)
    useEffect(() => {
        try {
            Object.keys(localStorage).filter(k => k.startsWith('pcpend_')).forEach(k => {
                const llave = k.slice(7);
                set(ref(db, `dia_d/paso_pc_checkins/${llave}`), JSON.parse(localStorage.getItem(k)))
                    .then(() => { try { localStorage.removeItem(k); } catch {} }).catch(() => {});
            });
        } catch {}
    }, [db]);

    const entrarPorCedula = () => {
        const ci = String(ciIn || "").trim();
        if (!ci) return;
        const asignado = (asignacionesDirigentes || {})[ci];
        if (!asignado) return alert("Tu cédula no está cargada por ningún concejal. Pedile que te agregue como dirigente.");
        setDs(asignado);
        try { localStorage.setItem('dirigente_bemo_sesion', JSON.stringify(asignado)); } catch {}
    };

    const salir = () => { try { localStorage.removeItem('dirigente_bemo_sesion'); } catch {} setDs(null); setRes(null); setB(""); signOut(auth); };

    // Consulta el padrón en Supabase (point query) en vez de tener todo en memoria
    const buscar = async () => {
        if (!b) return;
        setCargando(true);
        const p = await buscarPadronPorCedula(b);
        if (p) setRes({ ...p, v: yaVotaronGlobal[generarLlave(p.distrito, p.cod_local, p.mesa, p.orden)], pc: pasoPCGlobal[generarLlave(p.distrito, p.cod_local, p.mesa, p.orden)] });
        else setRes("NO");
        setCargando(false);
    };

    // Robusto: marca instantánea (no se traba/desmarca) + respaldo local + envío en 2do plano.
    // Firebase encola y reintenta solo → aguanta marcación masiva sin perder check-ins.
    const marcarPasoPC = (llave, pcData) => {
        if (pcData) {
            setRes(r => ({ ...r, pc: null }));
            try { localStorage.removeItem(`pcpend_${llave}`); } catch {}
            remove(ref(db, `dia_d/paso_pc_checkins/${llave}`)).catch(() => {});
        } else {
            const newData = { hora: new Date().toLocaleTimeString(), timestamp: Date.now(), registradoPorNombre: `DIRIGENTE ${ds?.nombre || ""}`.trim(), registradoPorCedula: ds?.cedula || "", concejal: ds?.concejal || "" };
            setRes(r => ({ ...r, pc: newData }));                                   // 1) instantáneo
            try { localStorage.setItem(`pcpend_${llave}`, JSON.stringify(newData)); } catch {} // respaldo
            set(ref(db, `dia_d/paso_pc_checkins/${llave}`), newData)               // 2) 2do plano
                .then(() => { try { localStorage.removeItem(`pcpend_${llave}`); } catch {} })
                .catch(() => {}); // queda el respaldo; se reenvía al reabrir
        }
    };

    // Puerta de identificación por cédula
    if (!ds) {
        return (
            <div className="bg-slate-50 min-h-screen">
                <header className="bg-green-800 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-green-500"><div className="flex items-center gap-3"><span className="bg-green-600 px-2 rounded font-black">BEMO</span><h1 className="text-sm font-bold uppercase">DIRIGENTE</h1></div><button onClick={()=>signOut(auth)} className="text-[10px] bg-green-900 px-3 py-1.5 rounded-full font-black">SALIR</button></header>
                <main className="max-w-md mx-auto p-6 mt-16">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-600 text-center">
                        <IdCard size={40} className="mx-auto text-green-600 mb-3"/>
                        <h2 className="text-xl font-black mb-2">IDENTIFICATE</h2>
                        <p className="text-xs font-bold text-slate-500 mb-5">Ingresá tu número de cédula para entrar como dirigente.</p>
                        <input type="number" className="w-full p-4 border-2 rounded-xl text-center text-xl font-black mb-4 outline-none focus:border-green-500" value={ciIn} onChange={e=>setCiIn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&entrarPorCedula()} placeholder="N° Cédula" />
                        <button onClick={entrarPorCedula} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black transition-colors">ENTRAR</button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <header className="bg-green-800 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-green-500"><div className="flex items-center gap-3"><span className="bg-green-600 px-2 rounded font-black">BEMO</span><div><h1 className="text-sm font-bold uppercase truncate max-w-[180px]">{ds.nombre}</h1><p className="text-[10px] text-green-200 font-bold uppercase truncate max-w-[180px]">Dirigente de {ds.concejal ? (ds.concejal.includes('-') ? ds.concejal.split('-')[1].trim() : ds.concejal) : ''}</p></div></div><button onClick={salir} className="bg-green-900 p-2 rounded-full"><LogOut size={16}/></button></header>
            <main className="max-w-2xl mx-auto p-4 mt-10"><div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-green-500"><h2 className="font-black text-xl mb-4 text-slate-800"><Search className="inline text-green-600 mr-2"/>CONSULTA DÍA D</h2><div className="flex gap-2 mb-6"><input type="number" placeholder="N° Cédula..." className="flex-1 p-4 border-2 rounded-xl font-bold outline-none" value={b} onChange={e=>setB(e.target.value)} onKeyDown={e=>e.key==='Enter'&&buscar()} /><button onClick={buscar} disabled={cargando} className="bg-green-600 text-white px-6 rounded-xl font-bold disabled:opacity-50">{cargando ? '...' : <Search/>}</button></div>{res==="NO" && <div className="p-4 bg-red-50 text-red-600 font-bold text-center rounded-xl">No encontrada.</div>}{res && res!=="NO" && (<div className="border-2 border-slate-200 rounded-xl p-6"><div className="text-2xl font-black">{res.nombre} {res.apellido}</div><div className="text-sm font-bold text-gray-500 mb-4">C.I: {b} | {res.distrito}</div><div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 mb-4"><div className="text-[10px] font-black text-green-700 uppercase">📍 Local de Votación</div><div className="text-base font-black text-slate-800 leading-tight">{res.local || '—'}</div></div><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-50 border p-3 rounded-lg text-center"><div className="text-[10px] font-bold text-gray-500">MESA</div><div className="text-2xl font-black">{res.mesa}</div></div><div className="bg-slate-50 border p-3 rounded-lg text-center"><div className="text-[10px] font-bold text-gray-500">ORDEN</div><div className="text-2xl font-black">{res.orden}</div></div></div><div className="mt-4 border-t pt-4"><button onClick={() => marcarPasoPC(generarLlave(res.distrito, res.cod_local, res.mesa, res.orden), res.pc)} className={`w-full py-4 rounded-xl font-black text-sm transition-all duration-300 border-2 flex items-center justify-center gap-2 shadow-sm ${res.pc ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}>{res.pc ? <>📍 YA PASÓ POR PC ({res.pc.hora})</> : <>⏳ MARCAR "PASÓ POR PC"</>}</button></div>{res.v ? <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-black text-xl mt-4">✅ YA VOTÓ ({res.v.hora})</div> : <div className="bg-gray-100 text-gray-500 p-4 rounded-xl text-center font-black text-xl mt-4">⏳ AÚN NO VOTÓ</div>}</div>)}</div></main>
        </div>
    );
}
