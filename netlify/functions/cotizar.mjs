// =====================================================================
// POST /cotizar/enviar · POST /cotizar/agente  (5 nov 2026)
// ---------------------------------------------------------------------
// Formulario propio de cotizacion con reparto entre agentes. Toda la logica
// vive en lib/cotizar-handler.mjs; aca solo se le inyecta Netlify Blobs.
// =====================================================================
import { getStore } from "@netlify/blobs";
import { crearHandler } from "./lib/cotizar-handler.mjs";

export const config = { path: ["/cotizar/enviar", "/cotizar/agente"] };

export default crearHandler({ getStore });
