// Verifica que lo que se MUESTRA (LaTeX) diga lo mismo que la matemática interna.
// Convierte el LaTeX de cada línea en una expresión numérica y la evalúa.
// Detecta, por ejemplo, "3·1" escrito como "31" o paréntesis faltantes.
import { generate, mulberry32, METHODS, LEVELS } from '../js/gen.js';
import { lin } from '../js/expr.js';

const N = Number(process.argv[2] || 600);
let fails = 0, checked = 0;
const seen = new Map();
const fail = (m, ctx) => { fails++; const k = m.slice(0, 40); seen.set(k, (seen.get(k) || 0) + 1); if (seen.get(k) <= 3) console.log('FALLO:', m, '\n   ', ctx); };

function texToJs(t) {
  let s = t.replace(/\\cdot/g, '*').replace(/\\left|\\right/g, '').replace(/\\[;,!]|\\quad/g, ' ').replace(/\\checkmark/g, '');
  // fracciones anidadas: primero las internas
  let prev;
  do { prev = s; s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))'); } while (s !== prev);
  if (/[{}\\]/.test(s)) return null; // algo que no sabemos traducir
  s = s.replace(/−/g, '-').replace(/\\cdot/g, '*').replace(/·/g, '*');
  // multiplicación implícita: 2x, 2(…), )(, x(…), )x
  s = s.replace(/([0-9xy)])\s*(?=[(xy])/g, '$1*');
  return s;
}
const val = (js, x, y) => Function('x', 'y', `return (${js});`)(x, y);
const at = (f, x, y) => f.x.value * x + f.y.value * y + f.c.value;

function checkLine(line, sol, ctx, ok) {
  if (!line || line.kind !== 'eq' || !line.E) return;
  const parts = line.tex.split('=');
  if (parts.length > 2 && !ok) return; // un distractor de cadena es falso a propósito
  const js = parts.map(texToJs);
  if (js.some((p) => p === null)) return fail('no traducible: ' + line.tex, ctx);
  checked++;
  if (parts.length === 2) {
    // cada lado mostrado debe coincidir con su lado interno en varios puntos
    const L = lin(line.E.L), R = lin(line.E.R);
    for (const [x, y] of [[1.7, -2.3], [-3.1, 0.6], [2, 5]]) {
      const a = val(js[0], x, y), b = val(js[1], x, y);
      if (Math.abs(a - at(L, x, y)) > 1e-7 || Math.abs(b - at(R, x, y)) > 1e-7) return fail('lo mostrado no coincide con lo calculado: ' + line.tex, ctx);
    }
  } else {
    // "x = expresión = valor": todas las partes deben valer lo mismo en la solución
    const x = sol ? sol.x.value : 0, y = sol ? sol.y.value : 0;
    const v = js.map((p) => val(p, x, y));
    if (v.some((w) => Math.abs(w - v[0]) > 1e-7)) return fail(`cadena incoherente (${v.map((n) => +n.toFixed(4)).join(' | ')}): ` + line.tex, ctx);
  }
}
function walk(steps, sol, ctx) {
  for (const st of steps) {
    if (st.kind === 'decide') { st.choices.forEach((c) => walk(c.steps, sol, ctx)); continue; }
    if (st.options) for (const o of st.options) checkLine(o.line, sol, ctx + ' | ' + (o.ok ? 'correcta' : 'distractor'), o.ok);
  }
}
for (const m of METHODS) for (const lv of LEVELS) {
  const rng = mulberry32(99 + m.length * 7 + lv.length);
  for (let i = 0; i < N; i++) {
    const ex = generate(m, lv, { rng });
    const s = ex.s, sol = s.singular || (m === 'cramer' && lv === 'desde0') ? null : { x: s.x0, y: s.y0 };
    walk(ex.steps, sol, `${m}/${lv} ${ex.key}`);
    if (ex.second) walk([ex.second.root], { x: ex.second.s.x0, y: ex.second.s.y0 }, `${m}/${lv} 2º`);
  }
}
console.log(`líneas verificadas: ${checked}`);
console.log(fails ? `${fails} fallos` : 'Todo lo mostrado coincide con lo calculado');
process.exit(fails ? 1 : 0);
