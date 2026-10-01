// Generador de sistemas 2×2 y de procedimientos paso a paso para los cuatro métodos.
// Principio: el sistema se construye a partir de su solución; cada paso correcto se
// verifica y cada distractor se descarta si es equivalente a la línea correcta.
import { Q, q, N, V, sum, mul, div, eq, lin, eqLin, eqKey, holdsAt, linNode, tex, texEq, texNum, stdEq } from './expr.js';

// ---------- azar ----------
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mkR = (rng) => ({
  rng,
  int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
  pick: (a) => a[Math.floor(rng() * a.length)],
  chance: (p) => rng() < p,
  nz(a, b) { let v = 0; while (v === 0) v = a + Math.floor(rng() * (b - a + 1)); return v; },
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
});
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const plain = (v) => { v = Q.of(v); return (v.sign < 0 ? '−' : '') + (v.abs().isInt ? v.abs().n : `${v.abs().n}/${v.abs().d}`); };

// ---------- líneas ----------
export const eqLine = (E) => ({ kind: 'eq', E, tex: texEq(E), key: 'E:' + eqKey(E) });
export const pairLine = (E1, E2) => ({ kind: 'pair', eqs: [E1, E2], tex: `\\begin{aligned} ${tex(E1.L)} &= ${tex(E1.R)} \\\\ ${tex(E2.L)} &= ${tex(E2.R)} \\end{aligned}`, key: 'P:' + [eqKey(E1), eqKey(E2)].join('#') });
export const setLine = (x, y) => ({ kind: 'set', x: Q.of(x), y: Q.of(y), tex: `S = \\{(${texNum(x)},\\ ${texNum(y)})\\}`, key: `S:${Q.of(x).key()},${Q.of(y).key()}` });
export const textLine = (id, text) => ({ kind: 'text', text, tex: `\\text{${text}}`, key: 'T:' + id });
const valEq = (v, val) => eq(V(v), N(val));

function makeStep(R, correct, cands, o = {}) {
  const seen = new Set([correct.tex]);
  const ok = [];
  for (const c of R.shuffle(cands)) {
    if (!c || !c.line) continue;
    if (seen.has(c.line.tex) || c.line.key === correct.key) continue;
    seen.add(c.line.tex); ok.push(c);
  }
  // se prefieren errores que además no cumple la solución (el error "se nota")
  if (o.sol) ok.sort((a, b) => lineHolds(b.line, o.sol) - lineHolds(a.line, o.sol));
  const picked = ok.slice(0, o.max ?? 3);
  const options = R.shuffle([{ line: correct, ok: true }, ...picked.map((c) => ({ line: c.line, ok: false, fb: c.fb }))]);
  return { kind: 'choose', prompt: o.prompt, line: correct, options, hints: o.hints || [], fx: o.fx, focus: o.focus, id: o.id };
}
export function lineHolds(line, sol) {
  if (!sol) return 0;
  if (line.kind === 'eq') return line.E && holdsAt(line.E, sol.x, sol.y) ? 1 : 0;
  if (line.kind === 'pair') return line.eqs.every((E) => holdsAt(E, sol.x, sol.y)) ? 1 : 0;
  if (line.kind === 'set') return line.x.eq(sol.x) && line.y.eq(sol.y) ? 1 : 0;
  return 0;
}
const partialHint = (E) => `Empieza así: $${tex(E.L)} = \\;\\ldots$`;

// ---------- ecuación de una incógnita como listas de términos ----------
// término: {t:'var',k} | {t:'num',k} | {t:'grp',k,a,c,d} = k·(a·v + c)/d | {t:'prod',k,n} = k·n
function termsOf(e, v, out = [], s = q(1)) {
  switch (e.k) {
    case 'n': out.push({ t: 'num', k: e.v.mul(s) }); break;
    case 'v': out.push({ t: 'var', k: s }); break;
    case 'sum': e.t.forEach((t) => termsOf(t, v, out, s)); break;
    case 'lin': termsOf(linNode(e), v, out, s); break;
    case 'mul': {
      const inner = e.e.k === 'lin' ? linNode(e.e) : e.e;
      if (inner.k === 'n') out.push({ t: 'prod', k: e.c.mul(s), n: inner.v });
      else if (inner.k === 'v') out.push({ t: 'var', k: e.c.mul(s) });
      else if (inner.k === 'sum') { const f = lin(inner); out.push({ t: 'grp', k: e.c.mul(s), a: f[v], c: f.c, d: q(1), o: inner }); }
      else if (inner.k === 'div') { const f = lin(inner.e); out.push({ t: 'grp', k: e.c.mul(s), a: f[v], c: f.c, d: inner.d, o: inner.e }); }
      else if (inner.k === 'mul') termsOf(inner, v, out, s.mul(e.c));
      break;
    }
    case 'div': { const f = lin(e.e); out.push({ t: 'grp', k: s, a: f[v], c: f.c, d: e.d, o: e.e }); break; }
  }
  return out;
}
function termNode(t, v) {
  if (t.t === 'var') return t.k.eq(1) ? V(v) : mul(t.k, V(v));
  if (t.t === 'num') return N(t.k);
  if (t.t === 'prod') return mul(t.k, N(t.n));
  const inner = t.o || linNode({ x: q(0), y: q(0), [v]: t.a, c: t.c }, t.c.sign < 0 || t.a.sign > 0 ? [v, 'c'] : ['c', v]);
  const body = t.d.eq(1) ? inner : div(inner, t.d);
  return t.k.eq(1) ? (t.d.eq(1) ? mul(1, inner) : body) : mul(t.k, body);
}
const sideNode = (ts, v) => (ts.length ? (ts.length === 1 ? termNode(ts[0], v) : sum(ts.map((t) => termNode(t, v)))) : N(0));
const E1v = (Lt, Rt, v) => eq(sideNode(Lt, v), sideNode(Rt, v));
const has = (ts, f) => ts.some(f);

