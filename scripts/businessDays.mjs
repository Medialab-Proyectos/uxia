// Días hábiles Colombia: excluye fines de semana y festivos (incluye ley Emiliani, que corre varios
// festivos al lunes siguiente, y los basados en Pascua). nextBusinessDayCO(iso) devuelve el mismo
// día si es hábil, o el siguiente día hábil. Se usa para que las fechas propuestas por el MD nunca
// caigan en sábado, domingo o festivo.

function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function nextMonday(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const add = day === 1 ? 0 : (8 - day) % 7; // si ya es lunes, queda; si no, al lunes siguiente
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}
const isoOf = (d) => d.toISOString().slice(0, 10);

function holidaysCO(year) {
  const set = new Set();
  const addFixed = (mo, da) => set.add(isoOf(new Date(Date.UTC(year, mo - 1, da))));
  // Festivos de fecha fija
  for (const [mo, da] of [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]]) addFixed(mo, da);
  // Festivos que se corren al lunes siguiente (ley Emiliani)
  for (const [mo, da] of [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]]) {
    set.add(isoOf(nextMonday(new Date(Date.UTC(year, mo - 1, da)))));
  }
  // Basados en la Pascua
  const easter = easterSunday(year);
  const plus = (n) => { const d = new Date(easter); d.setUTCDate(d.getUTCDate() + n); return d; };
  set.add(isoOf(plus(-3))); // Jueves Santo
  set.add(isoOf(plus(-2))); // Viernes Santo
  set.add(isoOf(nextMonday(plus(43)))); // Ascensión
  set.add(isoOf(nextMonday(plus(64)))); // Corpus Christi
  set.add(isoOf(nextMonday(plus(71)))); // Sagrado Corazón
  return set;
}

const holCache = {};
const holFor = (year) => (holCache[year] = holCache[year] || holidaysCO(year));

export function isBusinessDayCO(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) return true;
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;                 // fin de semana
  return !holFor(d.getUTCFullYear()).has(isoDate);           // festivo
}

export function nextBusinessDayCO(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) return isoDate;
  const d = new Date(`${isoDate}T00:00:00Z`);
  for (let i = 0; i < 14; i++) {
    const cur = isoOf(d);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && !holFor(d.getUTCFullYear()).has(cur)) return cur;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return isoOf(d);
}
