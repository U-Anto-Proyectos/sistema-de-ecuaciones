// Ilustraciones de los cuatro rincones (exportadas del componente Figma “Rincón · ilustración”, 320×400).
// Los colores son variables CSS para que respondan al modo claro/oscuro.
let n = 0;

const lamp = (x, end, id) => `
  <path d="M${x} 0V${end}" stroke="var(--s-cable)" stroke-width="1.5" stroke-linecap="round"/>
  <circle class="glowc" cx="${x}" cy="${end + 34}" r="40" fill="var(--luz)" opacity=".35" filter="url(#bl${id})"/>
  <path d="M${x - 18} ${end + 11}a18 15 0 0 1 36 0z" fill="var(--s-madera)"/>
  <ellipse cx="${x}" cy="${end + 13}" rx="6" ry="5" fill="var(--luz)"/>`;

// maceta con hojas; (x, y) = esquina de la maceta; s = escala
const plant = (x, y, s = 1, cls = '') => `
  <g class="${cls}" transform="translate(${x} ${y}) scale(${s})">
    <rect width="26" height="24" rx="4" fill="var(--madera)"/>
    <g fill="var(--hoja)">
      <ellipse cx="-7.4" cy="-13.5" rx="7" ry="15" transform="rotate(30 -7.4 -13.5)"/>
      <ellipse cx="15" cy="-19" rx="7" ry="17"/>
      <ellipse cx="31.6" cy="-18.5" rx="7" ry="15" transform="rotate(-30 31.6 -18.5)"/>
      <ellipse cx="-5.4" cy="-8.8" rx="6" ry="12" transform="rotate(60 -5.4 -8.8)"/>
      <ellipse cx="29.3" cy="-16" rx="6" ry="12" transform="rotate(-55 29.3 -16)"/>
    </g>
  </g>`;

const cup = (x, y, fill = 'var(--s-taza)') => `
  <rect x="${x}" y="${y}" width="20" height="16" rx="5" fill="${fill}"/>
  <path d="M${x + 19} ${y + 3}c8 0 8 10 0 10" stroke="var(--s-taza)" stroke-width="2" stroke-linecap="round" fill="none"/>`;

const defs = (id, sd = 11) => `<defs><filter id="bl${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter></defs>`;
const base = `<rect width="320" height="400" fill="var(--pared)"/><rect y="340" width="320" height="60" fill="var(--piso)"/>`;

