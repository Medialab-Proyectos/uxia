import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const POST_QUERY_TERMS =
  '("buscamos" OR "vacante" OR "estamos buscando" OR "se busca" OR "contratando")';
const MAX_RESULT_AGE_DAYS = 62;

const SOURCES = [
  {
    key: "linkedin",
    name: "LinkedIn",
    buildUrl: (q, remoteOnly) =>
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(q)}&location=${encodeURIComponent("América Latina")}${remoteOnly ? "&f_WT=2" : ""}&sortBy=DD&start=0`,
    baseUrl: "https://www.linkedin.com",
    linkSelector: "a.base-card__full-link, a[href*='/jobs/view/']",
    titleSelector: ".base-search-card__title, h3",
    companySelector: ".base-search-card__subtitle, h4",
    locationSelector: ".job-search-card__location",
  },
  {
    key: "computrabajo",
    name: "Computrabajo",
    buildUrl: (q) =>
      `https://co.computrabajo.com/trabajo-de-${encodeURIComponent(slugify(q))}`,
    baseUrl: "https://co.computrabajo.com",
    linkSelector: "a[href*='/ofertas-de-trabajo/'], a[href*='/trabajo-de-']",
    titleSelector: "h1, h2, h3",
    companySelector: "[data-test='company-name'], .fs16, p",
    locationSelector: "[data-test='location'], .mr10",
  },
  {
    key: "magneto",
    name: "Magneto",
    buildUrl: (q, remoteOnly) =>
      `https://www.magneto365.com/co/trabajos/buscar/${encodeURIComponent(firstKeyword(q))}?q=${encodeURIComponent(q)}${remoteOnly ? "&workModality=remote" : ""}`,
    baseUrl: "https://www.magneto365.com",
    linkSelector: "a[href*='/empleos/'], a[href*='/ofertas/'], a[href*='trabajo']",
    titleSelector: "h1, h2, h3",
    companySelector: "[class*='company'], [class*='empresa'], p",
    locationSelector: "[class*='location'], [class*='ubicacion'], p",
  },
  {
    key: "elempleo",
    name: "elempleo",
    buildUrl: (q) =>
      `https://www.elempleo.com/co/ofertas-empleo/trabajo-${encodeURIComponent(slugify(q))}`,
    baseUrl: "https://www.elempleo.com",
    linkSelector: "a[href*='/co/ofertas-trabajo/'], a[href*='/co/ofertas-empleo/']",
    titleSelector: "h1, h2, h3",
    companySelector: "[class*='company'], [class*='empresa'], p",
    locationSelector: "[class*='location'], [class*='ubicacion'], p",
  },
  {
    key: "getonboard",
    name: "Get on Board",
    buildUrl: (q, remoteOnly) =>
      `https://www.getonbrd.com/jobs?q=${encodeURIComponent(q)}${remoteOnly ? "&remote=true" : ""}`,
    baseUrl: "https://www.getonbrd.com",
    linkSelector: "a[href*='/jobs/']",
    titleSelector: "h1, h2, h3",
    companySelector: "[class*='company'], p",
    locationSelector: "[class*='remote'], [class*='location'], p",
  },
  {
    key: "torre",
    name: "Torre",
    buildUrl: (q) => `https://torre.ai/search/jobs?q=${encodeURIComponent(q)}`,
    baseUrl: "https://torre.ai",
    linkSelector: "a[href*='/jobs/'], a[href*='/job/']",
    titleSelector: "h1, h2, h3",
    companySelector: "[class*='company'], p",
    locationSelector: "[class*='location'], p",
  },
];