// Resuelve una ecuación lineal en v, paso a paso, con distractores de errores reales.
export function chain(R, E, v, sol, o = {}) {
  let L = termsOf(E.L, v), Rt = termsOf(E.R, v);
  const steps = [];
  const push = (nL, nR, cands, hints, prompt) => {
    const cor = eqLine(E1v(nL, nR, v));
    const neg = (t) => ({ ...t, k: t.k.neg() });
    if (nR.some((t) => !t.k.isZero)) cands.push([nL, nR.map(neg), 'Revisa los signos del segundo miembro.']);
    const iv = nL.findIndex((t) => t.t === 'var');
    if (iv >= 0) cands.push([nL.map((t, i) => (i === iv ? neg(t) : t)), nR, 'Revisa el signo del término con la incógnita.']);
    steps.push(makeStep(R, cor, cands.filter(Boolean).map((c) => ({ line: eqLine(E1v(c[0], c[1], v)), fb: c[2] })), { hints, sol, prompt, focus: 'last' }));
    L = nL; Rt = nR;
  };
  const all = () => [...L, ...Rt];
  // 1. calcular productos numéricos
  if (has(all(), (t) => t.t === 'prod')) {
    const ev = (ts, f) => ts.map((t) => (t.t === 'prod' ? { t: 'num', k: f(t) } : t));
    const nL = ev(L, (t) => t.k.mul(t.n)), nR = ev(Rt, (t) => t.k.mul(t.n));
    push(nL, nR, [
      [ev(L, (t) => t.k.mul(t.n).neg()), ev(Rt, (t) => t.k.mul(t.n).neg()), 'Revisa el signo del producto.'],
      all().every((t) => t.t !== 'prod' || !t.k.add(t.n).isZero) ? [ev(L, (t) => t.k.add(t.n)), ev(Rt, (t) => t.k.add(t.n)), 'Es un producto, no una suma.'] : null,
    ], ['Primero calcula las multiplicaciones con números.', 'Mira los productos con paréntesis.', 'Multiplica el coeficiente por el valor.', partialHint(E1v(nL, nR, v))]);
  }
  // 2. quitar denominadores
  const dens = all().flatMap((t) => (t.t === 'grp' ? [t.d.abs().n, t.k.d] : [t.k.d])).filter((d) => d > 1);
  if (dens.length) {
    const m = dens.reduce((a, b) => lcm(a, b), 1);
    const sc = (ts, only) => ts.map((t) => {
      if (only && !(t.t === 'grp' && !t.d.eq(1)) && t.k.isInt) return t;
      if (t.t === 'grp') { const f = t.k.mul(m).div(t.d); return { ...t, k: f, d: q(1) }; }
      return { ...t, k: t.k.mul(m) };
    }).flatMap((t) => {
      if (t.t !== 'grp' || !t.k.eq(1) || !t.d.eq(1)) return [t];
      const o = [];
      const first = t.o && t.o.k === 'sum' && t.o.t[0].k === 'n' ? 'c' : 'v';
      const vt = { t: 'var', k: t.a }, nt = { t: 'num', k: t.c };
      if (first === 'c') { if (!t.c.isZero) o.push(nt); if (!t.a.isZero) o.push(vt); } else { if (!t.a.isZero) o.push(vt); if (!t.c.isZero) o.push(nt); }
      return o;
    });
    const nL = sc(L), nR = sc(Rt);
    push(nL, nR, [
      [sc(L, true), sc(Rt, true), 'Multiplica todos los términos, no solo la fracción.'],
      [nL, Rt, 'Multiplica también el otro miembro.'],
      [L.map((t) => (t.t === 'grp' ? { ...t, d: q(1) } : t)), Rt.map((t) => (t.t === 'grp' ? { ...t, d: q(1) } : t)), 'Quitar el denominador exige multiplicar toda la ecuación.'],
    ], ['Para quitar fracciones, multiplica toda la ecuación por el mismo número.', 'Mira los denominadores.', `Multiplica ambos miembros por ${m}.`, partialHint(E1v(nL, nR, v))]);
  }
  // 3. distribuir paréntesis
  if (has(all(), (t) => t.t === 'grp')) {
    const ex = (ts, mode) => ts.flatMap((t) => {
      if (t.t !== 'grp') return [t];
      const va = t.k.mul(t.a), vc = t.k.mul(t.c);
      const out = [];
      const first = t.o && t.o.k === 'sum' && t.o.t[0].k === 'n' ? 'c' : 'v';
      const vt = { t: 'var', k: mode === 'one' && first !== 'v' ? t.a : va };
      const nt = { t: 'num', k: mode === 'one' && first !== 'c' ? t.c : mode === 'sign' ? vc.neg() : vc };
      if (first === 'c') { if (!t.c.isZero) out.push(nt); if (!t.a.isZero) out.push(vt); } else { if (!t.a.isZero) out.push(vt); if (!t.c.isZero) out.push(nt); }
      return out;
    });
    const nL = ex(L), nR = ex(Rt);
    const kk = all().find((t) => t.t === 'grp').k;
    push(nL, nR, [
      [ex(L, 'one'), ex(Rt, 'one'), `El ${plain(kk)} multiplica a los dos términos del paréntesis.`],
      [ex(L, 'sign'), ex(Rt, 'sign'), 'Revisa el signo al multiplicar.'],
    ], ['Distribuye: el número de afuera multiplica a cada término de adentro.', 'Mira el paréntesis.', `Multiplica ${plain(kk)} por cada término.`, partialHint(E1v(nL, nR, v))]);
  }
  // 4. transponer y reducir
  const coef = () => L.filter((t) => t.t === 'var').reduce((a, t) => a.add(t.k), q(0)).sub(Rt.filter((t) => t.t === 'var').reduce((a, t) => a.add(t.k), q(0)));
  const cons = () => Rt.filter((t) => t.t === 'num').reduce((a, t) => a.add(t.k), q(0)).sub(L.filter((t) => t.t === 'num').reduce((a, t) => a.add(t.k), q(0)));
  const simple = L.length === 1 && L[0].t === 'var' && Rt.length === 1 && Rt[0].t === 'num';
  if (!simple) {
    const A = coef(), C = cons();
    if (A.isZero) throw new Error('coeficiente nulo');
    const oneLeft = L.length === 2 && L.filter((t) => t.t === 'var').length === 1 && Rt.length === 1 && Rt[0].t === 'num' && L.filter((t) => t.t === 'num').length === 1;
    if (oneLeft) {
      const B = L.find((t) => t.t === 'num').k, vk = L.find((t) => t.t === 'var').k, r = Rt[0].k;
      push([{ t: 'var', k: vk }], [{ t: 'num', k: r.sub(B) }], [
        [[{ t: 'var', k: vk }], [{ t: 'num', k: r.add(B) }], B.sign > 0 ? `El ${plain(B)} estaba sumando: pasa restando.` : `El ${plain(B.abs())} estaba restando: pasa sumando.`],
        [[{ t: 'var', k: vk }], [{ t: 'num', k: r }], 'El número no desaparece: pasa al otro miembro.'],
        [[{ t: 'var', k: vk }], [{ t: 'num', k: r.sub(B).neg() }], 'Revisa la operación con signos.'],
      ], ['Deja sola la incógnita: el número pasa al otro miembro.', 'Mira el término sin incógnita.', 'Pasa el número con la operación contraria.', `Empieza así: $${tex(termNode({ t: 'var', k: vk }, v))} = \\;\\ldots$`]);
    } else {
      // (a) transponer sin reducir
      const moveL = [...L.filter((t) => t.t === 'var'), ...Rt.filter((t) => t.t === 'var').map((t) => ({ ...t, k: t.k.neg() }))];
      const moveR = [...Rt.filter((t) => t.t === 'num'), ...L.filter((t) => t.t === 'num').map((t) => ({ ...t, k: t.k.neg() }))];
      const needTranspose = moveL.length + moveR.length > 2 && (Rt.some((t) => t.t === 'var') || L.filter((t) => t.t === 'num').length > 0);
      if (needTranspose) {
        const badL = [...L.filter((t) => t.t === 'var'), ...Rt.filter((t) => t.t === 'var')];
        const badR = [...Rt.filter((t) => t.t === 'num'), ...L.filter((t) => t.t === 'num')];
        push(moveL, moveR, [
          [badL, moveR, 'El término con la incógnita cambia de signo al pasar.'],
          [moveL, badR, 'El número cambia de signo al pasar al otro miembro.'],
          [moveL, moveR.map((t) => ({ ...t, k: t.k.neg() })), 'Revisa los signos de los números.'],
          [moveL.map((t) => ({ ...t, k: t.k.neg() })), moveR, 'Revisa los signos de los términos con la incógnita.'],
        ], ['Agrupa: términos con la incógnita a un lado, números al otro.', 'Mira qué términos están en el lado equivocado.', 'Cada término que cambia de lado cambia de signo.', partialHint(E1v(moveL, moveR, v))]);
      }
      // (b) reducir términos semejantes
      const A2 = coef(), C2 = cons();
      const vs = L.filter((t) => t.t === 'var');
      const absSum = vs.reduce((a, t) => a.add(t.k.abs()), q(0));
      const wrongA = !absSum.eq(A2) ? absSum : vs.length > 1 ? vs[0].k.sub(vs[1].k) : A2.add(1);
      push([{ t: 'var', k: A2 }], [{ t: 'num', k: C2 }], [
        [[{ t: 'var', k: wrongA.isZero ? A2.add(1) : wrongA }], [{ t: 'num', k: C2 }], 'Suma los coeficientes con sus signos.'],
        [[{ t: 'var', k: A2 }], [{ t: 'num', k: C2.neg() }], 'Revisa los signos de los números.'],
        [[{ t: 'var', k: A2.neg() }], [{ t: 'num', k: C2 }], 'Revisa el signo del coeficiente.'],
      ], ['Reduce términos semejantes.', 'Junta los términos con la misma incógnita.', 'Suma los coeficientes y suma los números.', `Empieza así: $${tex(termNode({ t: 'var', k: A2 }, v))} = \\;\\ldots$`]);
    }
  }
  // 5. dividir
  const A = L[0].k, C = Rt[0].k;
  const val = C.div(A);
  if (!A.eq(1)) {
    const cands = [[[{ t: 'var', k: q(1) }], [{ t: 'num', k: val.neg() }], A.sign > 0 ? 'Dividir entre un positivo no cambia el signo.' : 'Al dividir entre un negativo, el signo cambia.']];
    if (!C.isZero) cands.push([[{ t: 'var', k: q(1) }], [{ t: 'num', k: A.div(C) }], 'Divide el número entre el coeficiente, no al revés.']);
    if (!A.abs().eq(1)) cands.push([[{ t: 'var', k: q(1) }], [{ t: 'num', k: C.sub(A) }], 'El coeficiente multiplica: pasa dividiendo.'], [[{ t: 'var', k: q(1) }], [{ t: 'num', k: C.mul(A) }], 'Pasa dividiendo, no multiplicando.']);
    push([{ t: 'var', k: q(1) }], [{ t: 'num', k: val }], cands, ['Despeja: divide entre el coeficiente.', `Mira el número que multiplica a ${v}.`, `Divide ambos miembros entre ${plain(A)}.`, `Empieza así: $${v} = \\;\\ldots$`]);
  }
  return { steps, value: val };
}

