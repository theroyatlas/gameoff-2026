# Resonance

[繁體中文](README.zh-TW.md)

Roll around a handcrafted 14-tile board, launch balls into the central field, and turn collisions into resonance chains to defeat the Boss.

English is the default. Select **中文** or **English** in the header to switch at any time without resetting the board. Your browser remembers the choice when local storage is available; if reading storage fails, the game opens in English.

## How to play

1. Select **Start**, then **Roll**. The pawn moves clockwise and activates its landing tile.
2. Fire 3 shots per turn. Click the field, or drag and release to aim and fire. Arrow keys aim; Space rolls or fires. The aim slider and **Fire** button also work.
3. SURGE wakes every ball and adds charge. TUNE strengthens one material for the turn. Passing START earns 1 extra shot for the next turn. EVENT draws one of six cards: One More Shot, Material Swap, Clock Rewind, Double Resonance, Release Now and Core Tap. When a card is drawn, its face shows the effect.
4. After firing, wait for balls to settle (up to 6 seconds). The Boss clock advances by 1. A wave arrives the **first time the clock reaches 3, 6, 9…**. Clock Rewind moves it back by 1; revisiting an already reached threshold does not spawn that wave again.
5. Reduce the Boss to zero HP to win. More than 10 monsters ends the game. Select **Restart** to return to setup. In the same browser, you can play again with the same seed.

**Inspect balls** lets touch players identify a ball without firing. Hover with a mouse, or use the arrow keys on the field in inspect mode; Esc exits inspection. Sound starts after your first interaction. The game respects reduced-motion preferences.

## Run locally

Requires Node.js and npm. From the repository root:

```sh
npm install
npm --prefix drafts/3d-web install
npm run dev
```

Open the local URL printed by Vite. Test and build:

```sh
npm test
npm run build:main
```

The regular build is `drafts/3d-web/dist-main/index.html`. It can be opened directly in a WebGL-enabled browser, offline. Fonts are bundled; runtime makes no external requests. The project code is MIT; the bundled Kalam font is SIL OFL 1.1, documented in [ASSETS.md](ASSETS.md).

## URL options

| Option | Behavior |
| --- | --- |
| No options, or `?mode=board` | Official board mode |
| `?mode=realtime` | Realtime mode, with continuous firing and time-based waves |
| `?ball=a` / `b` / `c` | Wood, red lacquer and blue clay (default a) / glass, steel and brass / weathered materials |
| `?icon=a` / `b` / `c` | Fine ink / broad marker (default b) / printed cards |
| `?light=a` / `b` / `c` | Focused warm / soft warm / low-angle warm (default c) |
| `?ui=a` / `b` / `c` | Paper controls (default a) / walnut frame / yarn and warm light |
| `?cage=a` / `b` / `c` | Wire cage / yarn and wooden posts (default b) / paper lantern |
| `?card=a` / `b` / `c` | Hand-drawn paper (default a) / printed card / walnut and brass plaque; click to skip the reveal |
| `?ring=1` | Show the decorative ring in realtime mode; board mode always includes its required ring |

Options can be combined with `&`, for example `?mode=realtime&ball=c&icon=b&light=b&ring=1`.

## License

[MIT](LICENSE) © 2026 theroyatlas. Font license: [SIL OFL 1.1](drafts/3d-web/fonts/OFL-Kalam.txt).
