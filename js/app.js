// Sistemas de ecuaciones — interfaz. Motor: gen.js (pasos verificados). Diseño: Figma “Sistemas de ecuaciones — UI”.
import { generate, LEVELS, sysEqs } from './gen.js';
import { Q, texNum, texEq, eqLin } from './expr.js';
import { vignette, PHOTOS, INFO } from './scene.js';

// ---------- utilidades ----------
const LV = { desde0: 'Desde 0', bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const ORDER = ['sustitucion', 'igualacion', 'eliminacion', 'cramer'];
const doc = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => matchMedia('(max-width: 600px)').matches;
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const K = (t) => { try { return window.katex.renderToString(String(t), { throwOnError: false, strict: 'ignore' }); } catch { return String(t); } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = (s) => String(s ?? '').split(/\$([^$]+)\$/).map((p, i) => (i % 2 ? K(p) : esc(p))).join('');
const plainTxt = (s) => String(s ?? '').replace(/\$([^$]+)\$/g, (_, m) => m.replace(/\\[a-z]+/g, ' ').replace(/[{}]/g, ''));
const pl = (v) => { v = Q.of(v); const a = v.abs(); return (v.sign < 0 ? '−' : '') + (a.isInt ? a.n : `${a.n}/${a.d}`); };
const P = (v) => (Q.of(v).sign < 0 || !Q.of(v).isInt ? `\\left(${texNum(v)}\\right)` : texNum(v));
const today = () => new Date().toLocaleDateString('en-CA');
const ROLE = { x: 'coeficiente de x', y: 'coeficiente de y', b: 'término independiente' };

// ---------- estado persistente ----------
const KEY = 'sde.v1';
const DEF = () => ({ xp: 0, streak: 0, best: 0, beans: 0, solved: 0, theme: 'system', sound: false, last: null, lastLv: {}, stats: {}, recent: [], day: '', today: 0 });
let st = load();
function load() { try { return Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return DEF(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* almacenamiento no disponible */ } }
let session = 0;
const exCount = {};
let cur = null; // {method, level}
let run = null; // ejercicio en curso

// ---------- tema, sonido, HUD ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
const THEME_LBL = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
function applyTheme() {
  doc.dataset.theme = st.theme === 'system' ? (mq.matches ? 'dark' : 'light') : st.theme;
  const l = THEME_LBL[st.theme];
  $('#themeLbl').textContent = l;
  $('#chipTheme').setAttribute('aria-label', `Tema: ${l}. Cambiar tema`);
  $('#setTheme').textContent = `Tema: ${l}`;
}
mq.addEventListener?.('change', applyTheme);
function cycleTheme() { st.theme = { system: 'light', light: 'dark', dark: 'system' }[st.theme]; save(); applyTheme(); }

let ac = null;
function tone(notes, { type = 'sine', gain = 0.045, len = 0.14, gap = 0.07 } = {}) {
  if (!st.sound) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime + 0.01;
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * gap;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len + 0.03);
    });
  } catch { /* sin audio */ }
}
const SND = {
  ok: () => tone([659, 880]),
  bad: () => tone([247], { type: 'triangle', gain: 0.03, len: 0.2 }),
  tap: () => tone([523], { gain: 0.025, len: 0.08 }),
  done: () => tone([523, 659, 784, 1047], { gap: 0.09, len: 0.32 }),
};
function applySound() {
  $('#soundLbl').textContent = st.sound ? 'Sonido' : 'Silencio';
  $('#chipSound').setAttribute('aria-pressed', String(st.sound));
  $('#chipSound').setAttribute('aria-label', st.sound ? 'Sonido activado. Silenciar' : 'Sonido silenciado. Activar sonido');
  $('#setSound').textContent = st.sound ? 'Sonido: activado' : 'Sonido: silenciado';
}
function toggleSound() { st.sound = !st.sound; save(); applySound(); SND.tap(); }