// ---------- sistemas ----------
function denomPick(R, level, method) {
  if (level === 'bajo' || level === 'desde0') return 1;
  if (level === 'medio') return R.chance(0.25) ? R.pick([2, 3]) : 1;
  return R.chance(0.35) ? R.pick([2, 3, 4, 5]) : 1;
}
export function makeSystem(R, level, method, opts = {}) {
  const coefRange = { desde0: [1, 3], bajo: [1, 4], medio: [1, 6], alto: [1, 9] }[level];
  const negP = { desde0: 0.1, bajo: 0.2, medio: 0.45, alto: 0.5 }[level];
  const needUnit = (method === 'sustitucion' || method === 'igualacion') && (level !== 'alto' || R.chance(0.6));
  for (let t = 0; t < 2000; t++) {
    const co = () => { const v = R.int(coefRange[0], coefRange[1]); return R.chance(negP) ? -v : v; };
    let [a, b, c, d] = [co(), co(), co(), co()];
    if (level === 'desde0' || (level === 'bajo' && R.chance(0.5))) { if (R.chance(0.5)) c = 1; else d = R.pick([1, -1]); }
    if (needUnit && ![a, b, c, d].some((k) => Math.abs(k) === 1)) continue;
    if (method === 'eliminacion' && level === 'bajo' && R.chance(0.45)) { c = -a; }
    const D = a * d - b * c;
    if (D === 0) continue;
    if ((a === c && b === d) || (a === -c && b === -d)) continue;
    const den = opts.integer ? 1 : denomPick(R, level, method);
    const span = { desde0: 4, bajo: 6, medio: 8, alto: 10 }[level];
    const x0 = new Q(R.int(-span * den, span * den), den), y0 = new Q(R.int(-span * den, span * den), den);
    if (den > 1 && x0.isInt && y0.isInt) continue;
    const e = x0.mul(a).add(y0.mul(b)), f = x0.mul(c).add(y0.mul(d));
    if (!e.isInt || !f.isInt) continue;
    const lim = { desde0: 15, bajo: 24, medio: 45, alto: 90 }[level];
    if (Math.abs(e.value) > lim || Math.abs(f.value) > lim) continue;
    if (x0.isZero || y0.isZero || e.isZero || f.isZero) continue;
    return { a: q(a), b: q(b), e, c: q(c), d: q(d), f, x0, y0 };
  }
  throw new Error('sin sistema');
}
// Sistema con D = 0 (Cramer Alto): incompatible o compatible indeterminado
function makeSingular(R) {
  const a = R.nz(-5, 5), b = R.nz(-5, 5), k = R.pick([2, 3, -2]);
  const e = R.nz(-12, 12); // e ≠ 0: si no, Dₓ y Dᵧ tendrían una columna de ceros
  const dependent = R.chance(0.4);
  const f = dependent ? e * k : e * k + R.nz(-4, 4);
  return { a: q(a), b: q(b), e: q(e), c: q(a * k), d: q(b * k), f: q(f), singular: dependent ? 'dependiente' : 'incompatible' };
}
export const sysEqs = (s) => [stdEq(s.a, s.b, s.e), stdEq(s.c, s.d, s.f)];
export const sysKey = (s) => [s.a, s.b, s.e, s.c, s.d, s.f].map((v) => v.key()).join(';');

const other = (v) => (v === 'x' ? 'y' : 'x');
const coefOf = (s, i, v) => (i === 0 ? (v === 'x' ? s.a : s.b) : (v === 'x' ? s.c : s.d));
const rhsOf = (s, i) => (i === 0 ? s.e : s.f);

// despeje de v en la ecuación i: v = (rhs − cu·u)/cv
function despeje(s, i, v) {
  const u = other(v), cv = coefOf(s, i, v), cu = coefOf(s, i, u), r = rhsOf(s, i);
  const make = (kc, ku, den) => {
    // numerador ku·u + kc; si den = ±1 se simplifica
    let nu = { x: q(0), y: q(0), c: kc }; nu[u] = ku;
    if (den.abs().eq(1)) {
      nu = { x: nu.x.div(den), y: nu.y.div(den), c: nu.c.div(den) };
      return linNode(nu, nu[u].sign < 0 && !nu.c.isZero ? ['c', u] : [u, 'c']);
    }
    if (den.sign < 0) { nu = { x: nu.x.neg(), y: nu.y.neg(), c: nu.c.neg() }; den = den.neg(); }
    return div(linNode(nu, nu[u].sign < 0 && !nu.c.isZero ? ['c', u] : [u, 'c']), den);
  };
  const expr = make(r, cu.neg(), cv);
  const E = eq(V(v), expr);
  const cands = [
    { line: eqLine(eq(V(v), make(r, cu, cv))), fb: 'Al pasar al otro miembro, el término cambia de signo.' },
    { line: eqLine(eq(V(v), make(r.neg(), cu.neg(), cv))), fb: 'Solo cambia de signo lo que pasa de miembro.' },
    { line: eqLine(eq(V(v), make(r.neg(), cu, cv))), fb: 'El número de la derecha no cambia de signo: no se movió.' },
  ];
  if (!cv.abs().eq(1)) {
    cands.push({ line: eqLine(eq(V(v), make(r, cu.neg(), q(1)))), fb: `Falta dividir entre ${plain(cv)}.` });
    let nu = { x: q(0), y: q(0), c: r.div(cv) }; nu[u] = cu.neg();
    cands.push({ line: eqLine(eq(V(v), linNode(nu, [u, 'c']))), fb: 'Divide los dos términos, no solo uno.' });
  } else if (cv.eq(-1)) {
    let nu = { x: q(0), y: q(0), c: r }; nu[u] = cu.neg();
    cands.push({ line: eqLine(eq(V(v), linNode(nu, nu[u].sign < 0 ? ['c', u] : [u, 'c']))), fb: `Si −${v} = …, cambia el signo de todo.` });
  }
  return { E, expr, cands };
}

