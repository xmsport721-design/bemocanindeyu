import React, { useState } from "react";
import { ref, set, remove } from "firebase/database";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { Eye, Trash2 } from "lucide-react";
import { firebaseConfig } from "../firebase";
import { DISTRITOS_CONCEPCION } from "../constants";

export default function PanelUsuarios({ perfil, usuariosRegistrados, configuracionDepartamental, db, distritoFiltro, usuariosOnline }) {
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const [verClaves, setVerClaves] = useState({}); const [mostrarForm, setMostrarForm] = useState(false);
    const [nEmail, setNEmail] = useState(""); const [nClave, setNClave] = useState(""); const [nRol, setNRol] = useState("veedor"); const [nDistrito, setNDistrito] = useState(distritoFiltro === "TODOS" ? DISTRITOS_CONCEPCION[0] : distritoFiltro);
    const [creando, setCreando] = useState(false);

    const usuarios = Object.entries(usuariosRegistrados).filter(([_, d]) => d?.email && (distritoFiltro === "TODOS" || d.distrito === distritoFiltro || d.rol === 'pendiente'));
    const actualizar = (uid, c, v) => { if(!esMaster && v==='master_departamental') return alert("Sin permisos."); set(ref(db, `usuarios/${uid}/${c}`), v); };
    const eliminar = (uid, e) => { if(window.confirm(`⚠️ ¿Eliminar a ${e}?`)) remove(ref(db, `usuarios/${uid}`)); };

    const crearUsr = async (e) => {
        e.preventDefault();
        if(nClave.length<6) return alert("Mín. 6 letras");
        if(!nEmail.trim().toLowerCase().endsWith('@bemo.com')) return alert("⚠️ Solo se pueden crear usuarios con correo @bemo.com\n\nEjemplo: nombre@bemo.com");
        setCreando(true);
        try {
            const apps = getApps(); let sApp = apps.find(a => a.name === "SecApp"); if (!sApp) sApp = initializeApp(firebaseConfig, "SecApp");
            const sAuth = getAuth(sApp); const emailNorm = nEmail.trim().toLowerCase(); const res = await createUserWithEmailAndPassword(sAuth, emailNorm, nClave);
            await set(ref(db, `usuarios/${res.user.uid}`), { email: emailNorm, password_plain: nClave, rol: nRol, distrito: esMaster ? nDistrito : perfil.distrito, nombre_oficial: "" });
            await signOut(sAuth); alert("✅ Creado"); setMostrarForm(false); setNEmail(""); setNClave("");
        } catch(err) { alert(err.message); } setCreando(false);
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-blue-600">
            <div className="flex justify-between border-b pb-4 mb-6"><h2 className="text-2xl font-black uppercase text-slate-800">ACCESOS</h2><button onClick={()=>setMostrarForm(!mostrarForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">{mostrarForm ? "CERRAR" : "+ CREAR"}</button></div>
            {mostrarForm && (
                <form onSubmit={crearUsr} className="bg-blue-50 p-6 rounded-2xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"><input type="email" required className="p-3 border rounded-lg" value={nEmail} onChange={e=>setNEmail(e.target.value)} placeholder="Email..." /><input type="text" required className="p-3 border rounded-lg" value={nClave} onChange={e=>setNClave(e.target.value)} placeholder="Clave..." /><select className="p-3 border rounded-lg" value={nRol} onChange={e=>setNRol(e.target.value)}><option value="veedor">VEEDOR</option><option value="dirigente">DIRIGENTE</option><option value="concejal">CONCEJAL</option><option value="super_admin">ADMIN</option></select>{esMaster && <select className="p-3 border rounded-lg uppercase" value={nDistrito} onChange={e=>setNDistrito(e.target.value)}>{DISTRITOS_CONCEPCION.map(d=><option key={d}>{d}</option>)}</select>}</div>
                    <button type="submit" disabled={creando} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black">{creando ? "CREANDO..." : "GUARDAR"}</button>
                </form>
            )}
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 uppercase text-[10px]"><tr><th className="p-3">Estado</th><th className="p-3">Email</th><th className="p-3">Clave</th><th className="p-3">Distrito</th><th className="p-3">Rol</th><th className="p-3">Nombre</th><th className="p-3 text-center">X</th></tr></thead><tbody className="divide-y">
                {usuarios.map(([id, d]) => {
                    const isOnline = !!(usuariosOnline||{})[id];
                    return (
                    <tr key={id} className={`hover:bg-slate-50 ${isOnline ? 'bg-green-50/40' : ''}`}>
                        <td className="p-3 text-center">
                            <span title={isOnline ? "CONECTADO AHORA" : "DESCONECTADO"} className={`inline-block w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                            {isOnline && <div className="text-[8px] font-black text-green-600 mt-0.5">ONLINE</div>}
                        </td>
                        <td className="p-3 font-bold">{d.email}</td>
                        <td className="p-3 font-mono text-xs flex items-center gap-2"><span>{verClaves[id]?d.password_plain:'••••'}</span><button onClick={()=>setVerClaves(p=>({...p, [id]:!p[id]}))}><Eye size={14}/></button></td>
                        <td className="p-3 font-bold text-[10px]">{d.distrito}</td>
                        <td className="p-3 text-[10px] uppercase">{d.rol}</td>
                        <td className="p-3 text-[10px]">{d.rol==='concejal' ? <select className="p-2 border rounded" value={d.nombre_oficial||""} onChange={e=>actualizar(id,'nombre_oficial',e.target.value)}><option value="">Asignar...</option>{(configuracionDepartamental[d.distrito]?.concejales||[]).map(c=><option key={c}>{c}</option>)}</select> : '-'}</td>
                        <td className="p-3 text-center"><button onClick={()=>eliminar(id,d.email)} className="text-red-500"><Trash2 size={16}/></button></td>
                    </tr>
                    );
                })}
            </tbody></table></div>
        </div>
    );
}
