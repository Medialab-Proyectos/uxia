// Enriquecimiento de "buenas prácticas de crecimiento" desde la BIBLIOTECA DE REFERENCIA del MD.
// AÑADE prácticas nuevas por empresa (no toca las de otras source como 'seed-md-inicial').
// Idempotente: borra las de este source y las vuelve a insertar.
// Correr:  node --env-file=.env scripts/enrich-growth.mjs
const U = process.env.SUPABASE_URL.replace(/\/$/, "");
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const SRC = "md-crecimiento-2026-07";

const P = (company_id, client, titulo, porque, como, marco, impacto, esfuerzo) =>
  ({ company_id, client: client || null, titulo, porque, como, marco, impacto, esfuerzo, status: "activa", source: SRC });

const practices = [
  // ── ARCUS · dolores: caída de leads (Bubble dejó de referir), bugs sin QA, desalineación diseño↔historias ──
  P("arcus", "Gestión", "Reactivar el canal de referidos con una conversación, no un correo",
    "Bubble pasó de referir ~1/día a ~3/mes: el canal más barato se secó y nadie lo está reabriendo.",
    "Agenda una charla directa con el referidor clave, empatiza con su situación y co-crea un acuerdo simple de referidos con contrapartida clara. No pedir por correo: hablar.",
    "Nunca dividas la diferencia (Chris Voss) · Cómo ganar amigos e influir sobre las personas (Dale Carnegie)", "alto", "bajo"),
  P("arcus", "Gestión", "QA como hábito del sistema, no como fuerza de voluntad",
    "Los bugs pequeños (filtros, alineación, ortografía) golpean la percepción y salen porque el dev se salta el testeo.",
    "Convierte el checklist de QA en un hábito atómico: hazlo obvio (plantilla en el PR), fácil (2 min) y satisfactorio (marca visible de 'revisado'). El sistema evita el error, no la disciplina.",
    "Atomic Habits (James Clear)", "alto", "bajo"),

  // ── ASPENVIEW · dolor real: tarea de seguimiento que quedó 'en el limbo' → multa ──
  P("aspenview", "Página Web", "Ningún compromiso queda en el limbo: dueño + fecha + resultado",
    "Un compromiso de seguimiento con el cliente se perdió y terminó en una multa; el seguimiento no puede depender de la memoria.",
    "Cada acuerdo con el cliente se registra al cierre de la reunión con dueño y fecha visibles, y se revisa como un OKR: lo primero es lo primero, con revisión semanal explícita.",
    "Mide lo que importa / OKR (John Doerr) · Los 7 hábitos de la gente altamente efectiva (Stephen Covey)", "alto", "bajo"),

  // ── BID · Interfaz Fiduciaria: producto financiero, confianza, claridad ──
  P("bid", "Interfaz Fiduciaria", "Claridad que baja la ansiedad en el flujo financiero",
    "En un producto fiduciario, la duda del usuario en un paso crítico frena la adopción; la mente decide rápido y con miedo.",
    "Reduce la carga cognitiva de los momentos de decisión (enmiendas, montos): un paso = una decisión, con estado explícito ('en curso por el banco') y microcopys que hablan como el usuario.",
    "Pensar rápido, pensar despacio (Daniel Kahneman) · El poder de las palabras (Mariano Sigman)", "alto", "medio"),

  // ── GARAGEFOLIO · B2C: hábito sin quemar al usuario ──
  P("garagefolio", "B2C", "Gatillo diario que no fatiga al usuario",
    "El hábito sostiene la retención en B2C, pero las notificaciones agresivas queman y hacen desinstalar.",
    "Diseña un solo disparador de valor por día (no ráfagas) y respeta la atención del usuario; que vuelva porque quiere, no por presión.",
    "Inmune a la distracción (Nir Eyal) · Neurohábitos (Nicole Vignola)", "alto", "medio"),

  // ── MEDIALAB · interno: talento, cultura, energía del equipo ──
  P("medialab", "Proyectos internos", "OKRs trimestrales por proyecto interno",
    "Los proyectos internos (UXBox, UXGreen, Cumbreva, curso) compiten por tiempo muerto y se diluyen sin un norte medible.",
    "Define 1 objetivo trimestral por iniciativa interna con 2–3 resultados clave y revísalos en el ritual semanal.",
    "Mide lo que importa / OKR (John Doerr)", "medio", "bajo"),
  P("medialab", "Gestión y talento humano", "Cultura de candor y energía sostenible del equipo",
    "El talento rinde y se queda cuando hay franqueza segura y un ritmo que no lo agota.",
    "Instala un espacio de feedback franco sin culpa (revisión de trabajo, no de personas) y protege el ritmo: foco por bloques y descanso real.",
    "Creatividad S.A. (Ed Catmull) · Los líderes comen al final (Simon Sinek) · Hyper Efficient (Mithu Storoni)", "medio", "medio"),

  // ── MEGALOGIC-PHOENIX · Corvus: dependencia externa (Hernán), recurso nuevo a contratar ──
  P("megalogic-phoenix", "Corvus", "Desbloquear la dependencia externa negociando, no esperando",
    "El despliegue de Corvus está bloqueado esperando a Hernán: la espera pasiva es costo puro.",
    "Prepara la conversación con escucha táctica: entiende su restricción, ofrece un camino que le sirva y acuerda una fecha concreta. Mover la dependencia es una negociación, no un recordatorio.",
    "Nunca dividas la diferencia (Chris Voss)", "alto", "bajo"),
  P("megalogic-phoenix", "Phoenix Mobile", "Onboarding del recurso nuevo: primeros 90 días",
    "Se va a contratar un recurso; sin un plan de entrada, tarda meses en aportar y frena el proyecto.",
    "Diseña un plan de 90 días con quick-wins tempranos, contexto del producto y objetivos claros por semana para que aporte pronto.",
    "Los primeros 90 días (Michael Watkins)", "medio", "medio"),

  // ── METRICS LAB · dolores: creativos envejecidos, onboarding sin fechas ──
  P("metrics-lab", null, "Cadencia de creativos como hábito atómico mensual",
    "Las campañas PMAX/Demand Gen caen si no entran creativos nuevos cada mes; hoy dependen de que alguien se acuerde.",
    "Fija un ritual mensual fijo (fecha en calendario, plantilla lista, responsable) para producir y renovar creativos. La cadencia vive del sistema, no de la memoria.",
    "Atomic Habits (James Clear)", "alto", "bajo"),
  P("metrics-lab", null, "Onboarding con fechas comprometidas desde la compra",
    "El onboarding se alarga por falta de fechas y el equipo se queda corto de tiempo.",
    "Plantilla de onboarding con hitos y fechas atadas al momento de la compra, tratadas como resultados clave con dueño y vencimiento.",
    "Los primeros 90 días (Michael Watkins) · Mide lo que importa / OKR (John Doerr)", "alto", "bajo"),

  // ── PENSEMOS · enterprise/público: patrocinador, autoridad ──
  P("pensemos", "Ecopetrol/REVO-lucion", "Contar el caso como un TED para abrir el sector",
    "Un logo grande mal contado no vende; bien contado abre todo el sector energía y público.",
    "Arma la historia del caso con estructura de charla TED (una idea central, tensión, resultado con número) y úsala en la conversación comercial.",
    "Hable como TED (Carmine Gallo)", "medio", "bajo"),

  // ── TUBARCO · portal de noticias: recurrencia y titulares ──
  P("tubarco", "Portal de noticias", "Titulares que enganchan con claridad, no con clickbait",
    "El portal vive de la recurrencia; un titular confuso o tramposo pierde al lector y la confianza.",
    "Escribe titulares claros que activen curiosidad honesta (la palabra correcta mueve la decisión) y prueba variantes midiendo apertura sin traicionar el contenido.",
    "El poder de las palabras (Mariano Sigman) · Pensar con claridad (Shane Parrish)", "medio", "bajo"),
];

(async () => {
  const del = await fetch(`${U}/rest/v1/growth_practices?source=eq.${SRC}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
  console.log("borrado previo:", del.status);
  const ins = await fetch(`${U}/rest/v1/growth_practices`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(practices) });
  if (!ins.ok) { console.error("ERROR insertando:", ins.status, await ins.text()); process.exit(1); }
  const byCo = practices.reduce((m, p) => ((m[p.company_id] = (m[p.company_id] || 0) + 1), m), {});
  console.log(`OK: ${practices.length} prácticas de crecimiento enriquecidas.`);
  console.log(Object.entries(byCo).map(([c, n]) => `  ${c}: +${n}`).join("\n"));
})();