// sustituir v = expr en la ecuación j
function substituted(s, j, v, expr) {
  const u = other(v), cv = coefOf(s, j, v), cu = coefOf(s, j, u);
  const tv = cv.eq(1) ? mul(1, expr) : mul(cv, expr);
  const tu = cu.eq(1) ? V(u) : mul(cu, V(u));
  const L = v === 'x' ? sum(tv, cu.isZero ? null : tu) : sum(cu.isZero ? null : tu, tv);
  return eq(L, N(rhsOf(s, j)));
}

function finalSet(R, sol) {
  const c = setLine(sol.x, sol.y);
  const cands = [
    { line: setLine(sol.y, sol.x), fb: 'El orden es (x, y).' },
    { line: setLine(sol.x.neg(), sol.y), fb: 'Revisa el signo de x.' },
    { line: setLine(sol.x, sol.y.neg()), fb: 'Revisa el signo de y.' },
    { line: setLine(sol.x.neg(), sol.y.neg()), fb: 'Revisa los signos.' },
    { line: setLine(sol.y.neg(), sol.x.neg()), fb: 'El orden es (x, y) y con sus signos.' },
  ];
  return makeStep(R, c, cands, { prompt: 'Escribe la solución', hints: ['La solución es un par ordenado (x, y).', 'Mira los valores que encontraste.', 'Primero x, luego y.', `Empieza así: $S = \\{(${texNum(sol.x)},\\ \\ldots)\\}$`], sol, focus: 'last' });
}

// volver a sustituir un valor en un despeje: v = EXPR(u) con u = val
function backSub(R, v, expr, u, uval, sol) {
  const target = v === 'x' ? sol.x : sol.y;
  const f = lin(expr.k === 'div' ? expr : expr);
  const at = (w) => f[u].mul(w).add(f.c);
  const shown = texSubst(expr, u, uval);
  const mk = (val) => ({ kind: 'eq', E: valEq(v, val), tex: `${v} = ${shown} = ${texNum(val)}`, key: 'E:' + eqKey(valEq(v, val)) });
  const cands = [
    { line: mk(at(uval.neg())), fb: `Reemplaza ${u} con su signo: ${u} = ${plain(uval)}.` },
    { line: mk(f[u].mul(uval)), fb: 'Suma también el número del despeje.' },
    { line: mk(f[u].mul(uval).neg().add(f.c)), fb: `Respeta el signo que acompaña a ${u}.` },
    { line: mk(target.neg()), fb: 'Revisa los signos.' },
  ].map((c) => (c.line.key === 'E:' + eqKey(valEq(v, target)) ? null : c)).filter(Boolean);
  return makeStep(R, mk(target), cands, { prompt: `Halla ${v}`, hints: [`Sustituye ${u} en el despeje de ${v}.`, `Mira el despeje de ${v}.`, `Reemplaza ${u} por ${plain(uval)} y calcula.`, `Empieza así: $${v} = ${shown}$`], sol, fx: 'backsub', focus: 'last' });
}
function texSubst(node, u, val) {
  // entero: paréntesis normales (sin espacio extra); fracción: paréntesis que se estiran
  const par = (x) => (x.isInt ? `(${texNum(x)})` : `\\left(${texNum(x)}\\right)`);
  const wrap = (x) => (x.sign < 0 || !x.isInt ? par(x) : texNum(x));
  const walk = (e) => {
    switch (e.k) {
      case 'n': return texNum(e.v);
      case 'v': return e.n === u ? wrap(val) : e.n;
      case 'lin': return walk(linNode(e));
      case 'sum': { let s = walk(e.t[0]); for (const t of e.t.slice(1)) { const neg = (t.k === 'n' && t.v.sign < 0) || (t.k === 'mul' && t.c.sign < 0); const tt = neg ? (t.k === 'n' ? N(t.v.abs()) : mul(t.c.abs(), t.e)) : t; s += (neg ? ' - ' : ' + ') + walk(tt); } return s; }
      case 'mul': { const inner = e.e.k === 'lin' ? linNode(e.e) : e.e; if (inner.k === 'v' && inner.n === u) return e.c.eq(1) ? wrap(val) : (e.c.eq(-1) ? '-' : texNum(e.c)) + par(val); return tex(e); }
      case 'div': return `\\dfrac{${walk(e.e)}}{${texNum(e.d)}}`;
    }
    return tex(e);
  };
  return walk(node);
}

// ---------- métodos ----------
const H = {
  choose: ['Cualquier elección válida funciona. Conviene la incógnita con coeficiente 1 o −1.', 'Busca un coeficiente 1 o −1.', 'Elige esa incógnita y esa ecuación.', 'Si eliges otra, aparecerán fracciones.'],
};

function methodSustitucion(R, s, level) {
  const sol = { x: s.x0, y: s.y0 };
  const choices = [];
  for (const i of [0, 1]) for (const v of ['x', 'y']) {
    const cv = coefOf(s, i, v);
    if (cv.isZero) continue;
    const u = other(v), j = 1 - i;
    const d = despeje(s, i, v);
    const st1 = makeStep(R, eqLine(d.E), d.cands, { prompt: `Despeja ${v} de (${i + 1})`, sol, focus: { eq: i }, hints: [`Despejar es dejar sola a ${v}.`, `Mira la ecuación (${i + 1}).`, `Pasa ${u} y el número al otro miembro${cv.abs().eq(1) ? '' : ` y divide entre ${plain(cv)}`}.`, partialHint(d.E)] });
    const subE = substituted(s, j, v, d.expr);
    const sameE = substituted(s, i, v, d.expr);
    const cands = [{ line: eqLine(sameE), fb: 'Sustituye en la otra ecuación.' }];
    // sin paréntesis
    const cvj = coefOf(s, j, v);
    if (!cvj.abs().eq(1) && d.expr.k === 'sum') {
      const [t0, ...rest] = d.expr.t;
      const L = sum(mul(cvj, t0), ...rest, coefOf(s, j, u).isZero ? null : mul(coefOf(s, j, u), V(u)));
      cands.push({ line: eqLine(eq(L, N(rhsOf(s, j)))), fb: `Usa paréntesis: el ${plain(cvj)} multiplica a toda la expresión.` });
    }
    {
      const cuj = coefOf(s, j, u);
      const Lw = v === 'x' ? sum(cvj.eq(1) ? V(v) : mul(cvj, V(v)), cuj.eq(1) ? mul(1, d.expr) : mul(cuj, d.expr)) : sum(cuj.eq(1) ? mul(1, d.expr) : mul(cuj, d.expr), cvj.eq(1) ? V(v) : mul(cvj, V(v)));
      cands.push({ line: eqLine(eq(Lw, N(rhsOf(s, j)))), fb: `La expresión reemplaza a ${v}, no a ${u}.` });
      if (cvj.eq(-1) && d.expr.k === 'sum') {
        const [t0, ...rest] = d.expr.t;
        const L = sum(mul(-1, t0), ...rest, cuj.isZero ? null : mul(cuj, V(u)));
        cands.push({ line: eqLine(eq(L, N(rhsOf(s, j)))), fb: 'El signo menos afecta a toda la expresión.' });
      }
    }
    const base = d.expr.k === 'div' ? d.expr.e : d.expr;
    const flipped = lin(base); const fl = { x: flipped.x, y: flipped.y, c: flipped.c.neg() };
    const flNode = linNode(fl, fl[u].sign < 0 ? ['c', u] : [u, 'c']);
    if (!fl.c.isZero) cands.push({ line: eqLine(substituted(s, j, v, d.expr.k === 'div' ? div(flNode, d.expr.d) : flNode)), fb: 'Copia la expresión con sus signos.' });
    const st2 = makeStep(R, eqLine(subE), cands, { prompt: `Sustituye ${v} en (${j + 1})`, sol, fx: { type: 'substitute', chip: tex(d.expr), v, eq: j }, focus: { eq: j }, hints: ['Reemplaza la incógnita despejada por su expresión.', `Mira dónde aparece ${v} en (${j + 1}).`, `Escribe la expresión de ${v} entre paréntesis en (${j + 1}).`, partialHint(subE)] });
    const ch = chain(R, subE, u, sol);
    const uval = ch.value;
    const st3 = backSub(R, v, d.expr, u, uval, sol);
    const note = cv.abs().eq(1) ? null : 'Funciona, pero habrá fracciones.';
    choices.push({ id: `${v}${i + 1}`, label: `${v} de (${i + 1})`, ok: true, note, eq: i, v, steps: [st1, st2, ...ch.steps, st3, finalSet(R, sol)] });
  }
  return { kind: 'decide', prompt: '¿Qué incógnita despejas y de qué ecuación?', choices, hints: H.choose };
}

