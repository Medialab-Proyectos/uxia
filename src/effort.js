// Valor de un punto de diseño POR TIPO de tarea. Los designPoints (1/2/4) miden complejidad, pero
// 1 punto no cuesta las mismas horas en todos los tipos: un punto de UX Research pesa mucho más que
// uno de Apoyo. Este factor (horas-por-punto, relativo a Diseño UX/UI = 1.0) convierte los puntos a
// una unidad común ("puntos UX-equivalentes") para que carga, velocidad y utilización sean comparables.
// Ajustable: si el equipo cambia el peso real de un tipo, se toca solo esta tabla.
export const CATEGORY_WEIGHT = {
  "UX Research": 1.5,            // más pesado (entrevistas, síntesis, hallazgos)
  "Desarrollo de software": 1.25,
  "Diseño UX/UI": 1.0,          // base
  "Producto": 1.0,
  "Documentación": 0.9,        // redacción de docs/specs: metódica, esfuerzo medio
  "Diseño gráfico": 0.8,
  "Gestión de proyecto": 0.6,
  "Apoyo": 0.5,                 // más liviano
};

export function categoryWeight(category) {
  const w = CATEGORY_WEIGHT[category];
  return w != null ? w : 1.0; // tipos sin factor definido cuentan como base
}

// Esfuerzo efectivo en puntos UX-equivalentes = complejidad (designPoints) × factor del tipo.
export function effortPoints(designPoints, category) {
  const p = Number(designPoints);
  if (!Number.isFinite(p)) return 0;
  return p * categoryWeight(category);
}
