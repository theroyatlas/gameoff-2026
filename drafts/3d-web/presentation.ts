import { CONFIG as C } from './adapter';
import type { Ball } from '../../src/game';

/** 投影後以 CSS 像素排版，數字保留在血條上方。 */
export function damagePosition(x:number,y:number,width:number,height:number,age:number) {
  return { x:Math.max(38,Math.min(width-38,x)), y:Math.max(22,Math.min(height-24,y-38-age*32)) };
}
export function resonanceStyle(ball:Pick<Ball,'resonant'|'oscillation'>) {
  const progress=Math.max(0,Math.min(1,ball.oscillation/C.resonance.threshold));
  return {progress,emission:ball.resonant?1.5:progress*.6,opacity:ball.resonant?1:.15+progress*.65,doubleRing:ball.resonant};
}
