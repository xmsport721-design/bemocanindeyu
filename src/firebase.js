// ============================================================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (proyecto: concepcion-7e55e)
// ============================================================================
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
// storage NO se importa acá: solo lo usa el panel de config (chunk lazy) → menos JS en el arranque

export const firebaseConfig = {
  apiKey: "AIzaSyC03JZte5apho_4LEk2-pp1HJ7avuyJ5bM",
  authDomain: "concepcion-7e55e.firebaseapp.com",
  databaseURL: "https://concepcion-7e55e-default-rtdb.firebaseio.com",
  projectId: "concepcion-7e55e",
  storageBucket: "concepcion-7e55e.firebasestorage.app",
  messagingSenderId: "42796887287",
  appId: "1:42796887287:web:0883cd3613ab6260dab7f2",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

export default app;