function methodIgualacion(R, s, level) {
  const sol = { x: s.x0, y: s.y0 };
  const choices = [];
  for (const v of ['x', 'y']) {
    if (coefOf(s, 0, v).isZero || coefOf(s, 1, v).isZero) continue;
    const u = other(v);
    const d1 = despeje(s, 0, v), d2 = despeje(s, 1, v);
    const st1 = makeStep(R, eqLine(d1.E), d1.cands, { prompt: `Despeja ${v} de (1)`, sol, focus: { eq: 0 }, fx: { type: 'side', side: 'left' }, hints: [`Despeja ${v} en cada ecuación.`, 'Mira la ecuación (1).', `Pasa ${u} y el número al otro miembro.`, partialHint(d1.E)] });
    const st2 = makeStep(R, eqLine(d2.E), d2.cands, { prompt: `Despeja ${v} de (2)`, sol, focus: { eq: 1 }, fx: { type: 'side', side: 'right' }, hints: [`Ahora despeja la misma incógnita, ${v}, en (2).`, 'Mira la ecuación (2).', `Pasa ${u} y el número al otro miembro.`, partialHint(d2.E)] });
    const mE = eq(d1.expr, d2.expr);
    // distractores con la misma forma que el despeje (fracción si la hay)
    const num = (e) => lin(e.k === 'div' ? e.e : e);
    const wrap = (e, f) => { const n = linNode(f, f[u].sign < 0 && !f.c.isZero ? ['c', u] : [u, 'c']); return e.k === 'div' ? div(n, e.d) : n; };
    const n1 = num(d1.expr), n2 = num(d2.expr);
    const flip = (f, a, b) => ({ x: a ? f.x.neg() : f.x, y: a ? f.y.neg() : f.y, c: b ? f.c.neg() : f.c });
    const cands = [
      { line: eqLine(eq(d1.expr, wrap(d2.expr, flip(n2, true, true)))), fb: 'Se igualan tal cual: no cambies signos.' },
      { line: eqLine(eq(d1.expr, wrap(d2.expr, flip(n2, false, true)))), fb: 'Copia cada despeje con sus signos.' },
      { line: eqLine(eq(d1.expr, wrap(d2.expr, flip(n2, true, false)))), fb: 'Copia cada despeje con sus signos.' },
      { line: eqLine(eq(wrap(d1.expr, flip(n1, false, true)), d2.expr)), fb: 'Copia cada despeje con sus signos.' },
      { line: eqLine(eq(wrap(d1.expr, flip(n1, true, false)), d2.expr)), fb: 'Copia cada despeje con sus signos.' },
    ];
    const st3 = makeStep(R, eqLine(mE), cands, { prompt: 'Iguala las dos expresiones', sol, fx: { type: 'merge', left: tex(d1.expr), right: tex(d2.expr), v }, hints: [`Si las dos son iguales a ${v}, son iguales entre sí.`, `Mira los dos despejes de ${v}.`, 'Escribe: expresión de (1) = expresión de (2).', partialHint(mE)] });
    const ch = chain(R, mE, u, sol);
    const st4 = backSub(R, v, d1.expr, u, ch.value, sol);
    const note = coefOf(s, 0, v).abs().eq(1) && coefOf(s, 1, v).abs().eq(1) ? null : 'Funciona, pero habrá fracciones.';
    choices.push({ id: v, label: `Igualar ${v}`, ok: true, note, v, steps: [st1, st2, st3, ...ch.steps, st4, finalSet(R, sol)] });
  }
  return { kind: 'decide', prompt: '¿Qué incógnita igualas?', choices, hints: ['Despejarás la misma incógnita en ambas ecuaciones.', 'Busca coeficientes 1 o −1.', 'Elige la incógnita más fácil de despejar.', 'Si eliges otra, aparecerán fracciones.'] };
}

