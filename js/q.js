// Números racionales exactos: evitan errores de redondeo en soluciones y distractores.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

export class Q {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('Denominador cero');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
    if (Object.is(this.n, -0)) this.n = 0;
  }
  static of(x) { return x instanceof Q ? x : new Q(x); }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); if (o.n === 0) throw new Error('División entre cero'); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(Math.abs(this.n), this.d); }
  eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
  cmp(o) { o = Q.of(o); return this.n * o.d - o.n * this.d; }
  get sign() { return Math.sign(this.n); }
  get isZero() { return this.n === 0; }
  get isInt() { return this.d === 1; }
  get value() { return this.n / this.d; }
  key() { return `${this.n}/${this.d}`; }
}

export const q = (n, d = 1) => new Q(n, d);