const DRAW = {
  sustitucion(id) {
    return `${defs(id)}${base}
      ${lamp(90, 80, id)}${lamp(230, 70, id)}
      <rect x="24" y="120" width="120" height="6" rx="2" fill="var(--madera)"/>
      ${plant(36, 96, 0.9)}
      <rect x="92" y="100" width="14" height="20" rx="3" fill="var(--madera-clara)"/>
      <rect x="110" y="96" width="14" height="24" rx="3" fill="var(--acero)"/>
      <rect x="190" y="112" width="96" height="64" rx="6" fill="var(--pizarra)"/>
      <g fill="var(--tiza)" opacity=".7"><rect x="202" y="126" width="50" height="3" rx="1.5"/><rect x="202" y="140" width="60" height="3" rx="1.5"/><rect x="202" y="154" width="70" height="3" rx="1.5"/></g>
      <rect x="150" y="176" width="112" height="70" rx="12" fill="var(--acero)"/>
      <circle cx="245" cy="191" r="5" fill="var(--s-cable)"/>
      <rect x="168" y="210" width="18" height="16" rx="2" fill="var(--tinta3)"/><rect x="160" y="226" width="34" height="8" rx="3" fill="var(--s-cable)"/>
      <rect x="212" y="210" width="18" height="16" rx="2" fill="var(--tinta3)"/><rect x="204" y="226" width="34" height="8" rx="3" fill="var(--s-cable)"/>
      <rect x="14" y="252" width="292" height="10" rx="4" fill="var(--s-madera)"/>
      <rect x="22" y="262" width="276" height="80" rx="2" fill="var(--madera)"/>
      <g fill="var(--madera-clara)" opacity=".55"><rect x="40" y="276" width="48" height="54" rx="6"/><rect x="108" y="276" width="48" height="54" rx="6"/><rect x="176" y="276" width="48" height="54" rx="6"/><rect x="244" y="276" width="48" height="54" rx="6"/></g>
      ${cup(70, 236)}${cup(106, 236, 'var(--m1)')}
      ${plant(280, 350, 0.8, 'grow-plant')}`;
  },
  igualacion(id) {
    return `${defs(id, 2)}${base}
      <clipPath id="win${id}"><path d="M40 172a120 120 0 0 1 240 0v106H40z"/></clipPath>
      <g clip-path="url(#win${id})">
        <path d="M40 172a120 120 0 0 1 240 0v106H40z" fill="var(--cielo)"/>
        <ellipse cx="80" cy="262" rx="70" ry="60" fill="var(--verdor)"/>
        <ellipse cx="190" cy="267" rx="70" ry="55" fill="var(--verdor)" opacity=".85"/>
        <circle cx="250" cy="252" r="60" fill="var(--verdor)"/>
        <circle cx="230" cy="96" r="20" fill="var(--luz)" filter="url(#bl${id})"/>
        <rect x="158" y="52" width="6" height="226" fill="var(--madera)"/>
        <rect x="40" y="172" width="240" height="6" fill="var(--madera)"/>
      </g>
      <path d="M160 57a115 115 0 0 1 115 115v101H45V172A115 115 0 0 1 160 57z" stroke="var(--madera)" stroke-width="10" fill="none"/>
      <rect x="28" y="276" width="264" height="14" rx="4" fill="var(--madera-clara)"/>
      ${plant(52, 252, 0.8)}${plant(242, 252, 0.8)}
      ${cup(122, 260)}${cup(176, 260, 'var(--m2)')}
      <rect x="96" y="300" width="34" height="8" rx="4" fill="var(--s-madera)"/><rect x="111" y="308" width="4" height="34" fill="var(--s-madera)"/>
      <rect x="196" y="300" width="34" height="8" rx="4" fill="var(--s-madera)"/><rect x="211" y="308" width="4" height="34" fill="var(--s-madera)"/>
      ${plant(20, 350, 0.8, 'grow-plant')}`;
  },
  eliminacion(id) {
    return `${defs(id)}${base}
      ${lamp(70, 90, id)}${lamp(160, 100, id)}${lamp(250, 90, id)}
      <rect x="34" y="110" width="70" height="90" rx="6" fill="var(--madera-clara)"/>
      <rect x="42" y="118" width="54" height="74" rx="4" fill="var(--verdor)" opacity=".8"/>
      ${plant(236, 150, 0.9)}
      <rect x="220" y="176" width="60" height="6" rx="2" fill="var(--madera)"/>
      <rect x="12" y="262" width="296" height="14" rx="4" fill="var(--s-madera)"/>
      <rect x="26" y="276" width="8" height="64" fill="var(--s-madera)"/><rect x="286" y="276" width="8" height="64" fill="var(--s-madera)"/>
      ${cup(60, 246)}${cup(112, 246, 'var(--m3)')}${cup(190, 246, 'var(--m3)')}${cup(242, 246)}
      <rect x="4" y="230" width="26" height="110" rx="8" fill="var(--madera)" opacity=".9"/>
      <rect x="290" y="230" width="26" height="110" rx="8" fill="var(--madera)" opacity=".9"/>
      ${plant(150, 352, 0.7, 'grow-plant')}`;
  },
  cramer(id) {
    const A = 'var(--libro-a)', B = 'var(--libro-b)', C = 'var(--libro-c)', D = 'var(--libro-d)', M = 'var(--m4)';
    const shelf = (y, books) => books.map(([x, by, w, h, f]) => `<rect x="${x}" y="${by}" width="${w}" height="${h}" rx="2" fill="${f}"${f === M ? '' : ' opacity=".9"'}/>`).join('') + `<rect x="38" y="${y}" width="180" height="6" fill="var(--madera)"/>`;
    return `${defs(id)}${base}
      <rect x="30" y="48" width="196" height="292" rx="6" fill="var(--madera)"/>
      <rect x="38" y="56" width="180" height="276" rx="2" fill="var(--s-madera)" opacity=".55"/>
      ${shelf(120, [[44, 80, 10, 40, A], [57, 67, 17, 53, B], [77, 70, 15, 50, C], [95, 73, 13, 47, D], [111, 76, 11, 44, A], [125, 79, 18, 41, B], [146, 66, 16, 54, C], [165, 69, 14, 51, D], [182, 72, 12, 48, A], [197, 75, 10, 45, B]])}
      ${shelf(188, [[44, 135, 17, 53, B], [64, 138, 15, 50, C], [82, 141, 13, 47, D], [98, 144, 11, 44, A], [112, 147, 18, 41, M], [133, 134, 16, 54, M], [152, 137, 14, 51, D], [169, 140, 12, 48, A], [184, 143, 10, 45, B], [197, 146, 17, 42, C]])}
      ${shelf(256, [[44, 206, 15, 50, C], [62, 209, 13, 47, D], [78, 212, 11, 44, A], [92, 215, 18, 41, B], [113, 202, 16, 54, M], [132, 205, 14, 51, M], [149, 208, 12, 48, M], [164, 211, 10, 45, B], [177, 214, 17, 42, C], [197, 201, 15, 55, D]])}
      ${shelf(324, [[44, 277, 13, 47, D], [60, 280, 11, 44, A], [74, 283, 18, 41, B], [95, 270, 16, 54, C], [114, 273, 14, 51, D], [131, 276, 12, 48, A], [146, 279, 10, 45, B], [159, 282, 17, 42, C], [179, 269, 15, 55, D], [197, 272, 13, 52, A]])}
      <rect x="97" y="113" width="56" height="134" rx="7" stroke="var(--miel)" stroke-width="2" stroke-dasharray="5 4" fill="none"/>
      <rect x="236" y="250" width="74" height="56" rx="18" fill="${M}" opacity=".75"/>
      <rect x="230" y="236" width="20" height="76" rx="10" fill="${M}"/>
      <rect x="240" y="300" width="6" height="40" fill="var(--s-madera)"/><rect x="296" y="300" width="6" height="40" fill="var(--s-madera)"/>
      <path d="M290 70V240" stroke="var(--s-cable)" stroke-width="2" stroke-linecap="round"/>
      <path d="M272 73a20 13 0 0 1 40 0z" fill="var(--s-madera)"/>
      <circle class="glowc" cx="291" cy="95" r="35" fill="var(--luz)" opacity=".35" filter="url(#bl${id})"/>
      ${plant(250, 354, 0.7, 'grow-plant')}`;
  },
};

export function vignette(method, cls = 'vig') {
  const id = 'v' + (++n);
  return `<svg class="${cls}" viewBox="0 0 320 400" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">${DRAW[method](id)}</svg>`;
}

const U = (id) => `https://images.unsplash.com/photo-${id}?w=480&q=50&auto=format&fit=crop`;
export const PHOTOS = {
  home: U('1732472613570-8618d77339dd'),
  sustitucion: U('1782146524089-7fb5a3b52914'),
  igualacion: U('1771308134982-f72fe5d7ab3b'),
  eliminacion: U('1774576752179-3408c26b774f'),
  cramer: U('1690271965447-f873ea9b3448'),
};

export const INFO = {
  sustitucion: { n: 1, name: 'Sustitución', place: 'La barra', color: 'var(--m1)', mini: 'sub' },
  igualacion: { n: 2, name: 'Igualación', place: 'La ventana', color: 'var(--m2)', mini: 'igu' },
  eliminacion: { n: 3, name: 'Eliminación', place: 'La mesa larga', color: 'var(--m3)', mini: 'eli' },
  cramer: { n: 4, name: 'Cramer', place: 'La biblioteca', title: 'Laboratorio de la biblioteca', color: 'var(--m4)', mini: 'cra' },
};