export async function scrapeJobsExpanded({ query, remoteOnly = true, limit = 18 }) {
  const queries = buildExpandedQueries(query);
  const perQueryLimit = Math.max(6, Math.ceil(limit / Math.min(queries.length, 4)));
  const chunks = await Promise.allSettled(
    queries.map((q) => scrapeJobsSingle({ query: q, remoteOnly, limit: perQueryLimit }))
  );
  return dedupeJobs(chunks.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
    .sort((a, b) => comparePriority(a, b))
    .slice(0, limit);
}

export async function scrapeJobs({ query, remoteOnly = true, limit = 18, expand = false }) {
  if (expand) return scrapeJobsExpanded({ query, remoteOnly, limit });
  return scrapeJobsSingle({ query, remoteOnly, limit });
}

async function scrapeJobsSingle({ query, remoteOnly = true, limit = 18 }) {
  const directPost = buildDirectLinkedInPost(query);
  const perSource = Math.max(2, Math.ceil(limit / SOURCES.length));
  const [primarySource, ...secondarySources] = SOURCES;
  const apifyPosts = await scrapeApifyLinkedInPosts(query, remoteOnly, Math.min(10, limit));
  const xrayJobs = await scrapeGoogleXrayJobs(query, remoteOnly, Math.max(6, perSource));
  const postJobs = await scrapeLinkedInPosts(query, remoteOnly, Math.max(6, perSource));
  const primaryJobs = await scrapeSource(primarySource, query, remoteOnly, Math.max(5, perSource));
  const chunks = await Promise.allSettled(
    secondarySources.map((source) => scrapeSource(source, query, remoteOnly, perSource))
  );
  const secondaryJobs = chunks
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter(Boolean);
  return dedupeJobs([...directPost, ...apifyPosts, ...xrayJobs, ...postJobs, ...primaryJobs, ...secondaryJobs])
    .sort((a, b) => comparePriority(a, b))
    .slice(0, limit);
}

function buildExpandedQueries(query) {
  const base = cleanText(query);
  return [
    base,
    "UX UI product designer remoto Colombia",
    "UX Research UX Researcher remoto Colombia LATAM",
    "UX Engineer Ingeniero UX remoto Colombia LATAM",
    "Product Designer remoto español LATAM",
    "UX UI remoto español Colombia",
  ]
    .filter(Boolean)
    .filter((q, index, arr) => arr.indexOf(q) === index);
}

function buildDirectLinkedInPost(query) {
  const match = String(query).match(/https?:\/\/(?:www\.)?linkedin\.com\/posts\/[^\s,]+/i);
  if (!match) return [];
  const url = match[0].replace(/[),.]+$/, "");
  const text = cleanText(query.replace(url, ""));
  return [
    scoreJob({
      id: `manual-linkedin-post-${hash(url)}`,
      titulo: inferPostTitle(text || "Post de LinkedIn pegado", text),
      empresa: inferAuthorFromLinkedInTitle(text) || "Post de LinkedIn",
      fuente: "LinkedIn Posts",
      fuentePrioridad: "primaria",
      entradaManual: true,
      url,
      ubicacion: inferPrimaryLocation(text),
      remoto: inferRemote(text),
      idioma: "español",
      salario: extractSalary(text),
      contacto: (text.match(EMAIL_RE) || [])[0] || inferContact(text) || "No especificado",
      canal: (text.match(EMAIL_RE) || [])[0] ? "correo" : "LinkedIn",
      categoria: looksLikeOpportunity(text) ? "lead comercial" : "empleo",
      prioridad: "alta",
      señalesIA: extractAiSignals(text),
      resumen: text ? summarize(text) : "URL de post agregada manualmente para revisar y contactar",
      score: 0,
      mensaje: "",
    }),
  ];
}

async function scrapeApifyLinkedInPosts(query, remoteOnly, limit) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];

  const searchQueries = buildApifyPostQueries(query, remoteOnly);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/harvestapi~linkedin-post-search/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchQueries,
          maxItems: limit * searchQueries.length,
          maxPosts: limit,
          scrapeReactions: false,
          postNestedReactions: false,
          scrapeComments: false,
          postNestedComments: false,
          proxy: { useApifyProxy: true },
        }),
      }
    );
    if (!response.ok) throw new Error(`Apify ${response.status}`);
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data.items || data.results || [];
    return rows
      .map((row) => normalizeApifyPost(row))
      .filter(Boolean)
      .slice(0, limit)
      .map(scoreJob);
  } catch (error) {
    console.warn("Apify LinkedIn Posts fallo:", error.message);
    return [];
  }
}

