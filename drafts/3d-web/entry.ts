import { startRealtime } from './main';
import { startBoard } from './board-ring';

if (new URLSearchParams(location.search).get('mode') === 'realtime') startRealtime();
else startBoard();
