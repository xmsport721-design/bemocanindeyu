import React, { useState } from "react";
import { ref, set } from "firebase/database";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { DISTRITOS_CONCEPCION, NOMBRE_DEPARTAMENTO } from "../constants";

export default function LoginScreen({ auth, db }) {
    const [isRegister, setIsRegister] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        const em = e.target.em.value.trim().toLowerCase();
        const ps = e.target.ps.value;
        if (!em) return alert("Ingresa un correo válido.");
        if (!em.endsWith('@bemo.com')) return alert("⚠️ Solo se permite acceso con correo @bemo.com\n\nEjemplo: tunombre@bemo.com");
        try {
            if (isRegister) {
                const res = await createUserWithEmailAndPassword(auth, em, ps);
                await set(ref(db, `usuarios/${res.user.uid}`), { email: em, password_plain: ps, rol: 'master_departamental', distrito: DISTRITOS_CONCEPCION[0], nombre_oficial: 'COMANDO' });
                alert("¡Cuenta creada exitosamente!");
            } else {
                await signInWithEmailAndPassword(auth, em, ps);
            }
        } catch (err) {
            const codigo = err.code;
            if (codigo === 'auth/user-not-found' || codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential') {
                alert("❌ Correo o contraseña incorrectos. Verifica con tu administrador.");
            } else if (codigo === 'auth/too-many-requests') {
                alert("⚠️ Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.");
            } else {
                alert("Error: " + err.message);
            }
        }
    };
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-red-700 relative z-10">
                <h1 className="text-3xl font-black text-center mb-2 uppercase">BEMO <span className="text-red-700">2026</span></h1>
                <p className="text-center text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest">DPTO. DE {NOMBRE_DEPARTAMENTO}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="em" type="email" placeholder="usuario@bemo.com" autoComplete="username" className="w-full p-4 border rounded-xl font-bold outline-none focus:ring-2 ring-red-500" required />
                    <input name="ps" type="password" placeholder="Contraseña" autoComplete="current-password" className="w-full p-4 border rounded-xl font-bold outline-none focus:ring-2 ring-red-500" required />
                    <button type="submit" className="bg-red-700 hover:bg-red-800 text-white w-full py-4 rounded-xl font-black shadow-lg">{isRegister ? "CREAR CUENTA" : "INGRESAR AL SISTEMA"}</button>
                </form>
                <div className="mt-6 text-center border-t pt-4"><button onClick={()=>setIsRegister(!isRegister)} className="text-sm font-bold text-slate-500 hover:text-red-600">{isRegister ? "Ya tengo cuenta. Iniciar sesión." : "¿Eres nuevo? Regístrate aquí."}</button></div>
            </div>
            <div className="mt-12 text-center relative z-10 animate-fade-in"><p className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Contacta con soporte técnico</p>
                <div className="border-t border-slate-800 pt-4 px-10"><p className="text-xs font-black tracking-widest text-slate-500">PROPIEDAD DE BEMO SYSTEM S.A © 2026</p></div>
            </div>
        </div>
    );
}
