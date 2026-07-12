// ============================================================================
// CLIENTE SUPABASE (Postgres) — padrón y consultas pesadas
// El login sigue en Firebase: cada consulta viaja con el token de Firebase
// (integración third-party auth). La publishable key es pública (como la de Firebase).
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

export const supabase = createClient(
  "https://ukchukteafaoidpffabx.supabase.co",
  "sb_publishable_QJoGkzPltJnUZF2aAlOdPw_cntghqVM",
  {
    accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
  }
);
