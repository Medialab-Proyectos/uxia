// Token de acceso por empresa para el login. NO es seguridad (eso lo dan Supabase Auth + RLS):
// solo evita links "en crudo" y enumeración casual, y sirve para brandear y acotar la vista del
// empleado externo a SU empresa. El token codifica el company_id de forma reversible.
//
// Uso: la URL de un empleado externo es  …/?c=<token>  (medialab usa su propio token = "link principal").

function b64urlEncode(str) {
  const b = typeof btoa === "function" ? btoa(str) : Buffer.from(str, "utf8").toString("base64");
  return b.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("utf8");
}

const PREFIX = "ux.";

export function encodeCompanyToken(companyId) {
  if (!companyId) return "";
  return b64urlEncode(PREFIX + companyId).split("").reverse().join("");
}

export function decodeCompanyToken(token) {
  if (!token) return "";
  try {
    const raw = b64urlDecode(String(token).split("").reverse().join(""));
    return raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : "";
  } catch {
    return "";
  }
}

// Lee ?c=<token> de la URL actual y devuelve el company_id (o "" si no hay/ inválido).
export function companyFromUrl() {
  if (typeof window === "undefined") return "";
  try {
    const t = new URLSearchParams(window.location.search).get("c");
    return decodeCompanyToken(t);
  } catch {
    return "";
  }
}
