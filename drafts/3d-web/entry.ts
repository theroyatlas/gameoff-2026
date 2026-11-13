import { language } from './language';
import { startRealtime } from './main';
import { startBoard } from './board-ring';
import './language.css';

document.documentElement.lang = language.current;
// Preload the bundled card face before any Canvas text is drawn.
await document.fonts.load('700 32px "Kalam Cards"').catch(() => undefined);
if (new URLSearchParams(location.search).get('mode') === 'realtime') startRealtime();
else startBoard();
