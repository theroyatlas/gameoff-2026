import { Game, type Target } from '../../src/game';
import { CONFIG } from '../../src/config';
export { CONFIG };

/** 展示轉接：固定四角靶、不結算勝負；碰撞、共振及相變仍由 Game 執行。 */
export class Study extends Game {
  constructor(seed = CONFIG.seed) {
    super(seed);
    this.monsters = [[66,66],[734,66],[66,614],[734,614]].map(([x,y], i) => ({
      id: -i-1, kind:'monster', x, y, radius:26, hp:1000000, maxHp:1000000, flashUntil:0,
    }));
    this.start();
  }
  updateDifficulty() {}
  checkOutcome() {}
  damage(target:Target, amount:number) {
    const actual = super.damage(target, amount);
    target.hp = target.maxHp;
    return actual;
  }
}