function methodEliminacion(R, s, level) {
  const sol = s.singular ? null : { x: s.x0, y: s.y0 };
  const choices = [];
  for (const w of ['x', 'y']) {
    const p = coefOf(s, 0, w), r = coefOf(s, 1, w);
    if (p.isZero || r.isZero) continue;
    // Método del cruce: (1) se multiplica por el coeficiente de w de (2) y (2) por el de (1),
    // tal como están (sin simplificar). Luego se cambia el signo de un factor para que queden opuestos.
    const already = p.add(r).isZero;
    const k1 = already ? q(1) : r, k2 = already ? q(1) : p.neg();
    const scaleEq = (i, k) => stdEq(coefOf(s, i, 'x').mul(k), coefOf(s, i, 'y').mul(k), rhsOf(s, i).mul(k));
    const E1 = scaleEq(0, k1), E2 = scaleEq(1, k2);
    const fmtK = (k) => (k.sign < 0 ? `(${texNum(k)})` : texNum(k));
    const steps = [];
    const ALREADY = { kind: 'text', tex: '\\text{Ya son opuestos: sumar directamente}', key: 'K:1,1', k: [q(1), q(1)] };
    const u0 = other(w), pu = coefOf(s, 0, u0), ru = coefOf(s, 1, u0);
    // Las opciones muestran SOLO coeficientes (sin nombres de ecuación), en el orden de arriba hacia abajo.
    const pairTex = (a, b) => `{${texNum(a)}} \\;\\;\\text{y}\\;\\; {${texNum(b)}}`; // llaves: el signo menos queda pegado al número
    const pairLn = (a, b, k, write) => ({ kind: 'text', tex: pairTex(a, b), key: `C:${a.key()},${b.key()}`, k, write });
    const sameNums = (a, b, c, d) => (a.eq(c) && b.eq(d)) || (a.eq(d) && b.eq(c));
    const e1 = rhsOf(s, 0), e2 = rhsOf(s, 1);
    if (!already) {
      // 1) ¿qué coeficientes se cruzan? (solo una pareja, nunca la misma pareja al revés)
      const cand = [
        { a: pu, b: ru, fb: `Esos acompañan a ${u0}. Para eliminar ${w} se cruzan los coeficientes de ${w}.` },
        { a: e1, b: e2, fb: `Esos son los términos independientes. Se cruzan los coeficientes de ${w}.` },
        { a: p, b: ru, fb: `El segundo acompaña a ${u0}: los dos deben ser coeficientes de ${w}.` },
        { a: pu, b: r, fb: `El primero acompaña a ${u0}: los dos deben ser coeficientes de ${w}.` },
        { a: p, b: e2, fb: `El segundo es un término independiente: los dos deben ser coeficientes de ${w}.` },
        { a: e1, b: r, fb: `El primero es un término independiente: los dos deben ser coeficientes de ${w}.` },
        { a: pu, b: e2, fb: `Ninguno acompaña a ${w}. Se cruzan los coeficientes de ${w}.` },
      ].filter((c) => !sameNums(c.a, c.b, p, r));
      const seenPairs = [];
      const cross = [];
      const addAll = (list) => { for (const c of list) { if (sameNums(c.a, c.b, p, r) || seenPairs.some(([a, b]) => sameNums(a, b, c.a, c.b))) continue; seenPairs.push([c.a, c.b]); cross.push({ line: pairLn(c.a, c.b), fb: c.fb }); } };
      addAll(cand);
      // respaldo (solo si hacen falta opciones): tomar los dos números de una misma fila
      if (cross.length < 2) addAll([
        { a: p, b: p, fb: `Se toma un coeficiente de ${w} de cada fila: el de arriba y el de abajo.` },
        { a: r, b: r, fb: `Se toma un coeficiente de ${w} de cada fila: el de arriba y el de abajo.` },
        { a: p, b: pu, fb: `Esos dos son de la misma fila. Se toma el coeficiente de ${w} de arriba y el de abajo.` },
        { a: ru, b: r, fb: `Esos dos son de la misma fila. Se toma el coeficiente de ${w} de arriba y el de abajo.` },
        { a: e1, b: ru, fb: `Ninguno acompaña a ${w}. Se cruzan los coeficientes de ${w}.` },
        { a: pu, b: pu, fb: `Ese número acompaña a ${u0}. Se cruzan los coeficientes de ${w}.` },
      ]);
      steps.push(makeStep(R, pairLn(p, r, [r, p], `\\text{Se cruzan } {${texNum(p)}} \\text{ y } {${texNum(r)}}`), cross, { prompt: `Para eliminar ${w}, ¿qué coeficientes se cruzan?`, fx: { type: 'factors', w }, hints: [`Se cruzan los coeficientes de la incógnita que quieres eliminar: ${w}.`, `Mira el número que acompaña a ${w} arriba y abajo.`, 'Cópialos tal como están, con su signo, de arriba hacia abajo. Si no se ve número, el coeficiente es 1 (o −1).', `Empieza así: $${texNum(p)} \\;\\text{y}\\; \\ldots$`] }));
      // 2) signo: con el cruce tal cual, los dos términos quedan iguales; hay que cambiar un signo
      const prod = p.mul(r);
      // misma pareja y mismo orden que en la pregunta anterior; solo cambia un signo
      const sign = [
        { line: pairLn(p, r), fb: `Sin cambiar signos quedan $${texNum(prod)}${w}$ y $${texNum(prod)}${w}$: iguales, y al sumar no se anulan.` },
        { line: pairLn(p.neg(), r.neg()), fb: `Si cambias los dos signos siguen iguales: $${texNum(prod.neg())}${w}$ y $${texNum(prod.neg())}${w}$.` },
        { line: { kind: 'text', tex: `\\text{Cambio solo el signo del término en } ${w}`, key: 'K:solo' }, fb: 'El signo se cambia al número del cruce, que multiplica toda la fila, no a un solo término.' },
      ];
      steps.push(makeStep(R, pairLn(p.neg(), r, [r, p.neg()], `\\text{Con un signo cambiado: } {${texNum(p.neg())}} \\text{ y } {${texNum(r)}}`), sign, { prompt: `Con el cruce quedan $${texNum(prod)}${w}$ y $${texNum(prod)}${w}$, iguales. ¿Cómo quedan los números del cruce para que sean opuestos?`, fx: { type: 'factors', w, sign: true }, hints: ['Para que se anulen, deben ser opuestos: mismo número y signo contrario.', 'Mira los dos números del cruce.', 'Cambia el signo de uno solo de los dos: el primero.', `Resultado buscado: $${texNum(prod)}${w}$ y $${texNum(prod.neg())}${w}$`] }));
    } else {
      steps.push(makeStep(R, ALREADY, [
        { line: { kind: 'text', tex: `\\text{Cruzar } ${texNum(p)} \\text{ y } ${texNum(r)}`, key: 'K:cruzar' }, fb: 'Ya son opuestos: no hace falta cruzar.' },
        { line: { kind: 'text', tex: '\\text{Cambiar el signo de una fila}', key: 'K:signo' }, fb: 'Si cambias un signo, quedarían iguales y no se anularían.' },
        { line: { kind: 'text', tex: '\\text{Multiplicar las dos filas por 2}', key: 'K:dos' }, fb: 'Ya son opuestos: no hace falta multiplicar.' },
      ], { prompt: `¿Qué haces para eliminar ${w}?`, fx: { type: 'factors', w }, hints: [`Para eliminar ${w}, sus coeficientes deben ser opuestos.`, `Mira $${texNum(p)}${w}$ y $${texNum(r)}${w}$.`, '¿Tienen el mismo número y signo contrario?', 'Si ya son opuestos, se suman directamente.'] }));
    }
    if (!already) {
      const cor = pairLine(E1, E2);
      const onlyL = (i, k) => stdEq(coefOf(s, i, 'x').mul(k), coefOf(s, i, 'y').mul(k), rhsOf(s, i));
      const cand = [];
      if (!k1.eq(1)) cand.push({ line: pairLine(onlyL(0, k1), E2), fb: 'Debes multiplicar ambos miembros.' });
      if (!k2.eq(1)) cand.push({ line: pairLine(E1, onlyL(1, k2)), fb: 'Debes multiplicar ambos miembros.' });
      const other_ = other(w);
      const signSlip = (i, k) => { const ax = coefOf(s, i, 'x').mul(k), ay = coefOf(s, i, 'y').mul(k); return stdEq(w === 'x' ? ax : ax.neg(), w === 'y' ? ay : ay.neg(), rhsOf(s, i).mul(k)); };
      if (!k2.eq(1)) cand.push({ line: pairLine(E1, signSlip(1, k2)), fb: `Multiplica también el término en ${other_} con su signo.` });
      if (!k1.eq(1)) cand.push({ line: pairLine(signSlip(0, k1), E2), fb: `Multiplica también el término en ${other_} con su signo.` });
      const onlyW = (i, k) => stdEq(w === 'x' ? coefOf(s, i, 'x').mul(k) : coefOf(s, i, 'x'), w === 'y' ? coefOf(s, i, 'y').mul(k) : coefOf(s, i, 'y'), rhsOf(s, i).mul(k));
      if (!k2.eq(1)) cand.push({ line: pairLine(E1, onlyW(1, k2)), fb: 'Multiplica todos los términos de la ecuación.' });
      if (!k1.eq(1)) cand.push({ line: pairLine(onlyW(0, k1), E2), fb: 'Multiplica todos los términos de la ecuación.' });
      steps.push(makeStep(R, cor, cand, { prompt: 'Multiplica las ecuaciones', sol, fx: { type: 'rows' }, hints: ['Multiplica cada término de la ecuación, en ambos miembros.', 'Mira el factor de cada fila.', 'Cada coeficiente y el término independiente se multiplican.', `La (1) queda: $${texEq(E1)}$`] }));
    }
    // suma miembro a miembro
    const f1 = eqLin(E1), f2 = eqLin(E2);
    const u = other(w);
    const Au = f1[u === 'x' ? 'a' : 'b'].add(f2[u === 'x' ? 'a' : 'b']), Cs = f1.c.add(f2.c);
    const sumE = u === 'x' ? stdEq(Au, 0, Cs) : stdEq(0, Au, Cs);
    const toE = (A, C) => (u === 'x' ? stdEq(A, 0, C) : stdEq(0, A, C));
    if (Au.isZero) {
      // caso especial (Alto): 0 = C
      const dep = Cs.isZero;
      const cor = textLine(dep ? 'inf' : 'inc', dep ? '0 = 0: infinitas soluciones' : `0 = ${plain(Cs)}: el sistema no tiene solución`);
      steps.push(makeStep(R, cor, [
        { line: textLine(dep ? 'inc' : 'inf', dep ? '0 = 0: el sistema no tiene solución' : `0 = ${plain(Cs)}: infinitas soluciones`), fb: dep ? '0 = 0 siempre se cumple.' : `0 = ${plain(Cs)} nunca se cumple.` },
        { line: setLine(0, 0), fb: 'Desaparecieron las dos incógnitas: no hay un único par.' },
      ], { prompt: 'Suma miembro a miembro', fx: { type: 'cancel', w, both: true }, hints: ['Suma las dos ecuaciones término a término.', 'Mira qué queda después de sumar.', `Si desaparecen ${w} y ${u}, compara los números.`, 'Una igualdad entre números es verdadera o falsa.'] }));
      choices.push({ id: w, label: `Eliminar ${w}`, ok: true, w, steps });
      continue;
    }
    steps.push(makeStep(R, eqLine(sumE), [
      { line: eqLine(toE(Au, f1.c.sub(f2.c))), fb: 'Suma también los términos independientes.' },
      { line: eqLine(toE(f1[u === 'x' ? 'a' : 'b'].sub(f2[u === 'x' ? 'a' : 'b']), Cs)), fb: `Suma los coeficientes de ${u} con sus signos.` },
      { line: eqLine(toE(Au, Cs.neg())), fb: 'Revisa el signo del resultado.' },
      { line: eqLine(toE(Au.neg(), Cs)), fb: `Revisa el signo del coeficiente de ${u}.` },
      f2.c.isZero ? null : { line: eqLine(toE(Au, f1.c)), fb: 'Suma los dos términos independientes.' },
    ].filter(Boolean), { prompt: 'Suma miembro a miembro', sol, fx: { type: 'cancel', w, rows: [texEq(E1), texEq(E2)] }, hints: ['Suma las ecuaciones: izquierda con izquierda, derecha con derecha.', `Mira cómo se anulan los términos en ${w}.`, `Suma los coeficientes de ${u} y los números.`, partialHint(sumE)] }));
    const ch = chain(R, sumE, u, sol);
    steps.push(...ch.steps);
    // volver a sustituir en la ecuación original más sencilla
    const i = Math.abs(coefOf(s, 0, w).value) <= Math.abs(coefOf(s, 1, w).value) ? 0 : 1;
    const uv = ch.value;
    const cw = coefOf(s, i, w), cu = coefOf(s, i, u);
    const tW = cw.eq(1) ? V(w) : mul(cw, V(w));
    const tU = mul(cu, N(uv));
    const back = eq(w === 'x' ? sum(tW, tU) : sum(tU, tW), N(rhsOf(s, i)));
    const wrongBack = eq(w === 'x' ? sum(tW, mul(cu, N(uv.neg()))) : sum(mul(cu, N(uv.neg())), tW), N(rhsOf(s, i)));
    steps.push(makeStep(R, eqLine(back), [
      { line: eqLine(wrongBack), fb: `Reemplaza ${u} = ${plain(uv)} con su signo.` },
      { line: eqLine(eq(w === 'x' ? sum(mul(cw, N(uv)), mul(cu, V(u))) : sum(mul(cu, V(u)), mul(cw, N(uv))), N(rhsOf(s, i)))), fb: `El valor encontrado es de ${u}, no de ${w}.` },
    ], { prompt: `Sustituye ${u} en (${i + 1})`, sol, focus: { eq: i }, fx: 'backsub', hints: [`Ya conoces ${u}: sustitúyelo en una ecuación original.`, `Mira la ecuación (${i + 1}).`, `Reemplaza ${u} por ${plain(uv)}.`, partialHint(back)] }));
    const ch2 = chain(R, back, w, sol);
    steps.push(...ch2.steps, finalSet(R, sol));
    choices.push({ id: w, label: `Eliminar ${w}`, ok: true, w, steps });
  }
  return { kind: 'decide', prompt: '¿Qué incógnita eliminas?', choices, hints: ['Cualquiera sirve. Conviene la que ya tiene coeficientes opuestos o fáciles de igualar.', 'Compara los coeficientes de x y los de y.', 'Elige la incógnita cuyos coeficientes se igualan multiplicando menos.', 'Si ya son opuestos, se suman directamente.'] };
}

