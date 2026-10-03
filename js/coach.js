/* =========================================================================
   Coach · guía visual con una mano que enseña qué tocar o arrastrar
   Script clásico y autónomo (no toca el código de la app).

   Coach.init({
     key: 'mi-app-coach',      // dónde se guarda cuánto ha aprendido
     learnAfter: 6,            // toques tras los que la guía deja de insistir
     idle: 9000,               // con experiencia: saltito de ayuda tras este tiempo sin tocar
     color: '#C46A2B',         // color del anillo y la onda
     groups: [                 // en orden de prioridad; se usa el primero que esté visible
       { sel: '.opcion:not(:disabled)', tip: 'Toca la línea que sigue' },
       { sel: '.ficha', drag: '.hueco', tip: 'Arrástrala al hueco' },
       { sel: '.tarjeta-inicio', single: true, noviceOnly: true, tip: 'Empieza aquí' },
     ],
   });
   Coach.reset()  → vuelve a mostrar la guía completa.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var HAND = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="cr" cx="15" cy="5.5" r="4"/><path class="cp" d="M13 18V7.5a2 2 0 0 1 4 0V13a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v6c0 4.6-3.4 8-8 8h-1.2c-2.7 0-4.6-1.2-6-3.3l-4.2-6.1a2 2 0 0 1 3.2-2.4L13 20z"/><path class="cl" d="M17 13v3M21 14v2.5"/></svg>';
  var TIP_X = 20.6, TIP_Y = 6.9; // punta del dedo dentro de la mano de 44 px

  var cfg = null, layer, hand, ring, tip;
  var cur = null;          // { gi, g, items }
  var timers = [];
  var raf = 0, loopFn = null;
  var lastTap = 0, evalT = 0;
  var learned = 0;

  function load() { try { learned = parseInt(localStorage.getItem(cfg.key) || '0', 10) || 0; } catch (e) { learned = 0; } }
  function store() { try { localStorage.setItem(cfg.key, String(learned)); } catch (e) { /* sin almacenamiento */ } }
  function novice() { return learned < (cfg.learnAfter || 6); }

  function injectCSS() {
    var s = doc.createElement('style');
    s.textContent = ''
      + '.coach-layer{position:fixed;inset:0;pointer-events:none;z-index:2147482000}'
      + '.coach-hand{position:fixed;left:0;top:0;width:44px;height:44px;opacity:0;transition:opacity .2s;filter:drop-shadow(0 3px 6px rgba(30,20,10,.22));will-change:transform}'
      + '.coach-hand.on{opacity:1}'
      + '.coach-hand svg{width:100%;height:100%;display:block;overflow:visible}'
      + '.coach-hand .cp{fill:#FFFDF9;stroke:#2B2622;stroke-width:1.6;stroke-linejoin:round}'
      + '.coach-hand .cl{fill:none;stroke:#2B2622;stroke-width:1.6;stroke-linecap:round}'
      + '.coach-hand .cr{fill:none;stroke:var(--coach-color,#C46A2B);stroke-width:2;opacity:0;transform-box:fill-box;transform-origin:center}'
      + '.coach-hand.tap svg{animation:coachTap 1.5s ease-in-out infinite}'
      + '.coach-hand.tap .cr{animation:coachRipple 1.5s ease-out infinite}'
      + '.coach-hand.press svg{transform:scale(.86)}'
      + '.coach-ring{position:fixed;left:0;top:0;border:2px solid var(--coach-color,#C46A2B);border-radius:14px;opacity:0;pointer-events:none}'
      + '.coach-ring.on{animation:coachRing 1.6s ease-out infinite}'
      + '.coach-tip{position:fixed;left:0;top:0;padding:6px 12px;border-radius:999px;background:#1F2A2E;color:#fff;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.18);opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s}'
      + '.coach-tip.on{opacity:1;transform:none}'
      + '@keyframes coachTap{0%{transform:translate(8px,12px);opacity:0}18%{transform:none;opacity:1}40%{transform:scale(.86)}52%{transform:scale(1)}100%{transform:none}}'
      + '@keyframes coachRipple{0%,38%{opacity:0;transform:scale(.4)}45%{opacity:.9}80%,100%{opacity:0;transform:scale(2.4)}}'
      + '@keyframes coachRing{0%{opacity:.9;transform:scale(.98)}100%{opacity:0;transform:scale(1.06)}}'
      + '@media (prefers-reduced-motion:reduce){.coach-hand.tap svg,.coach-hand.tap .cr,.coach-ring.on{animation:none}.coach-ring.on{opacity:.9}}';
    doc.head.appendChild(s);
  }
  function build() {
    layer = doc.createElement('div');
    layer.className = 'coach-layer'; layer.setAttribute('aria-hidden', 'true');
    hand = doc.createElement('div'); hand.className = 'coach-hand'; hand.innerHTML = HAND;
    ring = doc.createElement('div'); ring.className = 'coach-ring';
    tip = doc.createElement('div'); tip.className = 'coach-tip';
    layer.appendChild(ring); layer.appendChild(tip); layer.appendChild(hand);
    if (cfg.color) layer.style.setProperty('--coach-color', cfg.color);
    doc.body.appendChild(layer);
  }

  /* ---------- utilidades ---------- */
  function visible(el) {
    if (!el || !el.isConnected || el.disabled) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity) > 0.05;
  }
  function find() {
    var groups = cfg.groups || [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (g.noviceOnly && !novice()) continue;
      if (g.when && !g.when()) continue;
      var items = Array.prototype.filter.call(doc.querySelectorAll(g.sel), visible);
      if (g.drag && !Array.prototype.some.call(doc.querySelectorAll(g.drag), visible)) continue;
      if (items.length) return { gi: i, g: g, items: g.single ? items.slice(0, 1) : items };
    }
    return null;
  }
  function same(a, b) {
    if (!a || !b || a.gi !== b.gi || a.items.length !== b.items.length) return false;
    for (var i = 0; i < a.items.length; i++) if (a.items[i] !== b.items[i]) return false;
    return true;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function placeHand(x, y) { hand.style.transform = 'translate(' + (x - TIP_X) + 'px,' + (y - TIP_Y) + 'px)'; }
  function tapPoint(el) {
    var r = el.getBoundingClientRect();
    var small = r.width < 70;
    return { x: r.left + r.width * (small ? 0.5 : 0.66), y: r.top + r.height * (small ? 0.55 : 0.62) };
  }
  function placeRing(el) {
    var r = el.getBoundingClientRect();
    var br = el instanceof HTMLElement ? getComputedStyle(el).borderRadius : '50%';
    ring.style.width = (r.width + 10) + 'px'; ring.style.height = (r.height + 10) + 'px';
    ring.style.left = (r.left - 5) + 'px'; ring.style.top = (r.top - 5) + 'px';
    ring.style.borderRadius = br && br !== '0px' ? br : '12px';
  }
  function placeTip(el) {
    if (!tip.textContent) return;
    var r = el.getBoundingClientRect();
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function bob(items) {
    if (reduced()) return;
    items.forEach(function (el, i) {
      if (!(el instanceof HTMLElement) || !el.animate) return;
      el.animate([{ translate: '0 0' }, { translate: '0 -8px' }, { translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 0' }], { duration: 650, delay: i * 110, easing: 'ease-out' });
    });
  }
  function loop() {
    cancelAnimationFrame(raf);
    var step = function (t) { if (!loopFn) return; loopFn(t); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }

  /* ---------- modos ---------- */
  function hide() {
    clearTimers(); loopFn = null; cancelAnimationFrame(raf);
    hand.className = 'coach-hand'; ring.className = 'coach-ring'; tip.className = 'coach-tip';
  }
  function tapCycle(c) {
    var k = 0, target = c.items[0];
    tip.textContent = c.g.tip || '';
    var next = function () {
      var items = c.items.filter(visible);
      if (!items.length) { evaluate(true); return; }
      if (k % items.length === 0) bob(items);
      target = items[k % items.length]; k++;
      hand.className = 'coach-hand';
      void hand.offsetWidth;
      hand.className = 'coach-hand on tap';
      ring.className = 'coach-ring on';
      if (!reduced() && items.length > 1) later(next, 1500);
    };
    loopFn = function () {
      if (!target || !target.isConnected) return;
      var p = tapPoint(target); placeHand(p.x, p.y); placeRing(target); placeTip(c.items[0]);
    };
    later(function () { next(); if (tip.textContent) tip.className = 'coach-tip on'; }, 500);
    loop();
  }
  function dragDemo(c) {
    var from = c.items[0];
    tip.textContent = c.g.tip || '';
    var T = 2300, t0 = performance.now();
    var dest = function () {
      var list = Array.prototype.filter.call(doc.querySelectorAll(c.g.drag), visible);
      return list[0];
    };
    ring.className = 'coach-ring on';
    later(function () { if (tip.textContent) tip.className = 'coach-tip on'; }, 400);
    if (reduced()) {
      hand.className = 'coach-hand on';
      loopFn = function () { var p = tapPoint(from); placeHand(p.x, p.y); placeRing(from); placeTip(from); };
      loop(); return;
    }
    loopFn = function (now) {
      var to = dest();
      if (!from.isConnected || !to) return;
      var a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      var ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var t = ((now - t0) % T) / T;
      var x = ax, y = ay, on = true, press = false;
      if (t < 0.12) { on = t > 0.03; }
      else if (t < 0.22) { press = true; }
      else if (t < 0.7) { press = true; var e = (t - 0.22) / 0.48; e = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2; x = ax + (bx - ax) * e; y = ay + (by - ay) * e; }
      else if (t < 0.82) { x = bx; y = by; }
      else { x = bx; y = by; on = false; }
      hand.className = 'coach-hand' + (on ? ' on' : '') + (press ? ' press' : '');
      placeHand(x, y); placeRing(from); placeTip(from);
    };
    loop();
  }
  function idleWave(c) {
    var again = function () { if (!cur || cur !== c) return; bob(c.items.filter(visible)); later(again, (cfg.idle || 9000) * 1.5); };
    later(again, cfg.idle || 9000);
  }
  function start(c) {
    hide();
    cur = c;
    if (!c) return;
    if (novice() || c.g.always) { if (c.g.drag) dragDemo(c); else tapCycle(c); }
    else idleWave(c);
  }

  /* ---------- evaluación ---------- */
  function evaluate(force) {
    clearTimeout(evalT);
    var wait = 1400 - (Date.now() - lastTap);
    if (wait > 0) { evalT = setTimeout(function () { evaluate(force); }, wait); return; }
    var c = find();
    if (!force && same(c, cur)) return;
    start(c);
  }
  function schedule() { clearTimeout(evalT); evalT = setTimeout(function () { evaluate(false); }, 220); }

  function init(options) {
    if (cfg) return;
    cfg = options || {};
    cfg.key = cfg.key || 'coach';
    load();
    var go = function () {
      injectCSS(); build();
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) if (!layer.contains(records[i].target)) { schedule(); return; }
      }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'hidden', 'style', 'open'] });
      doc.addEventListener('pointerdown', function (e) {
        lastTap = Date.now();
        // cuenta como aprendido cualquier toque sobre algo que la guía enseña
        var t = e.target, hit = false;
        if (t && t.closest) (cfg.groups || []).forEach(function (g) { try { if (!g.noviceOnly && t.closest(g.sel)) hit = true; } catch (err) { /* selector no válido */ } });
        if (hit) { learned++; store(); }
        if (!cur) return;
        hide(); cur = null; schedule();
      }, true);
      doc.addEventListener('keydown', function () { lastTap = Date.now(); }, true);
      addEventListener('resize', schedule);
      lastTap = Date.now() - 600;
      schedule();
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
  }

  window.Coach = {
    init: init,
    reset: function () { learned = 0; store(); cur = null; evaluate(true); },
    stop: function () { hide(); cur = null; },
  };
})();
