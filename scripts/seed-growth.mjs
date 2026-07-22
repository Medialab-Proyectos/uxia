// Siembra inicial de "buenas prácticas de crecimiento" por proyecto (el MD como consultor senior).
// Idempotente: borra las de source='seed-md-inicial' y las vuelve a insertar.
// Correr:  node --env-file=.env scripts/seed-growth.mjs
const U = process.env.SUPABASE_URL.replace(/\/$/, "");
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const SRC = "seed-md-inicial";

const P = (company_id, client, titulo, porque, como, marco, impacto, esfuerzo) =>
  ({ company_id, client: client || null, titulo, porque, como, marco, impacto, esfuerzo, status: "activa", source: SRC });

const practices = [
  // ARCUS · Gestión
  P("arcus", "Gestión", "Entrevistas de 'trabajo por hacer' a 5 usuarios",
    "No sabemos qué progreso 'contratan' al usar Gestión; sin eso el valor es invisible y la renovación frágil.",
    "Agenda 5 entrevistas JTBD de 20 min (qué hacían antes, qué los hizo cambiar, qué resultado esperan). Resume en 1 página de 'trabajos'.",
    "Jobs To Be Done (Christensen/Moesta)", "alto", "medio"),
  P("arcus", "Gestión", "Momento 'ajá' en el primer uso",
    "Si el usuario no llega al valor en la primera sesión, no vuelve.",
    "Define el evento de activación (ej. primer proceso gestionado) y guía el onboarding para llegar ahí en menos de 5 minutos.",
    "Activation / Reforge (Sean Ellis)", "alto", "medio"),
  P("arcus", null, "Caso de éxito con números",
    "La autoridad y la prueba social cierran la renovación.",
    "Documenta 1 cliente con antes/después medible y conviértelo en una lámina para reuniones.",
    "Influencia: prueba social + autoridad (Cialdini)", "medio", "bajo"),

  // ASPENVIEW · Página Web
  P("aspenview", "Página Web", "Posicionamiento en una frase",
    "Si la web no dice en 5 segundos para quién es y por qué es distinta, se pierde el lead.",
    "Aplica la plantilla de posicionamiento (alternativa, atributo único, valor, para quién) y ponla en el hero.",
    "Positioning (April Dunford)", "alto", "bajo"),
  P("aspenview", "Página Web", "Imán de leads",
    "El tráfico sin captura no crece; falta una oferta irresistible a cambio del correo.",
    "Crea un recurso gratis de alto valor (checklist/plantilla) a cambio del correo y mide la conversión.",
    "$100M Leads / Value Equation (Hormozi)", "alto", "medio"),
  P("aspenview", "Página Web", "Prueba social sobre el pliegue",
    "El visitante desconfía sin señales de terceros.",
    "Agrega logos, testimonios y métricas reales arriba del fold.",
    "Prueba social (Cialdini)", "medio", "bajo"),

  // BID · ClientPortal, Interfaz Fiduciaria (lanzamiento inminente)
  P("bid", "ClientPortal", "Quitar fricción del flujo crítico antes del lanzamiento",
    "El embudo cae de 152 a 80: cada paso muerto es dinero perdido el día 1.",
    "Mapea el flujo, elimina campos/clics no esenciales y pruébalo con 5 usuarios reales antes de salir.",
    "Continuous Discovery (Torres) + Value Equation (Hormozi)", "alto", "medio"),
  P("bid", "Interfaz Fiduciaria", "Señales de confianza para un producto fiduciario",
    "En finanzas, sin confianza no hay adopción.",
    "Haz visibles seguridad, respaldo y autoridad (sellos, respaldo institucional, claridad legal) en los momentos de decisión.",
    "Autoridad + Prueba social (Cialdini)", "alto", "bajo"),
  P("bid", null, "Medir satisfacción desde el día 1",
    "Vamos a ciegas si no conocemos el dolor real post-lanzamiento.",
    "Instala una micro-encuesta de 1 pregunta al completar el flujo y un canal de feedback directo.",
    "PMF survey (Sean Ellis) / NPS", "medio", "bajo"),

  // GARAGEFOLIO · B2C
  P("garagefolio", "B2C", "Bucle de referidos",
    "En B2C el crecimiento barato viene de que un usuario traiga a otro.",
    "Da un incentivo de doble lado (quien invita y quien llega) en el momento de mayor satisfacción.",
    "Growth loops / viral (Reforge)", "alto", "medio"),
  P("garagefolio", "B2C", "Gancho de hábito",
    "Sin retorno recurrente, el costo de adquisición nunca se paga.",
    "Diseña el ciclo disparador → acción → recompensa → inversión para que vuelvan solos.",
    "Hooked (Nir Eyal)", "alto", "medio"),
  P("garagefolio", "B2C", "Contenido de usuarios (UGC)",
    "La gente confía en gente, no en marcas.",
    "Facilita que los usuarios muestren lo que crean y reséñalo en el producto y en redes.",
    "Prueba social (Cialdini) / Tribus (Godin)", "medio", "bajo"),

  // MEDIALAB · interno
  P("medialab", "Proyectos internos", "Reporte DesignOps semanal impreso",
    "MediaLab se vende como DesignOps; el reporte tangible sostiene el posicionamiento y el precio.",
    "Automatiza un PDF semanal profesional con métricas DesignOps por cliente y entrégalo como ritual.",
    "Posicionamiento (Dunford) / Autoridad (Cialdini)", "alto", "medio"),
  P("medialab", null, "Empezar por el porqué en cada propuesta",
    "Los clientes compran la razón, no la lista de funciones.",
    "Estandariza que toda propuesta abra con el 'porqué' y el resultado, no con el 'qué'.",
    "Start With Why (Sinek)", "medio", "bajo"),
  P("medialab", "Gestión y talento humano", "Ritual de descubrimiento continuo",
    "El equipo prioriza mejor si habla con usuarios cada semana.",
    "Institucionaliza 1 entrevista semanal por proyecto y un mapa de oportunidades vivo.",
    "Continuous Discovery (Teresa Torres)", "medio", "medio"),

  // MEGALOGIC-PHOENIX · Backoffice, Phoenix Mobile, Corvus
  P("megalogic-phoenix", "Phoenix Mobile", "Tiempo al primer valor en móvil",
    "En móvil, si tarda en servir, se desinstala.",
    "Reduce pasos de registro y lleva al usuario a su primera tarea útil en menos de 3 minutos.",
    "Activation (Reforge) / Hooked (Eyal)", "alto", "medio"),
  P("megalogic-phoenix", "Backoffice", "Adopción interna guiada",
    "Un backoffice sin adopción no genera ROI y frena la renovación.",
    "Nombra campeones internos y usa un checklist de adopción por rol en las primeras 2 semanas.",
    "Diffusion of Innovations (Rogers) / Change mgmt", "alto", "medio"),
  P("megalogic-phoenix", null, "Expansión por uso",
    "Crecer con la cuenta es más barato que buscar nuevas.",
    "Detecta señales de uso alto y ofrece el siguiente módulo justo en ese momento.",
    "Land & Expand / PLG (Reforge)", "medio", "medio"),

  // METRICS LAB · SouthVue, Xtreme Collision, Rockin JL Waste
  P("metrics-lab", null, "Tablero de resultados, no de datos",
    "El cliente paga por decisiones, no por gráficas.",
    "Convierte cada dashboard en 3 decisiones accionables con su métrica dueña.",
    "Outcomes over outputs (Torres) / North Star (Reforge)", "alto", "medio"),
  P("metrics-lab", null, "Reunión trimestral de valor (QBR)",
    "Sin mostrar el valor logrado, la renovación se enfría.",
    "Ritual trimestral en 1 página: resultados, ahorro/ingreso generado y próximo objetivo.",
    "Customer Success / Autoridad (Cialdini)", "alto", "bajo"),
  P("metrics-lab", "SouthVue", "Historia de éxito replicable",
    "Un caso fuerte abre puertas a clientes similares.",
    "Documenta el mejor resultado y úsalo como plantilla de venta a verticales parecidas.",
    "Prueba social (Cialdini)", "medio", "bajo"),

  // PENSEMOS · PIA, Ecopetrol/REVO-lucion
  P("pensemos", "Ecopetrol/REVO-lucion", "Alinear a quienes deciden",
    "En enterprise, el proyecto muere si el patrocinador ejecutivo no ve su interés.",
    "Mapea stakeholders, identifica al patrocinador y ata el proyecto a su métrica de negocio.",
    "Stakeholder mapping / Negociación (Chris Voss)", "alto", "medio"),
  P("pensemos", "PIA", "Gestión del cambio para la adopción",
    "La mejor herramienta fracasa si la gente no cambia su forma de trabajar.",
    "Plan de adopción: formación, campeones y quick-wins visibles en 30 días.",
    "Change mgmt (Kotter) / Diffusion (Rogers)", "alto", "medio"),
  P("pensemos", null, "Autoridad con el caso Ecopetrol",
    "Un logo grande bien contado abre todo el sector energía y público.",
    "Con permiso, arma un caso de autoridad y úsalo en la conversación comercial.",
    "Autoridad + Prueba social (Cialdini)", "medio", "bajo"),

  // TUBARCO · Portal de noticias
  P("tubarco", "Portal de noticias", "Hábito diario de lectura",
    "Un portal de noticias vive de la recurrencia; sin hábito no hay audiencia.",
    "Notificación/boletín en el horario pico y una sección 'para ti' que dé razón de volver cada día.",
    "Hooked (Eyal) / Permission marketing (Godin)", "alto", "medio"),
  P("tubarco", "Portal de noticias", "Retención sobre adquisición",
    "Traer lectores que no vuelven quema presupuesto.",
    "Mide DAU/WAU y ataca la caída de la semana 1 con contenido de enganche.",
    "Retention loops (Reforge)", "alto", "medio"),
  P("tubarco", null, "Camino a la monetización",
    "Audiencia sin modelo de ingreso no es negocio.",
    "Prueba muro suave/membresía en el contenido de mayor valor y mide la disposición a pagar.",
    "$100M Offers (Hormozi) / Van Westendorp", "medio", "medio"),
];

(async () => {
  // Borra la siembra previa (idempotente).
  const del = await fetch(`${U}/rest/v1/growth_practices?source=eq.${SRC}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
  console.log("borrado previo:", del.status);
  // Inserta en bloque.
  const ins = await fetch(`${U}/rest/v1/growth_practices`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(practices) });
  if (!ins.ok) { console.error("ERROR insertando:", ins.status, await ins.text()); process.exit(1); }
  console.log(`OK: ${practices.length} prácticas sembradas.`);
})();
