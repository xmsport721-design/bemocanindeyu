import React, { useState, useMemo } from "react";
import { ref, set, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { LogOut, CheckCircle, Users, Search, ChevronDown, BarChart3, Bell, UserPlus, UserSquare2, Printer } from "lucide-react";
import { concejalCoincide, normalizarNombre, imprimirCarnetFisico } from "../lib/helpers";
import { FOTOS_LOCALES_CONCEJALES } from "../constants";
import { generarLlave } from "../lib/llaves";
import { buscarPadronPorCedula, buscarPadronPorNombre } from "../lib/padronSupabase";

export default function AppConcejal({ perfil, votosSeguros, yaVotaronGlobal, pasoPCGlobal, escrutinioGlobal, fotosConcejales, configApp, auth, db, usuarioActivo }) {
    const [tab, setTab] = useState("registro");
    const [menuAbierto, setMenuAbierto] = useState(false);

    const [bNom, setBNom] = useState("");
    const [resNom, setResNom] = useState([]);
    const miNom = perfil.nombre_oficial||"";

    const [form, setForm] = useState({ cedula:"", nombre:"", apellido:"", telefono:"", distrito:perfil.distrito, local:"", mesa:"", orden:"", concejal: miNom, coordinador:"", semaforo:"VERDE" });

    const [bDiaD, setBDiaD] = useState("");
    const [resDiaD, setResDiaD] = useState(null);

    // FILTRADO INTELIGENTE: El concejal verá sus votos sin importar si le cambiaron el nombre o número de lista.
    const misV = useMemo(() => {
        return votosSeguros.filter(v => v.distrito === perfil.distrito && (concejalCoincide(v.concejal, miNom) || v.registradoPor === usuarioActivo.email));
    }, [votosSeguros, perfil.distrito, miNom, usuarioActivo.email]);

    // DETECCIÓN DE DUPLICADOS PARA EL CONCEJAL
    const cedulasDuplicadas = useMemo(() => {
        const counts = {};
        votosSeguros.filter(v => v.distrito === perfil.distrito).forEach(v => { counts[v.cedula] = (counts[v.cedula] || 0) + 1; });
        const dups = new Set();
        Object.keys(counts).forEach(ci => { if(counts[ci] > 1) dups.add(ci); });
        return dups;
    }, [votosSeguros, perfil.distrito]);

    const [lim, setLim] = useState(50);
    const mCoor = [...new Set(misV.map(v=>v.coordinador).filter(c=>c))];
    const [fC, setFC] = useState("TODOS");
    const [fS, setFS] = useState("TODOS");
    const [mNC, setMNC] = useState(false);

    const marcarPasoPCConcejal = (llave, pcData) => {
        if (pcData) { remove(ref(db, `dia_d/paso_pc_checkins/${llave}`)); setResDiaD({...resDiaD, pc: null}); }
        else { const nombreConcejalCorto = miNom.includes('-') ? miNom.split('-')[1].trim() : miNom; const newData = { hora: new Date().toLocaleTimeString(), timestamp: Date.now(), registradoPorNombre: `CONCEJAL ${nombreConcejalCorto}` }; set(ref(db, `dia_d/paso_pc_checkins/${llave}`), newData); setResDiaD({...resDiaD, pc: newData}); }
    };

    const buscarPorNombreConcejal = async () => {
        if(bNom.trim().length < 3) return alert("Escribe al menos 3 letras.");
        const res = (await buscarPadronPorNombre(bNom, perfil.distrito)).map(r => ({ ...r, ci: r.cedula }));
        if (res.length === 0) alert("No se encontraron coincidencias.");
        setResNom(res);
    };

    const buscarCedulaConcejal = async () => {
        const p = await buscarPadronPorCedula(form.cedula);
        if (p && p.distrito === perfil.distrito) { setForm(prev => ({...prev, nombre: p.nombre, apellido: p.apellido, local: p.local, mesa: p.mesa, orden: p.orden, distrito: p.distrito})); }
        else if (p && p.distrito !== perfil.distrito) { alert("Esta persona pertenece a otro distrito."); }
        else { alert("Cédula no encontrada."); }
    };

    const buscarDiaD = async () => {
        const p = await buscarPadronPorCedula(bDiaD);
        if (p) setResDiaD({ ...p, v: yaVotaronGlobal[generarLlave(p.distrito, p.mesa, p.orden)], pc: pasoPCGlobal[generarLlave(p.distrito, p.mesa, p.orden)] });
        else setResDiaD("NO");
    };

    const handleRegistrarConcejal = () => {
        import('firebase/database').then(({ push, ref }) => {
            if(!form.cedula||!form.nombre)return alert("Datos incompletos");
            if(misV.find(v=>v.cedula===form.cedula))return alert("Ya registrado por ti.");
            const d={...form, concejal: miNom, registradoPor:usuarioActivo.email, fecha:new Date().toLocaleString()};
            push(ref(db,'votos_seguros'), d);
            alert("Guardado correctamente");
            setForm(f=>({...f, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:""}));
            setMNC(false);
        });
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <header className="bg-gradient-to-r from-red-700 to-red-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <span className="bg-white text-red-800 px-2 rounded font-black">BEMO</span>
                    <div>
                        <h1 className="text-sm font-bold uppercase">{configApp.intendente||"S/D"}</h1>
                        <p className="text-[10px] text-red-200 font-bold uppercase">CANDIDATO: {miNom.includes('-')?miNom.split('-')[1]:miNom} ({perfil.distrito})</p>
                    </div>
                </div>
                <button onClick={()=>signOut(auth)} className="bg-red-950 p-2 rounded-full"><LogOut size={16}/></button>
            </header>

            <div className="bg-white px-4 py-2 flex justify-center gap-4 text-xs font-black border-b shadow-sm relative z-40">
                <span className="text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-300">TOT: {misV.length}</span>
                <span className="text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">🟢 {misV.filter(v=>v.semaforo==='VERDE' && !cedulasDuplicadas.has(v.cedula)).length}</span>
            </div>

            <div className="bg-white flex border-b shadow-sm sticky top-[68px] z-50 print:hidden px-2 items-center justify-center w-full">
                <div className="flex items-center max-w-full pt-2 pb-2">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-2">
                        <button onClick={() => {setTab("registro"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'registro' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><CheckCircle size={16}/> REGISTRO</button>
                        <button onClick={() => {setTab("lista"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'lista' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><Users size={16}/> LISTA</button>
                        <button onClick={() => {setTab("dia_d_buscador"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'dia_d_buscador' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><Search size={16}/> DÍA D BUSCADOR</button>
                    </div>

                    <div className="relative shrink-0 border-l border-slate-200 pl-2">
                        <button onClick={() => setMenuAbierto(!menuAbierto)} className={`p-2 px-3 font-black text-[11px] flex gap-1 items-center rounded-lg transition-colors ${menuAbierto ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}>
                            MÁS OPCIONES <ChevronDown size={14} className={`transition-transform duration-200 ${menuAbierto ? 'rotate-180' : ''}`}/>
                        </button>
                        {menuAbierto && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-xl z-[100] overflow-hidden flex flex-col border border-slate-200 animate-fade-in py-1">
                                <button onClick={() => {setTab("proyecciones"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${tab === 'proyecciones' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}><BarChart3 size={16} className={tab === 'proyecciones' ? "text-red-500" : "text-slate-400"}/> PROYECCIONES</button>
                                <button onClick={() => {setTab("live"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${tab === 'live' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}><Bell size={16} className={tab === 'live' ? "text-red-500" : "text-slate-400"}/> LIVE</button>
                                <button onClick={() => {setTab("dirigentes"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 border-t border-slate-100 ${tab === 'dirigentes' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}><UserPlus size={16} className={tab === 'dirigentes' ? "text-red-500" : "text-slate-400"}/> MIS DIRIGENTES</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {tab === "registro" && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-4xl mx-auto animate-fade-in">
                        <h2 className="font-black text-xl mb-6 text-slate-800 flex items-center gap-2"><UserSquare2/> REGISTRO DE VOTOS ({perfil.distrito})</h2>

                        <div className="bg-slate-50 border p-4 rounded-xl mb-6">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">1. BUSCAR POR NOMBRE / APELLIDO (Opcional si no tienes C.I)</label>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Escribe Nombre o Apellido..." className="flex-1 p-3 border-2 rounded-xl font-bold uppercase outline-none focus:border-red-500" value={bNom} onChange={e => setBNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarPorNombreConcejal()} />
                                <button onClick={buscarPorNombreConcejal} className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 rounded-xl font-bold transition-colors"><Search size={18}/></button>
                            </div>
                            {resNom.length > 0 && (
                                <div className="mt-2 bg-white border border-slate-200 shadow-lg rounded-xl max-h-48 overflow-y-auto">
                                    {resNom.map(r => (
                                        <div key={r.ci} onClick={() => {setForm({...form, cedula: r.ci, nombre: r.nombre, apellido: r.apellido, local: r.local, mesa: r.mesa, orden: r.orden, distrito: r.distrito}); setResNom([]); setBNom("");}} className="p-3 hover:bg-red-50 cursor-pointer border-b last:border-b-0 text-sm flex justify-between items-center transition-colors">
                                            <div><span className="font-black">{r.nombre} {r.apellido}</span><br/><span className="text-xs text-gray-500 font-bold">C.I: {r.ci}</span></div>
                                            <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Mesa {r.mesa}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">2. CARGA CON CÉDULA DE IDENTIDAD</label>
                        <div className="flex gap-2 mb-6"><input type="number" placeholder="N° DE CÉDULA" className="flex-1 p-4 border-2 rounded-xl text-xl font-bold outline-none focus:border-red-500" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} /><button onClick={buscarCedulaConcejal} className="bg-slate-800 text-white px-6 rounded-xl font-bold"><Search /></button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" readOnly placeholder="NOMBRES" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.nombre} /><input type="text" readOnly placeholder="APELLIDOS" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.apellido} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" placeholder="TELÉFONO" className="p-3 border-2 border-blue-200 rounded-lg font-bold outline-none" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /><input type="text" readOnly placeholder="DISTRITO" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.distrito} /></div>
                        <div className="grid grid-cols-3 gap-2 mb-4"><input type="text" readOnly className="p-3 border bg-gray-50 text-xs col-span-3 md:col-span-1" value={form.local} placeholder="LOCAL" /><input type="text" readOnly className="p-3 border bg-gray-50 font-bold" value={form.mesa ? `MESA ${form.mesa}` : "MESA"} /><input type="text" readOnly className="p-3 border-2 border-red-100 font-black text-red-600 bg-red-50" value={form.orden ? `ORDEN ${form.orden}` : "ORDEN"} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">CONCEJAL</label><input type="text" readOnly className="p-4 border-2 rounded-xl font-bold bg-gray-50 text-gray-500" value={miNom.includes(' - ') ? miNom.split(' - ')[1] : miNom} /></div>
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COORDINADOR</label>
                                <div className="flex gap-2">
                                    {!mNC ? (
                                        <><select className="flex-1 p-4 border-2 rounded-xl font-bold outline-none" value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value})}><option value="">SELECCIONE...</option>{mCoor.map(c => <option key={c} value={c}>{c}</option>)}</select><button onClick={()=>{setMNC(true); setForm({...form, coordinador:""})}} className="bg-slate-200 px-4 rounded-xl font-black text-xl">+</button></>
                                    ) : (
                                        <><input type="text" className="flex-1 p-4 border-2 rounded-xl font-bold uppercase outline-none" placeholder="NUEVO..." value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value.toUpperCase()})}/><button onClick={()=>{setMNC(false); setForm({...form, coordinador:""})}} className="bg-red-100 text-red-700 px-4 rounded-xl font-black text-xl">×</button></>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COLOR</label><select className={`w-full p-4 rounded-xl font-black text-white outline-none ${form.semaforo==='VERDE'?'bg-green-500':form.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={form.semaforo} onChange={e=>setForm({...form, semaforo: e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select></div>
                        </div>
                        <button onClick={handleRegistrarConcejal} className="w-full mt-6 bg-[#2ecc71] hover:bg-green-600 text-white py-4 rounded-xl font-black shadow-lg transition-colors">GUARDAR REGISTRO</button>
                    </div>
                )}

                {tab === "lista" && (
                    <div className="bg-white p-4 rounded-2xl shadow border overflow-x-auto animate-fade-in">
                        <div className="flex gap-4 mb-4"><select className="p-2 border rounded font-bold text-xs flex-1" value={fC} onChange={e=>{setFC(e.target.value);setLim(50);}}><option value="TODOS">COORD: TODOS</option>{mCoor.map(c=><option key={c}>{c}</option>)}</select><select className="p-2 border rounded font-bold text-xs flex-1" value={fS} onChange={e=>{setFS(e.target.value);setLim(50);}}><option value="TODOS">COLOR: TODOS</option><option value="VERDE">VERDE</option><option value="AMARILLO">AMARILLO</option><option value="ROJO">ROJO</option></select></div>
                        <table className="w-full text-left min-w-[600px]"><thead className="bg-red-50 text-red-900 text-[10px] uppercase"><tr><th className="p-3">Elector</th><th className="p-3">Día D</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y text-sm">
                            {misV.filter(v=>(fC==="TODOS"||v.coordinador===fC)&&(fS==="TODOS"||v.semaforo===fS)).slice(0,lim).map(v=>{
                                const vot = yaVotaronGlobal[generarLlave(v.distrito,v.mesa,v.orden)];
                                const esDuplicado = cedulasDuplicadas.has(v.cedula);
                                const semaforoReal = esDuplicado ? 'ROJO' : v.semaforo;
                                return (
                                    <tr key={v.id} className={esDuplicado ? 'bg-red-50' : ''}>
                                        <td className="p-3 font-bold">
                                            {v.nombre} {v.apellido}
                                            {esDuplicado && <span className="ml-2 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded uppercase font-black tracking-widest">⚠️ DUPLICADO EN EL SISTEMA</span>}
                                            <br/>
                                            <span className="text-xs text-gray-500">M:{v.mesa} | C.I:{v.cedula} | <span className={`text-${semaforoReal === 'VERDE' ? 'green' : semaforoReal === 'AMARILLO' ? 'yellow' : 'red'}-500 text-lg leading-none`}>●</span></span>
                                        </td>
                                        <td className="p-3">{vot?<span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {vot.hora}</span>:'-'}</td>
                                        <td className="p-3 text-center"><button onClick={()=>imprimirCarnetFisico(v, FOTOS_LOCALES_CONCEJALES[normalizarNombre(v.concejal)])} className="bg-slate-800 text-white p-2 rounded-full"><Printer size={14}/></button></td>
                                    </tr>
                                )})}
                        </tbody></table>{misV.length>lim && <button onClick={()=>setLim(l=>l+50)} className="w-full p-4 bg-slate-100 font-bold text-slate-600 mt-4 rounded-xl">Cargar más...</button>}
                    </div>
                )}

                {/* ... Otras pestañas de Concejal igual ... */}
                {tab === "dia_d_buscador" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Search className="text-red-600"/> BUSCADOR RÁPIDO DÍA D</h2>
                            <p className="text-xs text-slate-500 font-bold mb-4">Ingresa el número de cédula de cualquier elector para consultar su estado o marcar su paso por PC.</p>
                            <div className="flex gap-2 mb-6">
                                <input type="number" placeholder="N° Cédula..." className="flex-1 p-4 border-2 rounded-xl font-bold outline-none focus:border-red-500" value={bDiaD} onChange={e=>setBDiaD(e.target.value)} onKeyDown={e=>e.key==='Enter'&&buscarDiaD()} />
                                <button onClick={buscarDiaD} className="bg-red-700 hover:bg-red-800 text-white px-6 rounded-xl font-bold transition-colors"><Search/></button>
                            </div>

                            {resDiaD === "NO" && <div className="p-4 bg-red-50 text-red-600 font-bold text-center rounded-xl border border-red-200">❌ Cédula no encontrada en el padrón.</div>}

                            {resDiaD && resDiaD !== "NO" && (
                                <div className="border-2 border-slate-200 rounded-xl p-6 bg-slate-50">
                                    <div className="text-2xl font-black text-slate-800">{resDiaD.nombre} {resDiaD.apellido}</div>
                                    <div className="text-sm font-bold text-gray-500 mb-3">C.I: {bDiaD} | {resDiaD.distrito}</div>
                                    <div className="bg-red-50 border-2 border-red-100 rounded-xl p-3 mb-4"><div className="text-[10px] font-black text-red-700 uppercase">📍 Local de Votación</div><div className="text-sm font-black text-slate-800 leading-tight">{resDiaD.local || '—'}</div></div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-white border shadow-sm p-3 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-gray-400">MESA</div>
                                            <div className="text-2xl font-black text-slate-700">{resDiaD.mesa}</div>
                                        </div>
                                        <div className="bg-white border shadow-sm p-3 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-gray-400">ORDEN</div>
                                            <div className="text-2xl font-black text-slate-700">{resDiaD.orden}</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t pt-4">
                                        <button onClick={() => marcarPasoPCConcejal(generarLlave(resDiaD.distrito, resDiaD.mesa, resDiaD.orden), resDiaD.pc)} className={`w-full py-4 rounded-xl font-black text-sm transition-all duration-300 border-2 flex items-center justify-center gap-2 shadow-sm ${resDiaD.pc ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
                                            {resDiaD.pc ? <>📍 YA PASÓ POR PC ({resDiaD.pc.hora})</> : <>⏳ MARCAR "PASÓ POR PC"</>}
                                        </button>
                                    </div>

                                    {resDiaD.v ?
                                        <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-xl text-center font-black text-xl mt-4">✅ YA VOTÓ ({resDiaD.v.hora})</div>
                                    :
                                        <div className="bg-white border-2 text-gray-400 p-4 rounded-xl text-center font-black text-xl mt-4">⏳ AÚN NO VOTÓ</div>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