function buildApifyPostQueries(query, remoteOnly) {
  const base = cleanText(query)
    .replace(/\b(vacante|buscamos|estamos buscando|se busca)\b/gi, "")
    .trim();
  const remote = remoteOnly ? "remoto" : "";
  return [
    `vacante UX ${remote} Colombia`,
    `vacante UX Research ${remote} Colombia`,
    `buscamos UX Researcher ${remote} LATAM`,
    `UX Engineer ${remote} Colombia`,
    `ingeniero UX ${remote} LATAM`,
    `buscamos UX ${remote} Colombia`,
    `product designer ${remote} LATAM`,
    `UX UI ${remote} LATAM`,
    base ? `${base} ${remote} Colombia` : "",
  ]
    .map((q) => cleanText(q).slice(0, 85))
    .filter(Boolean)
    .filter((q, index, arr) => arr.indexOf(q) === index);
}

function normalizeApifyPost(row) {
  const text = cleanText(
    row.text ||
    row.postText ||
    row.content ||
    row.description ||
    row.commentary ||
    row.caption ||
    row.snippet ||
    ""
  );
  const title = inferPostTitle(row.title || row.headline || text, text);
  const url = row.url || row.postUrl || row.linkedinUrl || row.link || row.inputUrl || "";
  const author =
    row.authorName ||
    row.author?.name ||
    row.profileName ||
    row.actorName ||
    row.companyName ||
    inferAuthorFromLinkedInTitle(row.title || "");
  const combined = `${title} ${text}`;
  const postedAt = row.postedAt || row.date || row.createdAt || row.publishedAt || row.postedDate || "";
  if (!url || !looksLikeJobPost(combined) || isTooOld(postedAt, combined) || requiresAdvancedEnglish(combined) || !isSpanishText(combined)) return null;

  const emails = [...new Set(combined.match(EMAIL_RE) || [])];
  return {
    id: `apify-linkedin-post-${hash(url)}`,
    titulo: title,
    empresa: cleanText(author) || "No especificada",
    fuente: "LinkedIn Posts",
    fuentePrioridad: "primaria",
    url,
    ubicacion: inferPrimaryLocation(combined),
    remoto: inferRemote(combined),
    idioma: "español",
    salario: extractSalary(combined),
    contacto: emails[0] || inferContact(combined) || "No especificado",
    canal: emails[0] ? "correo" : "LinkedIn",
    categoria: "empleo",
    prioridad: "media",
    señalesIA: extractAiSignals(combined),
    resumen: summarize(combined),
    fechaPublicacion: normalizeDateLabel(postedAt, combined),
    score: 0,
    mensaje: "",
  };
}