// ---------- Cramer ----------
function det(a, b, c, d) { return a.mul(d).sub(b.mul(c)); }
function detStep(R, label, M, prompt) {
  const [a, b, c, d] = M, v = det(a, b, c, d);
  const cands = [
    { v: b.mul(c).sub(a.mul(d)), fb: 'Revisa el orden: ad − bc.' },
    { v: a.mul(d).add(b.mul(c)), fb: 'Es una resta: ad − bc.' },
    { v: a.mul(d).neg().sub(b.mul(c)), fb: 'Revisa el signo del producto a·d.' },
    { v: a.mul(b).sub(c.mul(d)), fb: 'Multiplica en diagonal, no por filas.' },
    { v: a.mul(d), fb: 'Falta restar la otra diagonal.' },
    { v: a.mul(c).sub(b.mul(d)), fb: 'Multiplica en diagonal, no por columnas.' },
  ];
  const mk = (x) => ({ kind: 'eq', tex: `${label} = ${texNum(x)}`, key: `V:${x.key()}`, value: x });
  const step = makeStep(R, mk(v), cands.map((c) => ({ line: mk(c.v), fb: c.fb })), { prompt, hints: ['El determinante es: diagonal principal menos diagonal secundaria.', 'Recorre primero la diagonal que baja a la derecha.', `Calcula ${texNum(a)}·${texNum(d)} y ${texNum(b)}·${texNum(c)}, y réstalos.`, `Empieza así: $${label} = (${texNum(a)})(${texNum(d)}) - \\ldots$`] });
  step.kind = 'det'; step.M = M; step.label = label; step.value = v;
  return step;
}
function cramer(R, s, level) {
  const A = [s.a, s.b, s.c, s.d], B = [s.e, s.f];
  const steps = [];
  steps.push({ kind: 'build', prompt: 'Separa los coeficientes', A, B, hints: ['A guarda los coeficientes de x (columna 1) y de y (columna 2). B, los términos independientes.', 'Mira la casilla iluminada: fila y columna.', 'La fila es la ecuación; la columna es la incógnita.', 'Toca el número de esa ecuación que acompaña a esa incógnita.'] });
  // Orden de la fórmula x = Dₓ / D, y = Dᵧ / D: primero Dₓ, luego Dᵧ y al final D (el que va abajo).
  const D = det(...A);
  const Dx = det(s.e, s.b, s.f, s.d), Dy = det(s.a, s.e, s.c, s.f);
  steps.push({ kind: 'swap', target: 'x', prompt: 'Construye Dₓ', A, B, hints: ['Para Dₓ, los términos independientes reemplazan la columna de x.', 'Mira la columna 1 (la de x).', 'Toca la columna de x y luego B.', 'La columna 1 queda con los números de B.'] });
  steps.push(detStep(R, 'D_x', [s.e, s.b, s.f, s.d], 'Calcula Dₓ'));
  steps.push({ kind: 'swap', target: 'y', prompt: 'Construye Dᵧ', A, B, hints: ['Para Dᵧ, B reemplaza la columna de y.', 'Mira la columna 2 (la de y).', 'Toca la columna de y y luego B.', 'La columna 2 queda con los números de B.'] });
  steps.push(detStep(R, 'D_y', [s.a, s.e, s.c, s.f], 'Calcula Dᵧ'));
  steps.push(detStep(R, 'D', A, 'Calcula D, el determinante del sistema (va abajo en la fórmula)'));
  if (D.isZero) {
    steps.push(makeStep(R, textLine('d0', 'No hay solución única por Cramer'), [
      { line: { kind: 'eq', tex: 'x = \\dfrac{D_x}{0}', key: 'T:div0' }, fb: 'No se puede dividir entre 0.' },
      { line: setLine(0, 0), fb: 'D = 0 no significa que la solución sea (0, 0).' },
      { line: textLine('uno', 'Hay exactamente una solución'), fb: 'Con D = 0 no hay solución única.' },
    ], { prompt: '¿Qué concluyes?', fx: { type: 'd0', singular: s.singular }, hints: ['Cramer divide entre D.', 'Mira el valor de D.', 'Si D = 0, la división no existe.', 'La conclusión es sobre la unicidad de la solución.'] }));
    return steps;
  }
  const x = Dx.div(D), y = Dy.div(D);
  for (const [v, Dv, val] of [['x', 'D_x', x], ['y', 'D_y', y]]) {
    const frac = (n, d) => ({ kind: 'eq', tex: `${v} = \\dfrac{${n}}{${d}}`, key: `F:${n}/${d}` });
    steps.push(makeStep(R, frac(Dv, 'D'), [
      { line: frac('D', Dv), fb: 'El determinante D va siempre abajo.' },
      { line: frac(v === 'x' ? 'D_y' : 'D_x', 'D'), fb: `Para ${v} se usa ${v === 'x' ? 'Dₓ' : 'Dᵧ'}.` },
      { line: frac(Dv, v === 'x' ? 'D_y' : 'D_x'), fb: 'El denominador es D.' },
    ], { prompt: `Forma ${v}`, fx: { type: 'frac', v }, hints: [`${v} = (determinante de ${v}) / D.`, `Mira ${v === 'x' ? 'Dₓ' : 'Dᵧ'} y D.`, `Arriba ${v === 'x' ? 'Dₓ' : 'Dᵧ'}, abajo D.`, `$${v} = \\dfrac{${Dv}}{\\ldots}$`] }));
    const Dval = v === 'x' ? Dx : Dy;
    const mk = (r) => ({ kind: 'eq', E: valEq(v, r), tex: `${v} = \\dfrac{${texNum(Dval)}}{${texNum(D)}} = ${texNum(r)}`, key: 'E:' + eqKey(valEq(v, r)) });
    const cands = [{ r: val.neg(), fb: 'Revisa el signo de la división.' }];
    if (!Dval.isZero) cands.push({ r: D.div(Dval), fb: 'Divide Dᵥ entre D, no al revés.' });
    cands.push({ r: Dval.sub(D), fb: 'Es una división, no una resta.' });
    steps.push(makeStep(R, mk(val), cands.map((c) => ({ line: mk(c.r), fb: c.fb })), { prompt: `Calcula ${v}`, hints: ['Divide y simplifica.', 'Mira los signos del numerador y denominador.', 'Signos iguales dan positivo.', `$${v} = ${texNum(val)}$…`] }));
  }
  steps.push(finalSet(R, { x, y }));
  return steps;
}

