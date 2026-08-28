import React, { useState, useEffect } from "react";
import { ref, set } from "firebase/database";
import { Settings, Save, Camera, RefreshCw, Edit2, Trash2 } from "lucide-react";
import { normalizarNombre } from "../lib/helpers";
import { DISTRITOS_CONCEPCION } from "../constants";

// Comprime la imagen (máx 240px, JPEG) a un data URL liviano para guardar en RTDB
const comprimirImagen = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        const max = 240;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("no se pudo leer la imagen")); };
    img.src = url;
});

export default function PanelConfiguracionDepartamental({ perfil, configuracionDepartamental, db, distritoGlobal, setDistritoGlobal }) {
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const dataBruta = configuracionDepartamental[distritoGlobal] || {};
    const configActual = { intendente: typeof dataBruta.intendente === 'string' ? dataBruta.intendente : "", lista: dataBruta.lista || "0", meta_intendente: dataBruta.meta_intendente || 5000, meta_concejales: dataBruta.meta_concejales || 500, concejales: Array.isArray(dataBruta.concejales) ? dataBruta.concejales : [] };

    const [tInt, setTInt] = useState(""); const [tLis, setTList] = useState(""); const [tMetInt, setTMetInt] = useState(""); const [tMet, setTMeta] = useState(""); const [nConc, setNConc] = useState("");
    const [idxEd, setIdxEd] = useState(null); const [valEd, setValEd] = useState(""); const [subiendo, setSubiendo] = useState(null);

    useEffect(() => { setTInt(configActual.intendente); setTList(configActual.lista); setTMetInt(configActual.meta_intendente); setTMeta(configActual.meta_concejales); setIdxEd(null); }, [distritoGlobal, configuracionDepartamental]); // eslint-disable-line react-hooks/exhaustive-deps

    const guardarDistrito = () => { set(ref(db, `configuracion/${distritoGlobal}`), { ...dataBruta, intendente: tInt.toUpperCase() || "NO CONFIGURADO", lista: tLis, meta_intendente: parseInt(tMetInt) || 5000, meta_concejales: parseInt(tMet) || 500, concejales: configActual.concejales }); alert(`✅ Guardado.`); };

    // Sube la foto: la comprime y la guarda como imagen (base64) en RTDB. No usa Firebase Storage.
    const subirFoto = async (e, n) => {
        const f = e.target.files[0];
        if(!f) return;
        setSubiendo(n);
        try {
            const dataUrl = await comprimirImagen(f);
            await set(ref(db, `concejales_fotos/${normalizarNombre(n)}`), dataUrl);
            alert("✅ Foto guardada.");
        } catch(err) {
            alert("Error al guardar la foto: " + err.message);
        }
        setSubiendo(null);
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-red-700 space-y-6">
            <h2 className="text-2xl font-black border-b pb-4"><Settings className="inline mr-2 text-red-600"/>AJUSTES: {distritoGlobal}</h2>
            {esMaster && <select className="w-full p-4 border-2 rounded-xl font-black text-lg" value={distritoGlobal} onChange={e=>setDistritoGlobal(e.target.value)}>{DISTRITOS_CONCEPCION.map(d=><option key={d}>{d}</option>)}</select>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-red-50 p-6 rounded-2xl">
                <div className="col-span-full md:col-span-2"><label className="text-xs font-bold text-red-700">INTENDENTE</label>
                    <div className="flex gap-2 items-center">
                        <input className="flex-1 p-3 border rounded font-black uppercase" value={tInt} onChange={e=>setTInt(e.target.value)}/>
                        <label className="cursor-pointer bg-emerald-100 text-emerald-700 p-3 rounded-lg hover:bg-emerald-200 transition-colors shrink-0" title="Subir foto del intendente">
                            {subiendo===tInt ? <RefreshCw size={16} className="animate-spin"/> : <Camera size={16}/>}
                            <input type="file" accept="image/*" className="hidden" onChange={e=> tInt ? subirFoto(e, tInt) : alert('Escribí primero el nombre del intendente.')}/>
                        </label>
                    </div>
                </div>
                <div className="col-span-1"><label className="text-xs font-bold text-red-700">LISTA</label><input className="w-full p-3 border rounded font-black" value={tLis} onChange={e=>setTList(e.target.value)}/></div>
                <div className="col-span-1"><label className="text-xs font-bold text-red-700">META INTENDENTE</label><input type="number" className="w-full p-3 border rounded font-black border-red-400" value={tMetInt} onChange={e=>setTMetInt(e.target.value)}/></div>
                <div className="col-span-full md:col-span-2"><label className="text-xs font-bold text-red-700">META INDIVIDUAL CONCEJAL</label><input type="number" className="w-full p-3 border rounded font-black" value={tMet} onChange={e=>setTMeta(e.target.value)}/></div>
                <button onClick={guardarDistrito} className="col-span-full md:col-span-2 bg-red-700 text-white py-3 rounded-xl font-black mt-4 md:mt-0">GUARDAR DATOS</button>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border">
                <h3 className="font-black mb-2 text-slate-800">CONCEJALES (EQUIPOS Y LISTAS)</h3>
                <p className="text-xs font-bold text-gray-500 mb-4">Para agrupar concejales en sub-listas, coloca el nombre de la lista en la primera casilla. Si ya creaste al concejal sin lista, dale al botón azul de Editar (lápiz) y cámbiale el nombre (Ej: "16 - 1-FABIO PORTILLO"). Para subir su foto, presiona la cámara.</p>
                <div className="flex gap-2 mb-6">
                    <input type="text" placeholder="LETRA LISTA (Ej: 16A)" id="inSub" className="w-1/4 p-3 border rounded-xl uppercase font-bold outline-none focus:border-red-500"/>
                    <input type="text" placeholder="NOMBRE CONCEJAL..." value={nConc} onChange={e=>setNConc(e.target.value)} className="flex-1 p-3 border rounded-xl uppercase font-bold outline-none focus:border-red-500"/>
                    <button onClick={()=>{const s=document.getElementById('inSub').value.trim().toUpperCase(); if(!nConc)return; const f=s?`${s} - ${nConc.toUpperCase()}`:nConc.toUpperCase(); set(ref(db, `configuracion/${distritoGlobal}/concejales`), [...configActual.concejales, f]); setNConc(""); document.getElementById('inSub').value="";}} className="bg-slate-800 text-white px-6 rounded-xl font-bold hover:bg-slate-700">AÑADIR</button>
                </div>

                <div className="space-y-6">
                    {Object.entries(configActual.concejales.reduce((acc,c,idx)=>{const p=c.split(' - ');const g=p.length>1?`LISTA ${p[0]}`:'SIN EQUIPO';if(!acc[g])acc[g]=[];acc[g].push({n:c,idx});return acc;},{})).map(([g,m])=>(
                        <div key={g} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="font-black text-red-600 mb-3 border-b-2 border-red-100 pb-1">{g}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {m.map(i=>(
                                    <div key={i.idx} className="bg-slate-50 p-2 rounded-lg border flex justify-between items-center hover:bg-red-50 transition-colors">
                                        {idxEd===i.idx ? (
                                            <div className="flex gap-2 w-full">
                                                <input className="flex-1 border-2 border-blue-400 p-2 rounded text-xs uppercase font-bold outline-none" value={valEd} onChange={e=>setValEd(e.target.value)} autoFocus/>
                                                <button onClick={()=>{const l=[...configActual.concejales];l[i.idx]=valEd.toUpperCase();set(ref(db,`configuracion/${distritoGlobal}/concejales`),l);setIdxEd(null);}} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded font-bold"><Save size={14}/></button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-black text-xs uppercase truncate mr-2" title={i.n}>{i.n.includes(' - ')?i.n.split(' - ')[1]:i.n}</span>
                                                <div className="flex gap-2 shrink-0 items-center">
                                                    <label className="cursor-pointer text-emerald-600 bg-emerald-100 p-1.5 rounded-md hover:bg-emerald-200 transition-colors" title="Subir foto">
                                                        {subiendo===i.n?<RefreshCw size={14} className="animate-spin"/>:<Camera size={14}/>}
                                                        <input type="file" accept="image/*" className="hidden" onChange={e=>subirFoto(e,i.n)}/>
                                                    </label>
                                                    <button onClick={()=>{setIdxEd(i.idx);setValEd(i.n);}} className="text-blue-500 bg-blue-100 p-1.5 rounded-md hover:bg-blue-200 transition-colors" title="Editar Nombre"><Edit2 size={14}/></button>
                                                    <button onClick={()=>{if(window.confirm("¿Borrar?")){const l=[...configActual.concejales];l.splice(i.idx,1);set(ref(db,`configuracion/${distritoGlobal}/concejales`),l);}}} className="text-red-500 bg-red-100 p-1.5 rounded-md hover:bg-red-200 transition-colors" title="Eliminar"><Trash2 size={14}/></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {esMaster && <button onClick={()=>{if(window.confirm("¿Restablecer todo a cero?")) { const nc={}; DISTRITOS_CONCEPCION.forEach(d=>{nc[d]={intendente:"",lista:"",meta_intendente:5000,meta_concejales:500,concejales:[]}}); set(ref(db,'configuracion'),nc); alert("Restablecido");}}} className="w-full bg-red-100 text-red-800 py-3 rounded-xl font-black mt-8 hover:bg-red-200">⚠️ RESTABLECER DEPARTAMENTO A FÁBRICA</button>}
        </div>
    );
}