async function scrapeGoogleXrayJobs(query, remoteOnly, limit) {
  const searchText = [
    "(site:linkedin.com/posts OR site:linkedin.com/jobs OR site:computrabajo.com OR site:magneto365.com OR site:elempleo.com OR site:getonbrd.com)",
    '("vacante" OR "buscamos" OR "estamos buscando" OR "se busca")',
    `(${expandRoleQuery(query)})`,
    remoteOnly ? "(remoto OR remote OR Colombia OR LATAM)" : "(Colombia OR LATAM)",
  ].join(" ");
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchText)}&hl=es-419&gl=co&tbs=qdr:m2`;
  try {
    const html = await fetchText(searchUrl);
    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();
    $("a").each((_, el) => {
      if (items.length >= limit) return false;
      const rawHref = $(el).attr("href") || "";
      const url = normalizeGoogleUrl(rawHref);
      if (!url || seen.has(url) || isBadUrl(url)) return;
      const title = cleanText($(el).text());
      const block = cleanText($(el).closest("div").text());
      const combined = `${title} ${block}`;
      if (isBadTitle(title) || !looksLikeJobPost(combined) || isTooOld("", combined) || requiresAdvancedEnglish(combined) || !isSpanishText(combined)) return;
      seen.add(url);
      const emails = [...new Set(combined.match(EMAIL_RE) || [])];
      items.push(scoreJob({
        id: `google-xray-${hash(url)}`,
        titulo: inferPostTitle(title, block),
        empresa: inferAuthorFromLinkedInTitle(title) || "No especificada",
        fuente: "Google X-ray",
        fuentePrioridad: "secundaria",
        url,
        ubicacion: inferPrimaryLocation(combined),
        remoto: inferRemote(combined),
        idioma: isSpanishText(combined) ? "español" : "no especificado",
        salario: extractSalary(combined),
        contacto: emails[0] || inferContact(combined) || "No especificado",
        canal: emails[0] ? "correo" : inferChannelFromUrl(url),
        categoria: looksLikeOpportunity(combined) ? "lead comercial" : "empleo",
        prioridad: "media",
        señalesIA: extractAiSignals(combined),
        resumen: summarize(combined),
        score: 0,
        mensaje: "",
      }));
    });
    return items;
  } catch (error) {
    console.warn("Google X-ray fallo:", error.message);
    return [];
  }
}

async function scrapeLinkedInPosts(query, remoteOnly, limit) {
  const searchText = [
    "site:linkedin.com/posts",
    POST_QUERY_TERMS,
    `(${query})`,
    remoteOnly ? "(remoto OR remote OR LATAM OR Colombia)" : "(Colombia OR LATAM OR UX)",
  ].join(" ");
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchText)}&setlang=es-CO&cc=co`;
  const html = await fetchText(searchUrl);
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $("li.b_algo, .b_algo").each((_, el) => {
    if (items.length >= limit) return false;
    const link = $(el).find("h2 a, a").first();
    const rawUrl = link.attr("href");
    const url = normalizeSearchUrl(rawUrl);
    if (!url || seen.has(url) || !/linkedin\.com\/posts\//i.test(url)) return;

    const title = cleanText(link.text());
    const snippet = cleanText($(el).find(".b_caption p, p").first().text());
    const combined = `${title} ${snippet}`;
    if (isBadTitle(title) || !looksLikeJobPost(combined) || !isSpanishText(combined)) return;

    seen.add(url);
    const emails = [...new Set(combined.match(EMAIL_RE) || [])];
    const author = inferAuthorFromLinkedInTitle(title);
    items.push({
      id: `linkedin-post-${hash(url)}`,
      titulo: inferPostTitle(title, snippet),
      empresa: author || "No especificada",
      fuente: "LinkedIn Posts",
      fuentePrioridad: "primaria",
      url,
      ubicacion: inferPrimaryLocation(combined),
      remoto: inferRemote(combined),
      idioma: "español",
      salario: extractSalary(combined),
      contacto: emails[0] || inferContact(combined) || "No especificado",
      canal: emails[0] ? "correo" : "LinkedIn",
      categoria: "empleo",
      prioridad: "media",
      señalesIA: extractAiSignals(combined),
      resumen: summarize(combined),
      score: 0,
      mensaje: "",
    });
  });

  const detailed = await enrichWithDetails(items);
  return detailed.map(scoreJob);
}

async function scrapeSource(source, query, remoteOnly, limit) {
  const searchUrl = source.buildUrl(query, remoteOnly);
  const html = await fetchText(searchUrl);
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $(source.linkSelector).each((_, el) => {
    if (items.length >= limit) return false;
    const href = $(el).attr("href");
    const url = absolutize(href, source.baseUrl);
    if (!url || seen.has(url) || isBadUrl(url)) return;
    seen.add(url);

    const card = $(el).closest("article, li, div");
    const title = cleanText(
      card.find(source.titleSelector).first().text() || $(el).text()
    );
    const cardText = cleanText(card.text());
    if (isBadTitle(title) || !looksRelevant(`${title} ${cardText}`) || !isSpanishText(`${title} ${cardText}`)) return;

    items.push({
      id: `${source.key}-${hash(url)}`,
      titulo: title,
      empresa: cleanText(card.find(source.companySelector).first().text()) || "No especificada",
      fuente: source.name,
      fuentePrioridad: source.key === "linkedin" ? "primaria" : "secundaria",
      url,
      ubicacion: cleanText(card.find(source.locationSelector).first().text()) || "No especificada",
      remoto: inferRemote(`${title} ${cardText}`),
      idioma: "español",
      salario: extractSalary(cardText),
      contacto: "No especificado",
      canal: source.key === "linkedin" ? "LinkedIn" : "plataforma",
      categoria: "empleo",
      prioridad: "media",
      señalesIA: extractAiSignals(cardText),
      resumen: "Oferta encontrada en fuente pública",
      score: 0,
    });
  });

  const detailed = await enrichWithDetails(items);
  return detailed.map(scoreJob);
}