// ---------- Desde 0 ----------
function desde0(R, method) {
  const s = makeSystem(R, 'desde0', method === 'cramer' ? 'cramer' : 'sustitucion', { integer: true });
  const steps = [];
  if (method === 'cramer') {
    const m = [q(R.int(1, 9)), q(R.int(1, 9)), q(R.int(1, 9)), q(R.int(1, 9))];
    steps.push({ kind: 'grid', prompt: 'Toca la fila 1', M: m, target: { row: 0 }, hints: ['Una fila es horizontal.', 'Mira de izquierda a derecha.', 'La fila 1 es la de arriba.', 'Toca la fila de arriba.'] });
    steps.push({ kind: 'grid', prompt: 'Toca la columna 2', M: m, target: { col: 1 }, hints: ['Una columna es vertical.', 'Mira de arriba hacia abajo.', 'La columna 2 es la de la derecha.', 'Toca la columna de la derecha.'] });
    steps.push({ kind: 'grid', prompt: 'Toca el número de la fila 2, columna 1', M: m, target: { row: 1, col: 0 }, hints: ['Primero la fila, luego la columna.', 'Fila 2: abajo.', 'Columna 1: izquierda.', 'Abajo a la izquierda.'] });
    steps.push({ kind: 'build', prompt: 'Arma la matriz del sistema', A: [s.a, s.b, s.c, s.d], B: [s.e, s.f], hints: ['Cada ecuación es una fila.', 'Mira la casilla iluminada.', 'Columna 1: coeficientes de x. Columna 2: de y.', 'Toca el número que acompaña a la incógnita de esa columna.'] });
    steps.push(detStep(R, '\\det A', m, 'Calcula el determinante de la primera matriz'));
    return { s: { ...s, a: m[0], b: m[1], c: m[2], d: m[3] }, steps, sysShown: s };
  }
  const E = sysEqs(s);
  steps.push({ kind: 'tap', prompt: 'Toca el coeficiente de x en (1)', eq: 0, target: 'x', hints: ['El coeficiente es el número que multiplica a la incógnita.', 'Mira la ecuación (1).', 'Busca el número pegado a x.', 'Si no se ve número, el coeficiente es 1.'] });
  steps.push({ kind: 'tap', prompt: 'Toca el término independiente de (2)', eq: 1, target: 'c', hints: ['El término independiente no tiene incógnita.', 'Mira la ecuación (2).', 'Está después del signo =.', 'Es el número solo.'] });
  const wrong = { x: s.x0.add(1), y: s.y0 };
  // par que cumple una sola ecuación
  let pair = null;
  for (let t = 0; t < 40 && !pair; t++) {
    const px = s.x0.add(R.nz(-3, 3)), py0 = s.e.sub(s.a.mul(px)).div(s.b);
    if (py0.isInt && !holdsAt(E[1], px, py0)) pair = { x: px, y: py0 };
  }
  pair ||= wrong;
  steps.push({ kind: 'check', prompt: '¿Este par cumple las dos ecuaciones?', pair, answers: E.map((e) => holdsAt(e, pair.x, pair.y)), hints: ['Sustituye x e y en cada ecuación.', 'Mira cada ecuación por separado.', 'Calcula el lado izquierdo y compáralo con el derecho.', 'Solo es solución si cumple las dos.'] });
  steps.push({ kind: 'check', prompt: '¿Y este par?', pair: { x: s.x0, y: s.y0 }, answers: [true, true], hints: ['Sustituye x e y en cada ecuación.', 'Mira cada ecuación por separado.', 'Calcula el lado izquierdo y compáralo con el derecho.', 'Solo es solución si cumple las dos.'] });
  return { s, steps };
}

// ---------- API ----------
export const METHODS = ['sustitucion', 'igualacion', 'eliminacion', 'cramer'];
export const LEVELS = ['desde0', 'bajo', 'medio', 'alto'];
let uid = 0;
export function generate(method, level, { rng = Math.random, recent = new Set() } = {}) {
  const R = mkR(rng);
  for (let t = 0; t < 30; t++) {
    let ex;
    if (level === 'desde0') {
      const d = desde0(R, method);
      ex = { s: d.s, steps: d.steps, sysShown: d.sysShown || d.s };
      if (method !== 'cramer') {
        // tras la intuición, un sistema sencillo resuelto con el método elegido
        const s2 = makeSystem(R, 'desde0', method, { integer: true });
        const body = method === 'sustitucion' ? methodSustitucion(R, s2) : method === 'igualacion' ? methodIgualacion(R, s2) : methodEliminacion(R, s2);
        ex.second = { s: s2, root: body };
      }
    } else {
      let s;
      if (method === 'cramer' && level === 'alto' && R.chance(0.15)) s = makeSingular(R);
      else if (method === 'eliminacion' && level === 'alto' && R.chance(0.12)) s = makeSingular(R);
      else s = makeSystem(R, level, method);
      const root = method === 'sustitucion' ? methodSustitucion(R, s, level) : method === 'igualacion' ? methodIgualacion(R, s, level) : method === 'eliminacion' ? methodEliminacion(R, s, level) : null;
      ex = { s, steps: root ? [root] : cramer(R, s, level) };
    }
    ex.key = sysKey(ex.sysShown || ex.s);
    if (recent.has(ex.key) && t < 29) continue;
    ex.id = ++uid; ex.method = method; ex.level = level;
    ex.eqs = sysEqs(ex.sysShown || ex.s);
    return ex;
  }
}
export { sysEqs as equations };
