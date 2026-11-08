// =====================================================================
// Vigia del formulario de cotizacion · corre cada hora (JC, 8 nov 2026)
// ---------------------------------------------------------------------
// Alarma por silencio: si en horario habil pasan 3 horas sin solicitudes, le
// escribe a JC. La logica vive en lib/cotizar-vigia.mjs; aca solo Blobs + horario.
// =====================================================================
import { getStore } from "@netlify/blobs";
import { crearVigia } from "./lib/cotizar-vigia.mjs";

export const config = { schedule: "@hourly" };

const vigia = crearVigia({ getStore });

export default async () => {
  try { console.log("[vigia]", JSON.stringify(await vigia())); }
  catch (e) { console.error("[vigia] error", e && e.message); }
  return new Response("ok");
};