function hud(bump = false) {
  if (st.day !== today()) { st.day = today(); st.today = 0; }
  $('#xp').textContent = st.xp;
  $('#streak').textContent = st.streak;
  const g = Math.min(st.today, 5);
  $('#goal').textContent = `${g}/5`;
  $('#ring').style.strokeDashoffset = String(40.84 * (1 - g / 5));
  if (bump) for (const c of ['#chipXP', '#chipStreak', '#chipGoal']) { const e = $(c); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
}
function grow() { document.body.dataset.grow = session >= 5 ? '3' : session >= 3 ? '2' : session >= 1 ? '1' : '0'; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
function live(msg) { const l = $('#live'); l.textContent = ''; setTimeout(() => (l.textContent = plainTxt(msg)), 30); }

// ---------- navegación ----------
function route() {
  const m = location.hash.match(/^#\/(\w+)\/(\w+)/);
  if (m && INFO[m[1]] && LV[m[2]]) openWork(m[1], m[2]); else openHome();
}
function go(method, level) {
  const h = `#/${method}/${level}`;
  if (location.hash === h) openWork(method, level); else location.hash = h;
}
window.addEventListener('hashchange', route);

// ---------- inicio ----------
const MINI = {
  sub: () => `<span>${K('2')}<span class="chipx">${K('(y+2)')}</span>${K('{}+y=7')}</span>`,
  igu: () => `<span><span class="l">${K('y+2')}</span> ${K('=')} <span class="r">${K('7-2y')}</span></span>`,
  eli: () => `<span><span class="t1">${K('3x')}</span> ${K('+')} <span class="t2">${K('(-3x)')}</span> <span class="z">${K('=0')}</span></span>`,
  cra: () => `<span>${K('D')} → <span class="col">${K('D_x')}</span> → ${K('D_y')}</span>`,
};
let homeBuilt = false;
function renderHome() {
  if (!homeBuilt) {
    homeBuilt = true;
    $('#rincones').innerHTML = ORDER.map((m) => {
      const I = INFO[m];
      return `<button type="button" class="rincon" data-m="${m}" style="--mc:${I.color}" aria-label="${I.n}. ${I.name}, ${I.place.toLowerCase()}. Entrar">
        ${vignette(m)}
        <span class="rlabel"><span class="n" aria-hidden="true">${I.n}</span><span class="h2">${I.name}</span><small>${I.place} <b>· Entrar →</b></small><span class="mini m-${I.mini}" aria-hidden="true">${MINI[I.mini]()}</span></span>
      </button>`;
    }).join('');
    $('#rincones').addEventListener('click', (e) => { const b = e.target.closest('.rincon'); if (b) go(b.dataset.m, st.lastLv[b.dataset.m] || 'bajo'); });
  }
  const c = $('#continue');
  if (st.last && INFO[st.last.method] && LV[st.last.level]) {
    const I = INFO[st.last.method];
    c.innerHTML = `<button type="button" class="pill-btn" style="--mc:${I.color}"><i aria-hidden="true"></i>Continuar: ${I.name} · ${LV[st.last.level]} <span aria-hidden="true">→</span></button>`;
    c.firstElementChild.onclick = () => go(st.last.method, st.last.level);
  } else c.innerHTML = '';
}
function openHome() {
  cur = null; run = null;
  $('#home').classList.add('is-on');
  const w = $('#work'); w.classList.remove('is-on'); w.innerHTML = '';
  $('#backdrop').classList.add('is-hidden');
  $('#photo').style.backgroundImage = `url("${PHOTOS.home}")`;
  $('#brand').classList.remove('is-hidden');
  for (const id of ['#back', '#wtitle', '#pizarra']) $(id).classList.add('is-hidden');
  doc.style.removeProperty('--m');
  document.title = 'Sistemas de ecuaciones · con el prof. Anto';
  renderHome();
}

// ---------- espacio de trabajo ----------
function openWork(method, level) {
  const fresh = !cur || cur.method !== method;
  cur = { method, level };
  st.last = { method, level }; st.lastLv[method] = level; save();
  const I = INFO[method];
  $('#home').classList.remove('is-on');
  $('#work').classList.add('is-on');
  doc.style.setProperty('--m', I.color);
  if (fresh) {
    const bd = $('#backdrop');
    bd.innerHTML = vignette(method, '') + '<div class="veil"></div>';
    bd.classList.remove('is-hidden');
    $('#photo').style.backgroundImage = `url("${PHOTOS[method]}")`;
    window.scrollTo(0, 0);
  }
  $('#brand').classList.add('is-hidden');
  $('#back').classList.remove('is-hidden');
  const wt = $('#wtitle'); wt.classList.remove('is-hidden'); wt.textContent = `${I.name} · ${I.title || I.place}`;
  const pz = $('#pizarra'); pz.classList.remove('is-hidden');
  pz.innerHTML = LEVELS.map((l) => `<button type="button" class="pz" data-l="${l}" aria-pressed="${l === level}">${LV[l]}</button>`).join('');
  document.title = `${I.name} · ${LV[level]} — Sistemas de ecuaciones`;
  newExercise();
}
$('#pizarra').addEventListener('click', (e) => { const b = e.target.closest('.pz'); if (b && cur && b.dataset.l !== cur.level) go(cur.method, b.dataset.l); });

const BRACE = '<svg class="brace" viewBox="0 0 14 70" aria-hidden="true"><path d="M12 2C7 2 7 5 7 10v18c0 4-2 7-5 7 3 0 5 3 5 7v18c0 5 0 8 5 8" fill="none" stroke-width="1.6" stroke-linecap="round"/></svg>';
const PL = '<svg class="brk" viewBox="0 0 14 128" preserveAspectRatio="none" aria-hidden="true"><path d="M12 3C2 30 2 98 12 125" fill="none" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
const PR = '<svg class="brk" viewBox="0 0 14 128" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3C12 30 12 98 2 125" fill="none" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
const BAR = '<svg class="brk" viewBox="0 0 14 128" preserveAspectRatio="none" aria-hidden="true"><path d="M7 3V125" fill="none" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';

function newExercise() {
  const key = cur.method + '/' + cur.level;
  exCount[key] = (exCount[key] || 0) + 1;
  const ex = generate(cur.method, cur.level, { recent: new Set(st.recent) });
  st.recent = [ex.key, ...st.recent.filter((k) => k !== ex.key)].slice(0, 60); save();
  run = { ex, n: exCount[key], queue: [...ex.steps], s: ex.sysShown || ex.s, eqs: ex.eqs, mistakes: 0, hints: 0, hint: 0, done: 0, dets: {}, cramer: cur.method === 'cramer', busy: false };
  const W = $('#work');
  if (run.cramer) {
    W.innerHTML = `<div class="work enter"><div class="lab">
      <aside class="side">
        <div class="card"><div class="cap">Sistema</div><div class="roles"></div>
          <div class="legend" aria-hidden="true"><span><i style="background:var(--rx)"></i>coef. de x</span><span><i style="background:var(--ry)"></i>coef. de y</span><span><i style="background:var(--rb)"></i>independientes</span></div></div>
        <div class="card routecard"><div class="cap">${LV[cur.level]} · Ejercicio ${run.n}</div><div class="route" aria-label="Recorrido"></div></div>
        <div class="foot"><button type="button" class="hintbtn">Pista</button></div>
        <div class="hintbox"></div>
      </aside>
      <section class="desk" aria-label="Mesa de trabajo">
        <h2 class="deskprompt" id="prompt" tabindex="-1"></h2>
        <div class="dstage"></div>
        <div class="lines"></div>
        <div class="panel"><div class="opts" role="group" aria-labelledby="prompt"></div><div class="fbs" aria-live="polite"></div></div>
      </section></div></div>`;
  } else {
    W.innerHTML = `<div class="work enter"><div class="grid">
      <article class="hoja" aria-label="Hoja de trabajo">
        <div class="hoja-head"><span class="lab">${LV[cur.level]} · Ejercicio ${run.n}</span><div class="dots" aria-hidden="true"></div></div>
        <div class="sistema" role="group" aria-label="Sistema de ecuaciones">${BRACE}<div class="eqs"></div></div>
        <div class="lines"></div>
      </article>
      <section class="panel" aria-label="Siguiente paso">
        <span class="cap">Siguiente paso</span>
        <h2 class="prompt" id="prompt" tabindex="-1"></h2>
        <div class="opts" role="group" aria-labelledby="prompt"></div>
        <div class="fbs" aria-live="polite"></div>
        <div class="foot"><button type="button" class="hintbtn">Pista</button></div>
        <div class="hintbox"></div>
      </section></div></div>`;
  }
  const root = W.firstElementChild;
  run.R = {
    root, prompt: $('#prompt', root), opts: $('.opts', root), fbs: $('.fbs', root), hintbtn: $('.hintbtn', root), hintbox: $('.hintbox', root),
    lines: $('.lines', root), eqs: $('.eqs', root), hoja: $('.hoja', root), dots: $('.dots', root), panel: $('.panel', root),
    roles: $('.roles', root), route: $('.route', root), dstage: $('.dstage', root), desk: $('.desk', root),
  };
  run.R.hintbtn.onclick = hint;
  if (run.cramer) renderRoles(); else renderEqs();
  nextStep();
}

function renderEqs() {
  run.R.eqs.innerHTML = run.eqs.map((E, i) => `<div class="eqrow" data-eq="${i}">${K(texEq(E))}<small>(${i + 1})</small></div>`).join('');
}
function later(fn, ms) {
  const id = run && run.ex.id;
  setTimeout(() => { if (run && run.ex.id === id) fn(); }, reduced() ? Math.min(ms, 250) : ms);
}
function setPrompt(t) { run.R.prompt.innerHTML = rich(t); }
function say(text, kind = 'err') { run.R.fbs.innerHTML = `<div class="fb ${kind}">${rich(text)}</div>`; live(text); }
function clearSay() { run.R.fbs.innerHTML = ''; }

function remaining() {
  let n = 0;
  const est = (s) => (s.kind === 'decide' ? 1 + s.choices[0].steps.length : 1);
  for (const s of run.queue) n += est(s);
  if (run.ex.second && !run.inSecond) n += est(run.ex.second.root);
  return n;
}
function dots() {
  if (!run.R.dots) return;
  const total = run.done + 1 + remaining();
  run.R.dots.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i <= run.done ? 'on' : ''}"></i>`).join('');
}

const ROUTE = ['Separar coeficientes', 'Calcular D', 'Construir Dₓ', 'Construir Dᵧ', 'x = Dₓ / D,  y = Dᵧ / D'];
const ROUTE0 = ['Filas y columnas', 'Armar la matriz', 'Determinante'];
function renderRoute(step) {
  let items = ROUTE, idx;
  if (cur.level === 'desde0') { items = ROUTE0; idx = step.kind === 'grid' ? 0 : step.kind === 'build' ? 1 : 2; }
  else if (step.kind === 'build') idx = 0;
  else if (step.kind === 'det') idx = { D: 1, D_x: 2, D_y: 3 }[step.label] ?? 1;
  else if (step.kind === 'swap') idx = step.target === 'x' ? 2 : 3;
  else if (step.fx && step.fx.type === 'd0') { items = [ROUTE[0], ROUTE[1], 'Conclusión (D = 0)']; idx = 2; }
  else idx = 4;
  run.R.route.innerHTML = items.map((t, i) => `<div class="${i < idx ? 'ok' : i === idx ? 'now' : ''}"${i === idx ? ' aria-current="step"' : ''}><b aria-hidden="true">${i < idx ? '✓' : i + 1}</b>${t}</div>`).join('');
}

// ---------- ciclo de pasos ----------
function nextStep() {
  const R = run.R;
  R.opts.innerHTML = ''; R.opts.className = 'opts'; clearSay(); R.hintbox.innerHTML = '';
  run.hint = 0; run.busy = false; R.hintbtn.disabled = false; R.hintbtn.textContent = 'Pista';
  $$('.eqrow.focus', R.root).forEach((e) => e.classList.remove('focus'));
  if (!run.queue.length) { if (run.ex.second && !run.inSecond) return startSecond(); return finish(); }
  const step = (run.step = run.queue.shift());
  if (run.cramer) renderRoute(step); else dots();
  if (step.focus && step.focus.eq != null && R.eqs) R.eqs.children[step.focus.eq]?.classList.add('focus');
  ({ decide: stDecide, choose: stChoose, det: stDet, build: stBuild, swap: stSwap, grid: stGrid, tap: stTap, check: stCheck })[step.kind](step);
  if (mobile() && run.done > 0) (run.cramer && step.kind === 'build' ? R.roles : R.prompt).scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}

function options(step, { gate = false, row = false, label } = {}) {
  const R = run.R;
  R.opts.className = 'opts' + (row ? ' row' : '');
  R.opts.innerHTML = step.options.map((o, i) => `<button type="button" class="opt${gate ? ' locked' : ''}" data-i="${i}" style="animation-delay:${i * 45}ms"${gate ? ' disabled' : ''}><span class="kbd" aria-hidden="true">${i + 1}</span><span class="math">${K(label ? label(o) : o.line.tex)}</span><span class="mk" aria-hidden="true"></span></button>`).join('');
  $$('.opt', R.opts).forEach((b) => (b.onclick = () => pick(step, +b.dataset.i, b)));
}
function unlock() { $$('.opt', run.R.opts).forEach((b) => { b.disabled = false; b.classList.remove('locked'); }); }

function pick(step, i, b) {
  if (b.disabled || run.busy) return;
  const o = step.options[i];
  if (!o.ok) {
    b.classList.add('bad'); b.disabled = true; b.querySelector('.mk').textContent = '×';
    run.mistakes++; say(o.fb, 'err'); SND.bad();
    setTimeout(() => b.classList.add('spent'), 650);
    return;
  }
  run.busy = true;
  b.classList.add('ok'); b.querySelector('.mk').textContent = '✓';
  $$('.opt', run.R.opts).forEach((x) => { if (x !== b) { x.disabled = true; x.classList.add('dim'); } });
  clearSay(); SND.ok(); live('Correcto.');
  onCorrect(step);
}
const isLast = () => !run.queue.length && !(run.ex.second && !run.inSecond);

function onCorrect(step) {
  const t = step.fx && step.fx.type;
  if (step.kind === 'det') {
    run.dets[step.label] = step.value;
    const qb = $('.qbox', run.R.dstage); if (qb) { qb.innerHTML = K(texNum(step.value)); qb.classList.add('filled'); }
  }
  if (t === 'side') fillPill(step.fx.side, step.line.tex);
  if (t === 'factors') setK(step.line.k);
  if (t === 'rows') setRows(step.line.eqs);
  if (t === 'd0') showD0(step.fx.singular);
  if (step.kind !== 'det') writeLine(step.line, isLast() ? 'final' : '');
  run.done++;
  later(() => { if (['merge', 'cancel', 'substitute'].includes(t)) dropStage(); nextStep(); }, 650);
}

function writeLine(line, cls = '') { addLine(`<div class="ln new write ${cls}">${K(line.tex)}</div>`); }
function writeTag(text) { addLine(`<div class="ln tag">${rich(text)}</div>`, false); }
function writeNote(text) { addLine(`<div class="ln new write note">${rich(text)}</div>`); }
function addLine(html, arrow = true) {
  const L = run.R.lines;
  if (arrow && !run.cramer && L.children.length && !L.lastElementChild.classList.contains('tag')) L.append(el('<div class="arrow" aria-hidden="true">↓</div>'));
  const d = el(html); L.append(d);
  setTimeout(() => d.classList.remove('new'), 900);
  const lns = $$('.ln:not(.tag)', L); lns.slice(0, -5).forEach((x) => x.classList.add('old'));
  d.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
}
function stageIn(node) { dropStage(); run.stage = node; run.R.hoja.append(node); return node; }
function dropStage() { if (run && run.stage) { run.stage.remove(); run.stage = null; } }

// ---- arrastrar (siempre con alternativa de toque) ----
function drag(src, targets, onDrop) {
  src.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || src.disabled) return;
    const sx = e.clientX, sy = e.clientY, r0 = src.getBoundingClientRect();
    let g = null, hot = null;
    const find = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); return t && t.closest(targets); };
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!g && Math.hypot(dx, dy) > 8) {
        g = src.cloneNode(true); g.classList.add('ghost'); g.removeAttribute('id');
        Object.assign(g.style, { left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', height: r0.height + 'px' });
        document.body.append(g); src.style.opacity = '.35';
      }
      if (g) {
        g.style.transform = `translate(${dx}px, ${dy}px)`;
        const t = find(ev);
        if (t !== hot) { hot?.classList.remove('hot'); hot = t; hot?.classList.add('hot'); }
      }
    };
    const end = (ev) => {
      src.removeEventListener('pointermove', move); src.removeEventListener('pointerup', end); src.removeEventListener('pointercancel', end);
      if (!g) return;
      g.remove(); src.style.opacity = ''; hot?.classList.remove('hot');
      src._dragged = true; setTimeout(() => (src._dragged = false), 60);
      if (ev.type === 'pointerup' && hot) onDrop(hot);
    };
    try { src.setPointerCapture(e.pointerId); } catch { /* */ }
    src.addEventListener('pointermove', move); src.addEventListener('pointerup', end); src.addEventListener('pointercancel', end);
  });
}
function fly(from, to, html, done) {
  if (reduced() || !from || !to) return done();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const g = el(`<div class="ghost flyer">${html}</div>`);
  Object.assign(g.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.append(g);
  const an = g.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px)` }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  an.onfinish = () => { g.remove(); done(); };
}

// ---------- pasos: decisión ----------
function stDecide(step) {
  setPrompt(step.prompt);
  const R = run.R;
  const lab = (c) => (c.eq != null ? `Despejar ${K(c.v)} de (${c.eq + 1})` : c.w ? `Eliminar ${K(c.w)}` : `Igualar ${K(c.v)}`);
  R.opts.innerHTML = step.choices.map((c, i) => `<button type="button" class="opt choice" data-i="${i}" style="animation-delay:${i * 45}ms"><span class="kbd" aria-hidden="true">${i + 1}</span><span class="math">${lab(c)}</span><span class="mk" aria-hidden="true"></span></button>`).join('');
  $$('.opt', R.opts).forEach((b) => (b.onclick = () => {
    if (run.busy) return;
    run.busy = true;
    const c = step.choices[+b.dataset.i];
    b.classList.add('ok'); b.querySelector('.mk').textContent = '✓';
    $$('.opt', R.opts).forEach((x) => { if (x !== b) { x.disabled = true; x.classList.add('dim'); } });
    SND.ok();
    if (c.note) say(c.note, 'note');
    writeTag(c.eq != null ? `Despejo $${c.v}$ de (${c.eq + 1})` : c.w ? `Elimino $${c.w}$` : `Igualo $${c.v}$ en las dos ecuaciones`);
    run.queue.unshift(...c.steps);
    run.choice = c;
    if (cur.method === 'igualacion') stageTwin(c.v);
    if (cur.method === 'eliminacion') stageRows(c.w);
    run.done++;
    later(nextStep, c.note ? 1300 : 600);
  }));
}

// ---------- pasos: elegir la siguiente línea ----------
function stChoose(step) {
  const t = step.fx && step.fx.type;
  if (!run.cramer && !['side', 'merge', 'factors', 'rows', 'cancel', 'substitute'].includes(t)) dropStage();
  setPrompt(step.prompt);
  let gate = false;
  if (t === 'substitute') { stageSubst(step); gate = true; }
  if (t === 'merge') { stageMerge(step); gate = true; }
  if (t === 'cancel') { stageCancel(step); gate = true; }
  if (run.cramer) deskResults(step);
  options(step, { gate });
}

// Sustitución: la expresión entra donde estaba la incógnita
function stageSubst(step) {
  const { chip, v, eq: j } = step.fx, s = run.s;
  const [a, b, r] = j ? [s.c, s.d, s.f] : [s.a, s.b, s.e];
  let html = '', first = true;
  for (const [k, w] of [[a, 'x'], [b, 'y']]) {
    if (k.isZero) continue;
    const sign = first ? (k.sign < 0 ? '-' : '') : k.sign < 0 ? '{}-' : '{}+';
    const abs = k.abs();
    if (w === v) {
      const pre = sign + (abs.eq(1) ? '' : texNum(abs) + '\\cdot');
      if (pre) html += K(pre);
      html += `<button type="button" class="hole" aria-label="Lugar de ${v} en la ecuación (${j + 1}). Toca para colocar la expresión">${K(v)}</button>`;
    } else html += K(sign + (abs.eq(1) ? '' : texNum(abs)) + w);
    first = false;
  }
  html += K('{}=' + texNum(r));
  const node = stageIn(el(`<div class="stage">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><button type="button" class="dragchip" aria-label="Expresión de ${v}. Tócala y luego toca el hueco, o arrástrala">${K(chip)}</button><span class="cap2">arrastra o toca →</span></div>
    <div class="target">${html}</div>
    <span class="cap2 note">La ${v} de (${j + 1}) se abre para recibir la expresión.</span></div>`));
  setPrompt(`Lleva $${v}$ a su lugar en (${j + 1})`);
  const chipB = $('.dragchip', node), hole = $('.hole', node);
  const fill = () => {
    if (hole.classList.contains('filled')) return;
    const put = () => {
      hole.innerHTML = K(`\\left(${chip}\\right)`); hole.classList.add('filled'); hole.disabled = true;
      chipB.parentElement.style.display = 'none';
      $('.note', node).textContent = `La expresión ocupó el lugar de ${v}, con paréntesis.`;
      setPrompt(`¿Cómo queda la ecuación (${j + 1})?`);
      SND.tap(); unlock(); live('Expresión colocada. Elige cómo queda la ecuación.');
    };
    fly(chipB, hole, chipB.innerHTML, put);
  };
  chipB.onclick = () => { if (chipB._dragged) return; chipB.classList.toggle('picked'); if (chipB.classList.contains('picked')) { hole.classList.add('hot'); hole.focus(); } };
  hole.onclick = () => { hole.classList.remove('hot'); fill(); };
  drag(chipB, '.hole', () => { chipB.style.visibility = 'hidden'; hole.innerHTML = ''; fill(); });
}

// Igualación: dos despejes que se unen en el centro
function stageTwin(v) {
  stageIn(el(`<div class="stage"><div class="twin">
    <div class="side l"><small>de (1)</small><span class="xpill empty" data-side="left">${K(v + ' = \\;?')}</span></div>
    <span class="eqsign" aria-hidden="true">=</span>
    <div class="side r"><small>de (2)</small><span class="xpill empty" data-side="right">${K(v + ' = \\;?')}</span></div>
  </div><span class="cap2 note">Despeja ${v} en cada ecuación: las dos expresiones se unirán en el centro.</span></div>`));
}
function fillPill(side, tex) {
  const p = run.stage && $(`.xpill[data-side="${side}"]`, run.stage);
  if (!p) return;
  p.innerHTML = K(tex); p.classList.remove('empty'); p.classList.add('wave');
  setTimeout(() => p.classList.remove('wave'), 700);
}
function stageMerge(step) {
  const { left, right, v } = step.fx;
  const node = run.stage || stageTwin(v) || run.stage;
  const tw = $('.twin', node);
  tw.innerHTML = `<div class="side l"><small>de (1)</small><button type="button" class="xpill" data-side="left" style="touch-action:none">${K(left)}</button></div>
    <span class="eqsign" aria-hidden="true">=</span>
    <div class="side r"><small>de (2)</small><button type="button" class="xpill" data-side="right">${K(right)}</button></div>`;
  const go = el(`<button type="button" class="pill-btn go" style="--mc:var(--m2)"><i aria-hidden="true"></i>Unir en el centro</button>`);
  node.insertBefore(go, $('.note', node));
  $('.note', node).textContent = `Las dos expresiones valen ${v}. Arrastra una hacia la otra o toca “Unir”.`;
  setPrompt('Une las dos expresiones');
  let merged = false;
  const merge = () => {
    if (merged) return; merged = true;
    tw.classList.add('merged'); const eqs = $('.eqsign', tw); eqs.classList.add('wave');
    go.remove(); $$('.xpill', tw).forEach((b) => (b.disabled = true));
    $('.note', node).textContent = `Si las dos son iguales a ${v}, son iguales entre sí.`;
    setPrompt(step.prompt); SND.tap(); unlock(); live('Expresiones unidas. Elige la ecuación resultante.');
  };
  go.onclick = merge;
  $$('.xpill', tw).forEach((b) => (b.onclick = () => { if (!b._dragged) merge(); }));
  drag($('.xpill[data-side="left"]', tw), '.xpill[data-side="right"]', merge);
}

// Eliminación: filas alineadas, multiplicadores y opuestos que desaparecen
const termTex = (k, w, first) => { const a = k.abs(); return (first ? (k.sign < 0 ? '-' : '') : k.sign < 0 ? '{}-' : '{}+') + (a.eq(1) ? '' : texNum(a)) + w; };
function rowCells(a, b, c) { const w = run.choice.w; return `<span class="c${w === 'x' ? ' w' : ''}">${K(termTex(a, 'x', true))}</span><span class="c${w === 'y' ? ' w' : ''}">${K(termTex(b, 'y', false))}</span><span class="c">${K('=' + texNum(c))}</span>`; }
function stageRows() {
  const s = run.s;
  stageIn(el(`<div class="stage"><div class="rows">
    <div class="row" data-r="0"><span class="k">×?</span>${rowCells(s.a, s.b, s.e)}</div>
    <div class="row" data-r="1"><span class="k">×?</span>${rowCells(s.c, s.d, s.f)}</div>
  </div><span class="cap2 note">Busca multiplicadores que dejen opuestos los términos resaltados.</span></div>`));
}
function setK(k) {
  if (!run.stage) return;
  $$('.row .k', run.stage).forEach((e, i) => { e.textContent = '×' + (k[i].sign < 0 ? `(${pl(k[i])})` : pl(k[i])); e.classList.add('on'); });
}
function setRows(eqs) {
  if (!run.stage) return;
  $$('.row', run.stage).forEach((r, i) => { const f = eqLin(eqs[i]); r.innerHTML = r.firstElementChild.outerHTML + rowCells(f.a, f.b, f.c); });
  $('.note', run.stage).textContent = 'Ahora los términos resaltados son opuestos.';
}
function stageCancel(step) {
  const node = run.stage; if (!node) return;
  const rows = $('.rows', node);
  if (step.fx.both) $$('.row .c', rows).forEach((c, i) => { if (i % 3 !== 2) c.classList.add('w'); });
  const go = el(`<button type="button" class="pill-btn go" style="--mc:var(--m3)"><i aria-hidden="true"></i>Sumar las filas</button>`);
  node.insertBefore(go, $('.note', node));
  $('.note', node).textContent = 'Suma miembro a miembro: izquierda con izquierda, derecha con derecha.';
  setPrompt('Suma las dos filas');
  go.onclick = () => {
    rows.classList.add('cancel');
    const w = run.choice.w, zero = `<span class="c zero">${K('0')}</span>`, qm = `<span class="c">${K('?')}</span>`;
    const cells = step.fx.both ? zero + zero : w === 'x' ? zero + qm : qm + zero;
    rows.append(el(`<div class="row sumline"><span class="k">+</span>${cells}<span class="c">${K('=\\;?')}</span></div>`));
    go.remove();
    $('.note', node).textContent = step.fx.both ? 'Desaparecieron las dos incógnitas.' : `Los términos en ${w} se anulan.`;
    setPrompt(step.prompt); SND.tap(); unlock(); live('Filas sumadas. Elige el resultado.');
  };
}

// ---------- Cramer ----------
function renderRoles() {
  const s = run.s, rows = [[s.a, s.b, s.e], [s.c, s.d, s.f]];
  const tok = (i, r, v) => `<button type="button" class="tok" data-role="${r}" data-id="${i}${r}" data-v="${v.key()}" disabled aria-label="${pl(v)}, ${ROLE[r]} de la ecuación ${i + 1}">${K(texNum(v))}</button>`;
  run.R.roles.innerHTML = rows.map((r, i) => `<div class="rrow">${tok(i, 'x', r[0])}${K('x\\;+')}${tok(i, 'y', r[1])}${K('y\\;=')}${tok(i, 'b', r[2])}</div>`).join('');
}
const cellH = (v, role, extra = '') => `<div class="cell"${role ? ` data-role="${role}"` : ''}${extra}>${K(texNum(v))}</div>`;

function stBuild(step) {
  const R = run.R;
  setPrompt('Toca el coeficiente que va en la casilla iluminada');
  const order = [['0x', step.A[0]], ['0y', step.A[1]], ['1x', step.A[2]], ['1y', step.A[3]], ['0b', step.B[0]], ['1b', step.B[1]]];
  const ec = (id) => `<div class="cell empty" data-id="${id}" data-role="${id[1]}"></div>`;
  R.dstage.innerHTML = `<div class="mats">
      <div class="mat"><span class="lbl">${K('A =')}</span>${PL}<div class="cols"><div class="col">${ec('0x')}${ec('1x')}</div><div class="col">${ec('0y')}${ec('1y')}</div></div>${PR}</div>
      <div class="mat"><span class="lbl">${K('B =')}</span>${PL}<div class="cols"><div class="col">${ec('0b')}${ec('1b')}</div></div>${PR}</div>
    </div><span class="cap2 where" aria-live="polite"></span><span class="cap2">Cada ficha conserva el color de su incógnita: así se ve de dónde sale cada número.</span>`;
  let bi = 0;
  const mark = () => {
    $$('.cell.next', R.dstage).forEach((c) => c.classList.remove('next'));
    if (bi >= order.length) return;
    const [id] = order[bi];
    $(`.cell[data-id="${id}"]`, R.dstage).classList.add('next');
    const r = +id[0] + 1;
    $('.where', R.dstage).textContent = id[1] === 'b'
      ? `Casilla: B, fila ${r}${cur.level === 'desde0' ? ` (término independiente de la ecuación ${r})` : ''}`
      : `Casilla: A, fila ${r}, columna ${id[1] === 'x' ? 1 : 2}${cur.level === 'desde0' ? ` (ecuación ${r}, ${ROLE[id[1]]})` : ''}`;
  };
  mark();
  const toks = $$('.tok', R.roles);
  const place = (tk) => {
    if (bi >= order.length || tk.classList.contains('used') || run.busy) return;
    const [id, v] = order[bi], cell = $(`.cell[data-id="${id}"]`, R.dstage);
    if (tk.dataset.v === v.key()) {
      run.busy = true; clearSay(); tk.classList.add('used'); tk.disabled = true;
      fly(tk, cell, tk.innerHTML, () => {
        cell.classList.remove('empty', 'next'); cell.innerHTML = K(texNum(v)); cell.classList.add('pop');
        SND.tap(); bi++; run.busy = false; mark();
        if (bi === order.length) { toks.forEach((t) => { t.disabled = true; t.classList.remove('used'); }); say('Matrices listas: A guarda los coeficientes; B, los términos independientes.', 'ok'); run.done++; later(nextStep, 900); }
      });
    } else {
      run.mistakes++; SND.bad();
      const ti = tk.dataset.id, ci = id;
      say(ti[1] !== ci[1] ? `Ese número es ${ROLE[ti[1]]}; esta casilla pide ${ROLE[ci[1]]}.` : `Ese número es de la ecuación (${+ti[0] + 1}); esta casilla es de la fila ${+ci[0] + 1}.`);
      tk.classList.remove('wrong'); void tk.offsetWidth; tk.classList.add('wrong');
    }
  };
  toks.forEach((tk) => {
    tk.disabled = tk.classList.contains('used');
    tk.onclick = () => { if (!tk._dragged) place(tk); };
    if (!tk._drag) { tk._drag = true; drag(tk, '.cell', (cell) => { if (cell.classList.contains('next')) place(tk); else say('Completa primero la casilla iluminada.', 'note'); }); }
  });
}

const ROLES = { D: ['x', 'y', 'x', 'y'], D_x: ['b', 'y', 'b', 'y'], D_y: ['x', 'b', 'x', 'b'] };
const LBL = { D: 'D', D_x: 'Dₓ', D_y: 'Dᵧ', '\\det A': 'det A' };
function stDet(step) {
  const R = run.R;
  const [a, b, c, d] = step.M, ro = ROLES[step.label] || [];
  setPrompt('Recorre las diagonales');
  R.dstage.innerHTML = `<div class="detrow">
      <div class="mat"><span class="lbl">${K(step.label + ' =')}</span>${BAR}<div class="detbox"><div class="cols"><div class="col">${cellH(a, ro[0])}${cellH(c, ro[2])}</div><div class="col">${cellH(b, ro[1])}${cellH(d, ro[3])}</div></div><svg class="diag" aria-hidden="true"><line class="d1"/><line class="d2"/></svg></div>${BAR}</div>
      <div class="prods" aria-live="polite"></div>
    </div>
    <div class="diagbtns"><button type="button" class="dbtn d1"><i aria-hidden="true"></i>Diagonal principal ↘</button><button type="button" class="dbtn d2"><i aria-hidden="true"></i>Diagonal secundaria ↙</button></div>
    <div class="detexpr is-hidden"></div>`;
  placeDiag();
  const alto = cur.level === 'alto', seen = new Set();
  const ad = a.mul(d), bc = b.mul(c);
  const show = (k) => {
    if (seen.has(k)) return; seen.add(k);
    $(`.diag .d${k}`, R.dstage).classList.add('on');
    const btn = $(`.dbtn.d${k}`, R.dstage); btn.disabled = true;
    const [x, y, v] = k === 1 ? [a, d, ad] : [b, c, bc];
    $('.prods', R.dstage).append(el(`<div class="prod p${k}">${K(`${texNum(x)}\\cdot ${P(y)}${alto ? '' : ' = ' + texNum(v)}`)}</div>`));
    SND.tap();
    if (seen.size === 2) {
      if (!alto) $('.prods', R.dstage).append(el('<small>Los productos viajan a la expresión final ↓</small>'));
      const ex = $('.detexpr', R.dstage); ex.classList.remove('is-hidden');
      ex.innerHTML = K(alto ? `${step.label} = ${texNum(a)}\\cdot ${P(d)} - ${texNum(b)}\\cdot ${P(c)} =` : `${step.label} = \\left(${texNum(ad)}\\right) - \\left(${texNum(bc)}\\right) =`) + '<span class="qbox" aria-label="valor por calcular">?</span>';
      setPrompt(`¿Cuánto vale ${LBL[step.label]}?`); unlock();
    }
  };
  $('.dbtn.d1', R.dstage).onclick = () => show(1);
  $('.dbtn.d2', R.dstage).onclick = () => show(2);
  options(step, { gate: true, row: true, label: (o) => texNum(o.line.value) });
}
function placeDiag() {
  const box = run && run.R.dstage && $('.detbox', run.R.dstage);
  if (!box) return;
  requestAnimationFrame(() => {
    const br = box.getBoundingClientRect();
    const [A, C, B, D] = $$('.cell', box).map((e) => { const r = e.getBoundingClientRect(); return [r.left - br.left + r.width / 2, r.top - br.top + r.height / 2]; });
    const set = (ln, p, q2) => { const k = 0.16; ln.setAttribute('x1', p[0] + (q2[0] - p[0]) * k); ln.setAttribute('y1', p[1] + (q2[1] - p[1]) * k); ln.setAttribute('x2', q2[0] - (q2[0] - p[0]) * k); ln.setAttribute('y2', q2[1] - (q2[1] - p[1]) * k); };
    set($('.d1', box), A, D); set($('.d2', box), B, C);
  });
}
window.addEventListener('resize', placeDiag);

function stSwap(step) {
  const R = run.R, [a, b, c, d] = step.A, [e, f] = step.B, t = step.target === 'x' ? 0 : 1, lbl = t ? 'D_y' : 'D_x';
  setPrompt(['desde0', 'bajo'].includes(cur.level) ? `Arrastra B sobre la columna de ${step.target} · o toca la columna y luego B` : `${step.prompt}: lleva B a la columna correcta (arrastra, o toca columna y luego B)`);
  R.dstage.innerHTML = `<div class="detrow swaprow">
      <div class="mat"><span class="lbl">${K(lbl + ' =')}</span>${BAR}<div class="cols">
        <button type="button" class="col" data-col="0" aria-label="Columna 1: coeficientes de x">${cellH(a, 'x')}${cellH(c, 'x')}</button>
        <button type="button" class="col" data-col="1" aria-label="Columna 2: coeficientes de y">${cellH(b, 'y')}${cellH(d, 'y')}</button>
      </div>${BAR}</div>
      <div class="bcol"><span class="lbl">${K('B')}</span><button type="button" class="col bbtn" aria-label="Columna B: términos independientes">${cellH(e, 'b')}${cellH(f, 'b')}</button></div>
    </div><span class="cap2 note">En ${LBL[lbl]}, la columna de B reemplaza a una columna de A.</span>`;
  const cols = $$('.col[data-col]', R.dstage), bb = $('.bbtn', R.dstage);
  let sel = null, bSel = false, done = false;
  const attempt = (ci) => {
    if (done) return;
    cols.forEach((x) => x.classList.remove('sel')); bb.classList.remove('sel'); sel = null; bSel = false;
    if (ci !== t) {
      run.mistakes++; SND.bad();
      say(`Esa columna corresponde a ${ci ? 'y' : 'x'}. Para ${LBL[lbl]} se reemplaza la columna de ${step.target}.`);
      const col = cols[ci]; col.classList.remove('wrong'); void col.offsetWidth; col.animate?.([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 280 });
      return;
    }
    done = true; clearSay();
    const col = cols[ci]; col.classList.add('lift'); bb.style.visibility = 'hidden';
    later(() => {
      col.innerHTML = cellH(e, 'b') + cellH(f, 'b'); col.classList.remove('lift'); col.classList.add('arrive'); col.disabled = true;
      cols.forEach((x) => (x.disabled = true));
      $('.note', R.dstage).textContent = `Resultado: ${LBL[lbl]} lleva B en la columna ${ci + 1}.`;
      SND.ok(); live(`Columna reemplazada. ${LBL[lbl]} construido.`);
      run.done++; later(nextStep, 1100);
    }, 420);
  };
  cols.forEach((col, i) => (col.onclick = () => { if (bSel) attempt(i); else { cols.forEach((x) => x.classList.remove('sel')); col.classList.add('sel'); sel = i; SND.tap(); } }));
  bb.onclick = () => { if (bb._dragged) return; if (sel != null) attempt(sel); else { bSel = !bSel; bb.classList.toggle('sel', bSel); SND.tap(); } };
  drag(bb, '.col[data-col]', (col) => attempt(+col.dataset.col));
}

function deskResults(step) {
  const R = run.R, t = step.fx && step.fx.type;
  const res = (lb, v, c, sub) => (v ? `<div class="res" style="--rc:${c}">${K(lb + ' = ' + texNum(v))}<small>${sub}</small></div>` : '');
  R.dstage.innerHTML = `<div class="results">${res('D', run.dets.D, 'var(--m4)', 'determinante')}${t === 'd0' ? '' : res('D_x', run.dets.D_x, 'var(--rx)', 'B en la columna de x') + res('D_y', run.dets.D_y, 'var(--ry)', 'B en la columna de y')}</div>`;
  if (t === 'd0' && run.dets.D && run.dets.D.isZero) R.dstage.firstElementChild.innerHTML = `<div class="res" style="--rc:var(--m4)">${K('D = 0')}<small>determinante</small></div>`;
}
function showD0(singular) {
  const par = singular !== 'dependiente';
  const svg = par
    ? '<svg width="120" height="84" viewBox="0 0 120 84" aria-hidden="true"><path d="M10 64 100 14M22 76 112 26" stroke="var(--m4)" stroke-width="3" stroke-linecap="round"/></svg>'
    : '<svg width="120" height="84" viewBox="0 0 120 84" aria-hidden="true"><path d="M12 70 108 16" stroke="var(--m4)" stroke-width="6" stroke-linecap="round" opacity=".35"/><path d="M12 70 108 16" stroke="var(--m4)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="6 5"/></svg>';
  run.R.dstage.append(el(`<div class="d0">${svg}<p>${par ? 'Las dos rectas son paralelas: nunca se cortan, así que el sistema no tiene solución.' : 'Las dos rectas coinciden: tienen infinitos puntos en común (infinitas soluciones).'}</p></div>`));
}

// ---------- Desde 0 ----------
function stGrid(step) {
  const R = run.R, M = step.M, tg = step.target;
  setPrompt(step.prompt);
  R.dstage.innerHTML = `<div class="grid2"><span class="lbl" style="font-size:26px">${K('M =')}</span>${PL}<div class="gridm">${[0, 1].flatMap((r) => [0, 1].map((c) => `<button type="button" class="gcell" data-r="${r}" data-c="${c}" aria-label="Fila ${r + 1}, columna ${c + 1}: ${pl(M[r * 2 + c])}">${K(texNum(M[r * 2 + c]))}</button>`)).join('')}</div>${PR}</div>`;
  const cells = $$('.gcell', R.dstage);
  let done = false;
  cells.forEach((b) => (b.onclick = () => {
    if (done) return;
    const r = +b.dataset.r, c = +b.dataset.c;
    const ok = (tg.row == null || tg.row === r) && (tg.col == null || tg.col === c);
    if (!ok) {
      run.mistakes++; SND.bad();
      if (tg.row != null && tg.col != null) say(r !== tg.row ? `Esa casilla está en la fila ${r + 1}; busca la fila ${tg.row + 1}.` : `Esa casilla está en la columna ${c + 1}; busca la columna ${tg.col + 1}.`);
      else if (tg.row != null) say(`Esa casilla está en la fila ${r + 1}. Las filas son horizontales y se cuentan desde arriba.`);
      else say(`Esa casilla está en la columna ${c + 1}. Las columnas son verticales y se cuentan desde la izquierda.`);
      return;
    }
    done = true;
    const hit = cells.filter((x) => (tg.row == null || +x.dataset.r === tg.row) && (tg.col == null || +x.dataset.c === tg.col));
    hit.forEach((x) => x.classList.add('hl'));
    const vals = hit.map((x) => texNum(M[+x.dataset.r * 2 + +x.dataset.c]));
    say(tg.row != null && tg.col != null ? 'Primero la fila, luego la columna.' : tg.row != null ? 'Una fila es horizontal.' : 'Una columna es vertical.', 'ok');
    writeNote(tg.row != null && tg.col != null ? `Fila ${tg.row + 1}, columna ${tg.col + 1}: $${vals[0]}$` : tg.row != null ? `Fila ${tg.row + 1}: $${vals.join('\\;\\text{y}\\;')}$` : `Columna ${tg.col + 1}: $${vals.join('\\;\\text{y}\\;')}$`);
    SND.ok(); run.done++; later(nextStep, 1000);
  }));
}

function stTap(step) {
  const R = run.R, s = run.s;
  setPrompt(step.prompt);
  const rows = [[s.a, s.b, s.e], [s.c, s.d, s.f]];
  const btn = (t, i, html) => `<button type="button" class="etok" data-t="${t}" data-eq="${i}">${html}</button>`;
  R.eqs.innerHTML = rows.map(([a, b, e], i) => {
    const x = a.abs().eq(1) ? btn('x1', i, K(a.sign < 0 ? '-x' : 'x')) : btn('x', i, K(texNum(a))) + btn('vx', i, K('x'));
    const y = K(b.sign < 0 ? '-' : '+') + (b.abs().eq(1) ? btn('y1', i, K('y')) : btn('y', i, K(texNum(b.abs()))) + btn('vy', i, K('y')));
    return `<div class="tokrow" data-eq="${i}">${x}${y}${K('=')}${btn('c', i, K(texNum(e)))}<small>(${i + 1})</small></div>`;
  }).join('');
  let done = false;
  $$('.etok', R.eqs).forEach((b) => (b.onclick = () => {
    if (done) return;
    const t = b.dataset.t, i = +b.dataset.eq, want = step.target;
    const kindOk = want === 'x' ? t === 'x' || t === 'x1' : t === 'c';
    if (kindOk && i === step.eq) {
      done = true; b.classList.add('ok'); SND.ok();
      const [a, , e] = rows[i];
      if (t === 'x1') say(`Si no se ve número, el coeficiente es ${a.sign < 0 ? '−1' : '1'}.`, 'ok'); else clearSay();
      writeNote(want === 'x' ? `Coeficiente de $x$ en (${i + 1}): $${texNum(a)}$` : `Término independiente de (${i + 1}): $${texNum(e)}$`);
      run.done++; later(() => { renderEqs(); nextStep(); }, 1100);
      return;
    }
    run.mistakes++; SND.bad();
    b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
    let m;
    if (kindOk) m = `Esa es la ecuación (${i + 1}); busca en la (${step.eq + 1}).`;
    else if (want === 'x') m = t === 'vx' ? 'Esa es la incógnita. El coeficiente es el número que la multiplica.' : t === 'c' ? 'Ese es el término independiente: no tiene incógnita.' : 'Ese número acompaña a y, no a x.';
    else m = t === 'vx' || t === 'vy' ? 'Esa es una incógnita, no un número solo.' : 'Ese número acompaña a una incógnita.';
    say(m);
  }));
}

function stCheck(step) {
  const s = run.s, { x, y } = step.pair;
  setPrompt(step.prompt);
  const rows = [[s.a, s.b, s.e], [s.c, s.d, s.f]];
  const expr = ([a, b]) => `${texNum(a)}\\cdot ${P(x)} ${b.sign < 0 ? '-' : '+'} ${texNum(b.abs())}\\cdot ${P(y)}`;
  const node = stageIn(el(`<div class="stage"><div class="pairbig" style="justify-self:center">${K(`(x,\\ y) = (${texNum(x)},\\ ${texNum(y)})`)}</div>
    <div class="checkcards">${rows.map((r, i) => `<div class="ccard" data-i="${i}"><span class="cap2">Ecuación (${i + 1})</span><span class="eqline">${K(texEq(run.eqs[i]))}</span><span class="calc sub"></span><div class="yn"><button type="button" data-a="1">Cumple</button><button type="button" data-a="0">No cumple</button></div></div>`).join('')}</div></div>`));
  const got = [null, null];
  $$('.ccard', node).forEach((card) => $$('.yn button', card).forEach((b) => (b.onclick = () => {
    const i = +card.dataset.i, ans = b.dataset.a === '1', r = rows[i];
    const lhs = r[0].mul(x).add(r[1].mul(y));
    if (ans !== step.answers[i]) {
      run.mistakes++; SND.bad();
      say(`Sustituye: $${expr(r)} = ${texNum(lhs)}$. ¿Es igual a $${texNum(r[2])}$?`);
      return;
    }
    clearSay(); SND.tap();
    got[i] = ans;
    card.classList.add(ans ? 'good' : 'nog');
    $('.calc', card).innerHTML = K(`${expr(r)} = ${texNum(lhs)}${lhs.eq(r[2]) ? '\\;\\checkmark' : `\\;\\neq ${texNum(r[2])}`}`);
    $('.yn', card).innerHTML = `<b>${ans ? 'Cumple' : 'No cumple'}</b>`;
    if (got.every((g) => g !== null)) {
      const all = got.every(Boolean), miss = got.findIndex((g) => !g) + 1;
      const pair = `$(${texNum(x)},\\ ${texNum(y)})$`;
      writeNote(all ? `${pair} cumple las dos ecuaciones: es solución del sistema.` : `${pair} no cumple la ecuación (${miss}): no es solución del sistema.`);
      SND.ok(); run.done++; later(() => { dropStage(); nextStep(); }, 1300);
    }
  })));
}

function startSecond() {
  run.inSecond = true;
  const s2 = run.ex.second.s;
  run.s = s2; run.eqs = sysEqs(s2);
  run.R.lines.innerHTML = `<div class="ln interlude">Ahora resuelve este sistema con ${INFO[cur.method].name}.</div>`;
  renderEqs();
  const sys = $('.sistema', run.R.root); sys.classList.remove('write'); void sys.offsetWidth; sys.classList.add('write');
  run.queue = [run.ex.second.root];
  toast('Ya sabes leer un sistema. ¡A resolver!');
  nextStep();
}

// ---------- pistas ----------
function focusEl(step) {
  const R = run.R, t = step.fx && step.fx.type;
  if (step.kind === 'build') return $('.cell.next', R.dstage);
  if (step.kind === 'det') return $('.detbox', R.dstage);
  if (step.kind === 'swap') return $(`.col[data-col="${step.target === 'x' ? 0 : 1}"]`, R.dstage);
  if (step.kind === 'grid') return $('.gridm', R.dstage);
  if (step.kind === 'tap') return $(`.tokrow[data-eq="${step.eq}"]`, R.eqs);
  if (step.kind === 'check') return run.stage && $('.checkcards', run.stage);
  if (t === 'substitute') return run.stage && $('.hole', run.stage);
  if (t === 'merge') return run.stage && $('.twin', run.stage);
  if (['factors', 'rows', 'cancel'].includes(t)) return run.stage && $('.rows', run.stage);
  if (step.focus && step.focus.eq != null && R.eqs) return R.eqs.children[step.focus.eq];
  if (step.focus === 'last' || !R.eqs) return R.lines.lastElementChild || R.dstage;
  return R.eqs;
}
function hint() {
  const step = run && run.step;
  if (!step || !step.hints || !step.hints.length || run.hint >= 4) return;
  run.hint++; run.hints++;
  const lvl = run.hint, R = run.R;
  R.hintbox.innerHTML = `<div class="hint" role="status"><span class="lvl" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span><span><span class="sr">Pista ${lvl} de 4: </span>${rich(step.hints[lvl - 1])}</span></div>`;
  R.hintbtn.textContent = lvl < 4 ? 'Otra pista' : 'Sin más pistas';
  R.hintbtn.disabled = lvl >= 4;
  if (lvl >= 2) { const f = focusEl(step); if (f) { f.classList.remove('glow-focus'); void f.offsetWidth; f.classList.add('glow-focus'); } }
}

// ---------- final ----------
function checkRows() {
  const s = run.s;
  if (cur.method === 'cramer' && cur.level === 'desde0') return { cap: 'Resultado', rows: [K(`\\det A = ${texNum(run.dets['\\det A'])}`)] };
  if (s.singular) return { cap: 'Conclusión', rows: [rich(s.singular === 'dependiente' ? 'Infinitas soluciones: las ecuaciones describen la misma recta.' : 'Sin solución: las rectas son paralelas.')] };
  const { x0: x, y0: y } = s;
  return { cap: 'Comprobación', rows: [[s.a, s.b, s.e], [s.c, s.d, s.f]].map(([a, b, e]) => K(`${texNum(a)}\\cdot ${P(x)} ${b.sign < 0 ? '-' : '+'} ${texNum(b.abs())}\\cdot ${P(y)} = ${texNum(e)}`)) };
}
function finish() {
  const R = run.R;
  const pen = run.mistakes + Math.max(0, run.hints - 1) * 0.5;
  const beans = pen === 0 ? 3 : pen <= 2 ? 2 : 1, gain = 10 + 5 * beans;
  st.xp += gain; st.beans += beans; st.solved++;
  st.streak = run.mistakes <= 1 ? st.streak + 1 : 0; st.best = Math.max(st.best, st.streak);
  if (st.day !== today()) { st.day = today(); st.today = 0; }
  st.today++; session++;
  const S = (st.stats[cur.method] ||= {}), c = (S[cur.level] ||= { n: 0, b: 0 }); c.n++; c.b += beans;
  save(); hud(true); grow();
  if (st.today === 5) toast('Meta de hoy cumplida. ¡Buen café!');
  confetti(); SND.done();
  const chk = checkRows();
  const card = el(`<div class="done" role="region" aria-label="Ejercicio resuelto">
    <svg class="cup" viewBox="0 0 110 96" aria-hidden="true"><g class="steam"><path d="M40 30c-6-8 6-12 0-20"/><path d="M55 30c-6-8 6-12 0-20"/><path d="M70 30c-6-8 6-12 0-20"/></g><path d="M22 40h66v18a28 28 0 0 1-28 28h-10a28 28 0 0 1-28-28z" fill="var(--papel)" stroke="var(--cafe)" stroke-width="3"/><path d="M88 46h6a9 9 0 0 1 0 18h-8" fill="none" stroke="var(--cafe)" stroke-width="3"/><ellipse cx="55" cy="42" rx="31" ry="5" fill="var(--cafe)" opacity=".85"/><path d="M14 90h82" stroke="var(--madera)" stroke-width="3" stroke-linecap="round"/></svg>
    <h2>${beans === 3 ? '¡Impecable!' : beans === 2 ? '¡Resuelto!' : '¡Lo lograste!'}</h2>
    <div class="beans" role="img" aria-label="${beans} de 3 granos">${[1, 2, 3].map((i) => `<span class="${i <= beans ? 'on' : ''}"></span>`).join('')}</div>
    <div class="meta"><span><b>+${gain}</b> XP</span><span aria-hidden="true">·</span><span><b>${st.streak}</b> seguidos</span><span aria-hidden="true">·</span><span>meta ${Math.min(st.today, 5)}/5</span></div>
    <div class="check"><span class="cap">${chk.cap}</span>${chk.rows.map((r) => `<div class="row2">${r}</div>`).join('')}</div>
    <div class="btns"><button type="button" class="btn again">Otro ejercicio</button><button type="button" class="btn sec change">Cambiar de método</button></div>
  </div>`);
  if (run.cramer) { R.panel.innerHTML = ''; R.panel.append(card); $('.foot', R.root).classList.add('is-hidden'); R.hintbox.innerHTML = ''; setPrompt('Resuelto'); }
  else { R.panel.innerHTML = ''; R.panel.append(card); dots(); }
  $('.again', card).onclick = () => { newExercise(); window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); };
  $('.change', card).onclick = () => (location.hash = '#/');
  run.step = null;
  live(`Resuelto. Ganaste ${gain} XP y ${beans} de 3 granos.`);
  const again = $('.again', card);
  setTimeout(() => { again.focus({ preventScroll: true }); if (mobile()) card.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }, 60);
}
function confetti() {
  if (reduced()) return;
  const P2 = $('#particles');
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i');
    e.className = ['b', 'l', 's'][i % 3];
    e.style.left = Math.random() * 100 + '%';
    e.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    e.style.animationDelay = Math.random() * 0.3 + 's';
    P2.append(e);
  }
  setTimeout(() => (P2.innerHTML = ''), 3400);
}

// ---------- libreta ----------
function renderLib() {
  $('#stats').innerHTML = [[st.xp, 'XP'], [st.beans, 'granos de café'], [st.solved, 'ejercicios resueltos'], [st.best, 'mejor racha']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#ptable').innerHTML = '<span class="h"></span>' + LEVELS.map((l) => `<span class="h">${LV[l]}</span>`).join('') +
    ORDER.map((m) => `<span>${INFO[m].name}</span>` + LEVELS.map((l) => { const n = st.stats[m]?.[l]?.n || 0; return `<div class="bar" style="--mc:${INFO[m].color}" title="${n} resueltos" role="img" aria-label="${INFO[m].name}, ${LV[l]}: ${n} resueltos"><i style="width:${Math.min(100, n * 10)}%"></i></div>`; }).join('')).join('');
}
let armT;
$('#reset').onclick = () => {
  const b = $('#reset');
  if (!b.classList.contains('reset-armed')) { b.classList.add('reset-armed'); b.textContent = '¿Seguro? Toca otra vez'; clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('reset-armed'); b.textContent = 'Borrar progreso'; }, 3500); return; }
  const keep = { theme: st.theme, sound: st.sound };
  st = Object.assign(DEF(), keep); save(); session = 0; grow(); hud(); renderLib(); renderHome();
  b.classList.remove('reset-armed'); b.textContent = 'Borrar progreso';
  toast('Progreso borrado.');
};
$('#chipXP').onclick = () => { renderLib(); $('#libreta').showModal(); };
$('#libClose').onclick = () => $('#libreta').close();
$('#libreta').addEventListener('click', (e) => { if (e.target.id === 'libreta') $('#libreta').close(); });
$('#setTheme').onclick = cycleTheme;
$('#setSound').onclick = toggleSound;
$('#chipTheme').onclick = cycleTheme;
$('#chipSound').onclick = toggleSound;
$('#brand').onclick = () => (location.hash = '#/');
$('#back').onclick = () => (location.hash = '#/');

document.addEventListener('keydown', (e) => {
  if (!run || !run.step || $('#libreta').open || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (/^[1-9]$/.test(e.key)) {
    const b = $$('.opt', run.R.opts)[+e.key - 1];
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  } else if (e.key === 'h' || e.key === 'H' || e.key === '?') hint();
});

// ---------- arranque ----------
applyTheme(); applySound(); hud(); grow();
route();

// Enganche de solo lectura para pruebas automatizadas
window.__sde = { get run() { return run; }, get state() { return st; } };