async function enrichWithDetails(items) {
  const limited = items.slice(0, 8);
  return Promise.all(
    limited.map(async (item) => {
      try {
        const html = await fetchText(item.url);
        const $ = cheerio.load(html);
        $("script, style, noscript, svg").remove();
        const text = cleanText($("body").text());
        const emails = [...new Set(text.match(EMAIL_RE) || [])];
        const contacto = emails[0] || inferContact(text) || item.contacto;
        return {
          ...item,
          contacto,
          canal: emails[0] ? "correo" : item.canal,
          remoto: item.remoto === "no especificado" ? inferRemote(text) : item.remoto,
          salario: item.salario !== "No especificado" ? item.salario : extractSalary(text),
          señalesIA: [...new Set([...item.señalesIA, ...extractAiSignals(text)])].slice(0, 3),
          resumen: summarize(text),
        };
      } catch (e) {
        return item;
      }
    })
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "es-CO,es;q=0.9,en;q=0.6",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function scoreJob(job) {
  let score = 25;
  if (job.remoto === "remoto") score += 25;
  if (job.idioma === "español") score += 20;
  if (isTargetRole(`${job.titulo} ${job.resumen}`)) score += 15;
  if (job.señalesIA.length) score += 10;
  if (hasDirectContact(job.contacto)) score += 10;
  if (isPrimaryRegion(job)) score += 20;
  else score -= 20;
  if (job.fuente === "LinkedIn" || job.fuente === "LinkedIn Posts") score += 10;
  if (job.fechaPublicacion && /meses|month/i.test(job.fechaPublicacion)) score -= 25;
  if (requiresAdvancedEnglish(`${job.titulo} ${job.resumen}`)) score -= 35;
  const finalScore = Math.min(100, score);
  return {
    ...job,
    regionPrioridad: isPrimaryRegion(job) ? "Colombia/LATAM" : "secundaria",
    prioridad: finalScore >= 80 ? "alta" : finalScore >= 60 ? "media" : "baja",
    score: finalScore,
    mensaje: buildMessage(job),
  };
}

function buildMessage(job) {
  const company = job.empresa || "tu equipo";
  return `Hola, vi la oportunidad de ${job.titulo} en ${company}. Mi enfoque combina UX/UI, producto digital e IA aplicada cuando aporta valor. Me gustaría postularme y compartir portafolio y hoja de vida.`;
}

function hasDirectContact(contacto) {
  return Boolean(contacto && contacto !== "No especificado" && /@|correo|email|dm|mensaje/i.test(contacto));
}

function isPrimaryRegion(job) {
  const text = `${job.ubicacion || ""} ${job.resumen || ""} ${job.url || ""}`.toLowerCase();
  return /colombia|bogot|medell|cali|latam|latin america|américa latina|america latina|remoto|remote/.test(text);
}

function comparePriority(a, b) {
  const linkedInDelta = Number(isLinkedInSource(b)) - Number(isLinkedInSource(a));
  if (linkedInDelta) return linkedInDelta;
  const manualDelta = Number(Boolean(b.entradaManual)) - Number(Boolean(a.entradaManual));
  if (manualDelta) return manualDelta;
  const postDelta = Number(b.fuente === "LinkedIn Posts") - Number(a.fuente === "LinkedIn Posts");
  if (postDelta) return postDelta;
  const regionDelta = Number(isPrimaryRegion(b)) - Number(isPrimaryRegion(a));
  if (regionDelta) return regionDelta;
  return b.score - a.score;
}

function isLinkedInSource(job) {
  return job.fuente === "LinkedIn" || job.fuente === "LinkedIn Posts";
}

function inferContact(text) {
  if (/enviar|manda|envía|postula|aplica/i.test(text) && /cv|hoja de vida|portafolio/i.test(text)) {
    return "Aplicar por la plataforma o mensaje indicado en la publicación";
  }
  if (/dm|mensaje directo|inbox/i.test(text)) return "DM o mensaje directo";
  return "";
}

function inferChannelFromUrl(url) {
  if (/linkedin\.com/i.test(url)) return "LinkedIn";
  return "plataforma";
}

function inferRemote(text) {
  if (/remoto|remote|desde casa|home office|teletrabajo/i.test(text)) return "remoto";
  if (/híbrido|hybrid|mixto/i.test(text)) return "híbrido";
  if (/presencial|onsite/i.test(text)) return "presencial";
  return "no especificado";
}

function extractSalary(text) {
  const match = cleanText(text).match(/(?:COP|USD|\$)\s?[\d.,]{4,}(?:\s?(?:-|a|hasta)\s?(?:COP|USD|\$)?\s?[\d.,]{4,})?(?:\s?(?:M|millones|mensual|mes|hora))?/i);
  return match ? match[0] : "No especificado";
}

function extractAiSignals(text) {
  const signals = [];
  const pairs = [
    [/inteligencia artificial| IA\b/i, "IA"],
    [/machine learning| ML\b/i, "ML"],
    [/generative ai|genai|ia generativa/i, "IA generativa"],
    [/prompt/i, "prompts"],
  ];
  for (const [re, label] of pairs) {
    if (re.test(text)) signals.push(label);
  }
  return signals;
}

function summarize(text) {
  const clean = cleanText(text);
  const sentence = clean.split(/[.!?]/).find((part) => /ux|ui|product|producto|diseño|remoto/i.test(part));
  return cleanText(sentence || clean).slice(0, 140) || "Oferta encontrada en fuente pública";
}

function looksLikeJobPost(text) {
  return isTargetRole(text) &&
    /(buscamos|vacante|estamos buscando|se busca|contratando|hiring|oportunidad|postula|cv|hoja de vida|portafolio)/i.test(text);
}

function looksLikeOpportunity(text) {
  return /(consultor[ií]a|agencia|partner|aliado|rediseñ|mejorar la ux|usabilidad|conversi[oó]n|retenci[oó]n|curso|aprender)/i.test(text);
}

function inferPostTitle(title, snippet) {
  const text = `${title} ${snippet}`;
  const match = text.match(/\b(UX\/UI|UX UI|UX|UI|Product Designer|Product Manager|Diseñador(?:a)? de producto|UX Researcher|UX Research|Investigador(?:a)? UX|UX Engineer|Ingeniero(?:a)? UX|AI UX Engineer)[^.,;|]{0,60}/i);
  return cleanText(match?.[0] || title.replace(/\s*\|\s*LinkedIn.*$/i, "")).slice(0, 120);
}

function inferAuthorFromLinkedInTitle(title) {
  return cleanText(title.split("|")[0].replace(/\s+on LinkedIn.*$/i, "")).slice(0, 90);
}

function inferPrimaryLocation(text) {
  if (/colombia|bogot[aá]|medell[ií]n|cali/i.test(text)) return "Colombia";
  if (/latam|latin america|am[eé]rica latina/i.test(text)) return "LATAM";
  if (/remoto|remote/i.test(text)) return "Remoto";
  return "No especificada";
}

function looksRelevant(text) {
  return isTargetRole(text);
}

function isTargetRole(text) {
  return /\b(ux|ui|product\s+designer|product\s+manager|producto|designer|diseñador|diseñadora|ux\s+research|ux\s+researcher|investigador(?:a)?\s+ux|ux\s+engineer|ingeniero(?:a)?\s+ux|ai\s+ux\s+engineer|ia\s+ux|researcher)\b/i.test(text);
}

function expandRoleQuery(query) {
  return [
    query,
    '"UX Research"',
    '"UX Researcher"',
    '"Investigador UX"',
    '"UX Engineer"',
    '"Ingeniero UX"',
    '"Product Designer"',
    '"UX UI"',
  ].join(" OR ");
}

function isSpanishText(text) {
  const clean = cleanText(text).toLowerCase();
  if (/[а-яё]/i.test(clean)) return false;
  if (/\b(vaga|vagas|estamos contratando|candidatar|curr[ií]culo|portugu[eê]s|brasil|remota para brasil)\b/i.test(clean)) return false;
  const spanishHits = (clean.match(/\b(remoto|vacante|buscamos|estamos buscando|se busca|diseñ|producto|experiencia|postula|hoja de vida|portafolio|colombia|latam|español|contratando|oportunidad|habilidades|requisitos)\b/gi) || []).length;
  const englishHits = (clean.match(/\b(we are hiring|apply now|required skills|english only|fluent english|responsibilities|requirements)\b/gi) || []).length;
  return spanishHits >= 1 && englishHits <= spanishHits + 1;
}

function isTooOld(dateValue, text = "") {
  const label = normalizeDateLabel(dateValue, text).toLowerCase();
  const months = label.match(/(\d+)\s*(?:meses|months?)/i);
  if (months && Number(months[1]) >= 3) return true;
  const years = /año|year/.test(label);
  if (years) return true;
  const parsed = getDateTimestamp(dateValue);
  if (!Number.isNaN(parsed)) {
    const ageDays = (Date.now() - parsed) / 86400000;
    return ageDays > MAX_RESULT_AGE_DAYS;
  }
  return false;
}

function normalizeDateLabel(dateValue, text = "") {
  const raw = cleanText(formatDateValue(dateValue));
  if (raw) return raw;
  const match = cleanText(text).match(/(?:hace|ago)\s+\d+\s+(?:minutos?|horas?|d[ií]as?|semanas?|meses|months?|days?|weeks?)/i);
  return match ? match[0] : "";
}

function formatDateValue(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return value.postedAgoText || value.postedAgoShort || value.date || value.timestamp || "";
  }
  return "";
}

function getDateTimestamp(value) {
  if (!value) return NaN;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  if (typeof value === "object") {
    if (typeof value.timestamp === "number") return value.timestamp;
    if (value.date) return Date.parse(value.date);
  }
  return NaN;
}

function requiresAdvancedEnglish(text) {
  return /\b(C1|C2|B2)\s+English\b|\badvanced\s+english\b|\bingl[eé]s\s+(avanzado|fluido|c1|c2|b2)\b/i.test(text);
}

function isBadUrl(url) {
  return /whatsapp\.com|facebook\.com|twitter\.com|linkedin\.com\/share|linkedin\.com\/pulse|empleos-por-|\/trabajo-de-[^/]+$|\/search\/?$/i.test(url);
}

function isBadTitle(title) {
  return !title ||
    /whatsapp|empleos por|ofertas de empleo|trabajos por|buscar empleos|iniciar sesión|registrarse/i.test(title) ||
    /^(asesor|asesor\/a|conductor|conductor\/a|auxiliar|operario|vendedor|cajero)/i.test(title);
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.titulo}|${job.empresa}|${job.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function slugify(text) {
  return cleanText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function firstKeyword(text) {
  return slugify(text).split("-").find(Boolean) || "ux";
}

function absolutize(href, baseUrl) {
  if (!href || href.startsWith("javascript:") || href.startsWith("#")) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch (e) {
    return "";
  }
}

function normalizeSearchUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("bing.com") && parsed.searchParams.get("u")) {
      return normalizeSearchUrl(parsed.searchParams.get("u"));
    }
    return parsed.toString();
  } catch (e) {
    return "";
  }
}

function normalizeGoogleUrl(rawHref) {
  if (!rawHref) return "";
  if (rawHref.startsWith("/url?")) {
    try {
      return new URL(`https://www.google.com${rawHref}`).searchParams.get("q") || "";
    } catch (e) {
      return "";
    }
  }
  if (/^https?:\/\//i.test(rawHref)) return rawHref;
  return "";
}

function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value.toString(36);
}
