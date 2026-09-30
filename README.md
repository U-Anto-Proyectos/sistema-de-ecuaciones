# Sistemas de ecuaciones · con el prof. Anto

Web interactiva para aprender a resolver sistemas de ecuaciones lineales 2×2, paso a paso, en una cafetería con cuatro rincones:

| # | Método | Rincón | Interacción principal |
|---|--------|--------|-----------------------|
| 1 | Sustitución | La barra | La expresión despejada entra (arrastrando o tocando) donde estaba la incógnita. |
| 2 | Igualación | La ventana | Los dos despejes se unen en el centro. |
| 3 | Eliminación | La mesa larga | Filas alineadas, multiplicadores y términos opuestos que desaparecen. |
| 4 | Cramer | La biblioteca | Laboratorio: armar A y B, recorrer diagonales, intercambiar columnas para Dₓ y Dᵧ. Considera D = 0. |

Cada método tiene cuatro niveles: **Desde 0 · Bajo · Medio · Alto**. Todos los métodos están abiertos desde el inicio.

## Cómo funciona

- **No es trivia:** cada opción es una posible *siguiente línea* del procedimiento y la solución se escribe línea por línea en la hoja.
- **Generador controlado** (`js/gen.js`): el sistema se construye a partir de su solución, con aritmética racional exacta (`js/q.js`). Cada paso correcto se verifica; los distractores son errores reales (signos, paréntesis, orden, división…), se descartan si resultan equivalentes a la línea correcta y cada uno trae su retroalimentación breve.
- **Pistas progresivas** de 4 niveles: concepto → resaltar → operación → paso parcial.
- **Progreso** (XP, granos de café, racha, meta diaria de 5) guardado solo en este navegador (`localStorage`), con opción de borrarlo en la libreta.
- Modo **claro / oscuro / sistema**, sonido opcional (silenciado por defecto), teclado (1–4 para elegir, H para pista), lector de pantalla y movimiento reducido.

## Estructura

```
index.html          página única
css/styles.css      sistema visual (del archivo Figma “Sistemas de ecuaciones — UI”)
js/app.js           interfaz y flujo de pasos
js/gen.js           generador de sistemas y procedimientos
js/expr.js          expresiones lineales y LaTeX
js/q.js             números racionales exactos
js/scene.js         ilustraciones de los rincones (SVG)
vendor/katex/       KaTeX 0.16 (local, sin CDN)
tests/gen.test.mjs  verificación masiva del generador
```

## Probar

```bash
npm test                       # verifica miles de ejercicios por método y nivel
python3 -m http.server 8000    # y abrir http://localhost:8000
```

Se publica tal cual con GitHub Pages (rama `main`, carpeta raíz). Enlaces directos por método y nivel: `#/sustitucion/bajo`, `#/cramer/alto`, etc.

## Créditos

Fotos de ambiente desenfocadas de [Unsplash](https://unsplash.com): Zhaoli JIN, Maxim Tolchinskiy, Jason Leung, Phước Sang y Fairuz Naufal Zaki. Tipografías: Newsreader e Inter (Google Fonts). Matemáticas: [KaTeX](https://katex.org) (licencia MIT).
