// Expresiones lineales en x, y con aritmética exacta: construcción, LaTeX y forma lineal.
import { Q, q } from './q.js';
export { Q, q };

export const N = (v) => ({ k: 'n', v: Q.of(v) });
export const X = { k: 'v', n: 'x' };
export const Y = { k: 'v', n: 'y' };
export const V = (n) => ({ k: 'v', n });
export const sum = (...t) => ({ k: 'sum', t: t.flat().filter(Boolean) });
export const mul = (c, e) => ({ k: 'mul', c: Q.of(c), e });
export const div = (e, d) => ({ k: 'div', e, d: Q.of(d) });
export const eq = (L, R) => ({ L, R });

// Forma lineal {x, y, c}
const Z = () => ({ x: q(0), y: q(0), c: q(0) });
const addL = (A, B) => ({ x: A.x.add(B.x), y: A.y.add(B.y), c: A.c.add(B.c) });
const scaleL = (A, k) => ({ x: A.x.mul(k), y: A.y.mul(k), c: A.c.mul(k) });
export function lin(e) {
  switch (e.k) {
    case 'n': return { x: q(0), y: q(0), c: e.v };
    case 'v': return { ...Z(), [e.n]: q(1) };
    case 'sum': return e.t.reduce((a, t) => addL(a, lin(t)), Z());
    case 'mul': return scaleL(lin(e.e), e.c);
    case 'div': return scaleL(lin(e.e), q(1).div(e.d));
    case 'lin': return { x: e.x, y: e.y, c: e.c };
  }
  throw new Error('nodo ' + e.k);
}
// Ecuación → a x + b y = c (todo a la izquierda salvo constante)
export function eqLin(E) {
  const L = lin(E.L), R = lin(E.R);
  return { a: L.x.sub(R.x), b: L.y.sub(R.y), c: R.c.sub(L.c) };
}
export const holdsAt = (E, x, y) => { const f = eqLin(E); return f.a.mul(x).add(f.b.mul(y)).eq(f.c); };
// Clave canónica de la recta (equivalencia por proporcionalidad)
export function eqKey(E) {
  let { a, b, c } = eqLin(E);
  const lead = !a.isZero ? a : !b.isZero ? b : c;
  if (lead.isZero) return '0=0';
  a = a.div(lead); b = b.div(lead); c = c.div(lead);
  if (a.isZero && b.isZero) return 'FALSO';
  return `${a.key()}|${b.key()}|${c.key()}`;
}

// Nodo lineal compacto (para mostrar ax + by + c ordenado)
export const L2 = (x, y, c = 0) => ({ k: 'lin', x: Q.of(x), y: Q.of(y), c: Q.of(c) });
export function linNode(f, order = ['x', 'y', 'c']) {
  const t = [];
  for (const k of order) {
    const v = k === 'c' ? f.c : f[k];
    if (v.isZero) continue;
    t.push(k === 'c' ? N(v) : v.eq(1) ? V(k) : mul(v, V(k)));
  }
  return t.length ? (t.length === 1 ? t[0] : sum(t)) : N(0);
}

// ---------- LaTeX ----------
export function texNum(v, withSign = true) {
  v = Q.of(v);
  const s = v.sign < 0 && withSign ? '-' : '';
  const a = v.abs();
  return s + (a.isInt ? String(a.n) : `\\tfrac{${a.n}}{${a.d}}`);
}
function signOf(e) {
  if (e.k === 'n') return e.v.sign;
  if (e.k === 'mul') return e.c.sign;
  if (e.k === 'lin') return signOf(linNode(e));
  if (e.k === 'sum') return e.t.length ? signOf(e.t[0]) : 1;
  return 1;
}
function absTerm(e) {
  if (e.k === 'n') return N(e.v.abs());
  if (e.k === 'mul') return mul(e.c.abs(), e.e);
  return e;
}
export function tex(e) {
  switch (e.k) {
    case 'n': return texNum(e.v);
    case 'v': return e.n;
    case 'lin': return tex(linNode(e));
    case 'div': return `\\dfrac{${tex(e.e)}}{${texNum(e.d)}}`;
    case 'mul': {
      const inner = e.e.k === 'lin' ? linNode(e.e) : e.e;
      if (inner.k === 'v') {
        if (e.c.eq(1)) return inner.n;
        if (e.c.eq(-1)) return '-' + inner.n;
        return texNum(e.c) + inner.n;
      }
      const needPar = inner.k === 'sum' || (inner.k === 'n' && inner.v.sign < 0) || inner.k === 'mul';
      const body = needPar ? `(${tex(inner)})` : tex(inner);
      if (e.c.eq(1)) return body;
      if (e.c.eq(-1)) return '-' + (needPar ? body : `(${body})`);
      if (inner.k === 'n') return `${texNum(e.c)}\\cdot ${body}`;
      if (inner.k === 'div') return `${texNum(e.c)}\\cdot ${body}`;
      return texNum(e.c) + body;
    }
    case 'sum': {
      const terms = e.t.map((t) => (t.k === 'lin' ? linNode(t) : t)).flatMap((t) => (t.k === 'sum' ? t.t : [t]));
      if (!terms.length) return '0';
      let s = tex(terms[0]);
      for (const t of terms.slice(1)) s += signOf(t) < 0 ? ` - ${tex(absTerm(t))}` : ` + ${tex(t)}`;
      return s;
    }
  }
  throw new Error('tex ' + e.k);
}
export const texEq = (E) => `${tex(E.L)} = ${tex(E.R)}`;

// Ecuación en forma estándar a x + b y = c
export const stdEq = (a, b, c) => eq(linNode({ x: Q.of(a), y: Q.of(b), c: q(0) }), N(c));
export const eqFromLin = (f) => stdEq(f.a, f.b, f.c);
