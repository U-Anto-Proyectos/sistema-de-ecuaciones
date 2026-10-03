/* =========================================================================
   Guardia de la app · sin zoom y con aviso antes de actualizar
   Script clásico (no módulo): se carga en el <head> para actuar desde el inicio.
   Opcional: window.leaveGuard = () => true/false decide cuándo pedir confirmación.
   ========================================================================= */
(function () {
  'use strict';
  var doc = document;
  var opt = { passive: false };

  /* ---------- 1. sin zoom ---------- */
  // CSS: sin zoom por doble toque ni pellizco, sin "jalar para actualizar" y sin rebote
  var css = doc.createElement('style');
  css.textContent = 'html{touch-action:pan-x pan-y;overscroll-behavior:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}'
    + 'body{touch-action:pan-x pan-y;overscroll-behavior:none}'
    + 'button,a,[role=button],input,select,label{touch-action:manipulation}';
  doc.head.appendChild(css);

  var stop = function (e) { if (e.cancelable) e.preventDefault(); };
  // Safari (iPhone/iPad/Mac): gestos de pellizco
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { doc.addEventListener(t, stop, opt); });
  // dos dedos en pantalla = intento de zoom
  doc.addEventListener('touchstart', function (e) { if (e.touches && e.touches.length > 1) stop(e); }, opt);
  doc.addEventListener('touchmove', function (e) {
    if ((e.touches && e.touches.length > 1) || (typeof e.scale === 'number' && e.scale !== 1)) stop(e);
  }, opt);
  // doble toque rápido fuera de botones (los botones ya tienen touch-action: manipulation)
  var lastTouch = 0;
  doc.addEventListener('touchend', function (e) {
    var now = Date.now();
    var t = e.target;
    var interactive = t && t.closest && t.closest('button,a,input,select,textarea,label,[role=button],[draggable=true]');
    if (!interactive && now - lastTouch < 320) stop(e);
    lastTouch = now;
  }, opt);
  // computadora: Ctrl/Cmd + rueda y Ctrl/Cmd + (+ − 0)
  window.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) stop(e); }, opt);

  /* ---------- 2. aviso antes de actualizar ---------- */
  var allowLeave = false;
  var touched = false; // los navegadores solo muestran el aviso si la persona ya tocó la página
  ['pointerdown', 'keydown'].forEach(function (t) { doc.addEventListener(t, function () { touched = true; }, { capture: true, passive: true }); });
  var guardOn = function () {
    if (allowLeave || !touched) return false;
    try { return typeof window.leaveGuard === 'function' ? !!window.leaveGuard() : true; } catch (err) { return true; }
  };

  // botón de actualizar del navegador, cerrar pestaña, jalar hacia abajo: aviso nativo
  // (el texto lo pone el navegador; no se puede personalizar)
  window.addEventListener('beforeunload', function (e) {
    if (!guardOn()) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });

  // F5, Ctrl/Cmd + R: aviso propio, con nuestro texto
  var dialog = null;
  function closeDialog() { if (dialog) { dialog.remove(); dialog = null; } }
  function askReload() {
    if (dialog) return;
    var prev = doc.activeElement;
    dialog = doc.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'guard-t');
    dialog.setAttribute('aria-describedby', 'guard-d');
    dialog.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;background:rgba(18,23,25,.42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:guardIn .18s ease both';
    dialog.innerHTML = '<style>@keyframes guardIn{from{opacity:0}to{opacity:1}}@keyframes guardUp{from{transform:translateY(10px) scale(.98)}to{transform:none}}'
      + '.guard-card{width:100%;max-width:340px;padding:22px 20px 16px;border-radius:22px;background:var(--superficie,var(--papel,#fff));color:var(--tinta,#1F2A2E);box-shadow:0 24px 60px rgba(0,0,0,.25);font:500 15px/1.4 var(--ui,system-ui,-apple-system,sans-serif);text-align:center;animation:guardUp .22s cubic-bezier(.2,.8,.2,1) both}'
      + '.guard-card h2{margin:0 0 6px;font:600 18px/1.25 var(--ui,system-ui,sans-serif)}'
      + '.guard-card p{margin:0 0 16px;color:var(--tinta-2,var(--tinta2,#55606A))}'
      + '.guard-card button{display:block;width:100%;min-height:46px;margin-top:8px;border-radius:999px;font:600 15px var(--ui,system-ui,sans-serif);cursor:pointer;border:1px solid transparent}'
      + '.guard-stay{background:var(--boton,var(--tinta,#1F2A2E));color:var(--boton-texto,var(--superficie,var(--papel,#fff)))}'
      + '.guard-go{background:transparent;color:var(--tinta-2,var(--tinta2,#55606A))}'
      + '@media (prefers-reduced-motion:reduce){[role=alertdialog],.guard-card{animation:none!important}}</style>'
      + '<div class="guard-card"><h2 id="guard-t">¿Actualizar la página?</h2>'
      + '<p id="guard-d">Tal vez se pierda el avance del ejercicio que estás resolviendo.</p>'
      + '<button class="guard-stay" type="button">Seguir aquí</button>'
      + '<button class="guard-go" type="button">Actualizar de todos modos</button></div>';
    doc.body.appendChild(dialog);
    var stay = dialog.querySelector('.guard-stay');
    var go = dialog.querySelector('.guard-go');
    var done = function () { closeDialog(); if (prev && prev.focus) prev.focus({ preventScroll: true }); };
    stay.addEventListener('click', done);
    go.addEventListener('click', function () { allowLeave = true; location.reload(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) done(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); done(); }
      if (e.key === 'Tab') { e.preventDefault(); (doc.activeElement === stay ? go : stay).focus(); }
    });
    stay.focus({ preventScroll: true });
  }

  doc.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    // zoom con el teclado
    if (mod && (k === '+' || k === '-' || k === '=' || k === '0' || k === '_' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) { e.preventDefault(); return; }
    // actualizar con el teclado
    if (k === 'f5' || (mod && k === 'r')) {
      if (!guardOn()) return;
      e.preventDefault();
      e.stopPropagation();
      askReload();
    }
  }, true);

  window.appGuard = { allow: function () { allowLeave = true; }, ask: askReload };
})();
