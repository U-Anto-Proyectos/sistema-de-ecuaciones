// Verificación masiva: node tests/gen.test.mjs [N]
import { generate, mulberry32, METHODS, LEVELS, lineHolds } from '../js/gen.js';
import { holdsAt } from '../js/expr.js';

const N = Number(process.argv[2] || 2000);
let fails = 0; const seenFail = new Map();
const fail = (msg, ctx) => { fails++; const k = msg.replace(/[-\d]+/g, '#'); seenFail.set(k, (seenFail.get(k) || 0) + 1); if (seenFail.get(k) <= 2) console.log('FALLO:', msg, ctx ? '\n   ' + ctx : ''); };

function walk(steps, sol, ctx, stats) {
  for (const st of steps) {
    stats.steps++;
    if (st.kind === 'decide') {
      if (!st.choices.length) fail('decisión sin opciones', ctx);
      for (const c of st.choices) walk(c.steps, sol, ctx + ' > ' + c.label, stats);
      continue;
    }
    if (st.options) {
      const ok = st.options.filter((o) => o.ok);
      if (ok.length !== 1) fail('no hay exactamente una correcta', ctx + ' | ' + st.prompt);
      if (st.options.length < 3) fail(`solo ${st.options.length} opciones: ${st.prompt}`, ctx + ' | ' + st.line.tex);
      const texs = st.options.map((o) => o.line.tex);
      if (new Set(texs).size !== texs.length) fail('opciones repetidas', ctx);
      for (const o of st.options) {
        if (!o.ok && o.line.key === st.line.key) fail('distractor equivalente', ctx + ' | ' + o.line.tex);
        if (!o.ok && !o.fb) fail('distractor sin retroalimentación', ctx);
        if (!o.ok) { stats.d++; if (sol && lineHolds(o.line, sol)) stats.dTrue++; }
      }
      if (sol && st.line.E && !holdsAt(st.line.E, sol.x, sol.y)) fail('línea correcta falsa en la solución', ctx + ' | ' + st.line.tex);
      if (sol && st.line.kind === 'pair' && !lineHolds(st.line, sol)) fail('par correcto falso', ctx + ' | ' + st.line.tex);
      if (sol && st.line.kind === 'set' && !lineHolds(st.line, sol)) fail('conjunto solución incorrecto', ctx + ' | ' + st.line.tex);
      if (st.hints && st.hints.length !== 4) fail('pistas incompletas', ctx + ' | ' + st.prompt);
    }
    if (st.kind === 'build' && (st.A.length !== 4 || st.B.length !== 2)) fail('build mal formado', ctx);
  }
}

for (const m of METHODS) for (const lv of LEVELS) {
  const rng = mulberry32(7 + m.length * 31 + lv.length);
  const uniq = new Set(); const stats = { steps: 0, d: 0, dTrue: 0 }; let maxC = 0, fr = 0, sing = 0;
  for (let i = 0; i < N; i++) {
    let ex;
    try { ex = generate(m, lv, { rng }); } catch (e) { fail('excepción: ' + e.message, `${m}/${lv}`); continue; }
    uniq.add(ex.key);
    const s = ex.s;
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) maxC = Math.max(maxC, Math.abs(s[k].value));
    if (s.singular) sing++;
    const sol = s.singular ? null : { x: s.x0, y: s.y0 };
    if (sol && lv !== 'desde0' || (sol && m !== 'cramer')) {
      if (sol && !(ex.eqs.every((E) => holdsAt(E, sol.x, sol.y)))) fail('la solución no cumple el sistema', ex.key);
      if (sol && (!sol.x.isInt || !sol.y.isInt)) fr++;
    }
    const ctx = `${m}/${lv} ${ex.key}`;
    walk(ex.steps, lv === 'desde0' && m === 'cramer' ? null : sol, ctx, stats);
    if (ex.second) { const s2 = ex.second.s; walk([ex.second.root], { x: s2.x0, y: s2.y0 }, ctx + ' (2º)', stats); }
  }
  console.log(`${m.padEnd(12)} ${lv.padEnd(7)} únicos ${String(uniq.size).padStart(5)}/${N}  pasos ${(stats.steps / N).toFixed(1)}  distractores que cumplen la solución ${(100 * stats.dTrue / Math.max(1, stats.d)).toFixed(1)}%  máx|coef| ${maxC}  fracc ${fr}  D=0 ${sing}`);
}
if (seenFail.size) console.log('\nResumen de fallos:', Object.fromEntries(seenFail));
console.log(fails ? `\n${fails} fallos` : '\nTodo correcto');
process.exit(fails ? 1 : 0);
