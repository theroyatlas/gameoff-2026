import { describe,it,expect } from 'vitest';
import { Study,CONFIG as C } from '../drafts/3d-web/adapter';
import { Game } from '../src/game';
import { damagePosition,resonanceStyle } from '../drafts/3d-web/presentation';

describe('3D 完整規則與呈現',()=>{
  it('直接使用 Game，未啟動前沒有展示靶或自動時間',()=>{
    expect(Study).toBe(Game);const game=new Study();game.step();expect(game.status).toBe('ready');expect(game.tick).toBe(0);expect(game.monsters).toEqual([]);
  });
  it('自然生成波次直到失敗，重置恢復整個初始快照',()=>{
    const game=new Study(),initial=game.snapshot();game.start();
    while(game.status==='playing'&&game.tick<120*300)game.step();
    expect(game.status).toBe('lost');expect(game.wave).toBeGreaterThan(3);expect(game.monsters.length).toBeGreaterThan(10);
    game.reset();expect(game.snapshot()).toEqual(initial);
  });
  it('半血升級只觸發一次，傷害不回血且 Boss 歸零獲勝',()=>{
    const game=new Study();game.start();game.tick=120*60;game.damage(game.boss,C.boss.hp/2);game.updateDifficulty();
    expect(game.upgraded).toBe(true);const count=game.monsters.length;game.updateDifficulty();expect(game.monsters.length).toBe(count);
    expect(game.boss.hp).toBe(C.boss.hp/2);game.damage(game.boss,C.boss.hp);game.checkOutcome();expect(game.status).toBe('won');
  });
  it('投影傷害字與血條有空隙且不超出窄畫面',()=>{
    const p=damagePosition(180,180,362,390,.2);expect(p.y).toBeLessThan(150);
    expect(damagePosition(-100,-10,362,390,0)).toEqual({x:38,y:22});expect(damagePosition(900,900,362,390,0)).toEqual({x:324,y:366});
  });
  it('共振的環數、亮度與漸進狀態可區別',()=>{
    const cold=resonanceStyle({oscillation:0,resonant:false}),warm=resonanceStyle({oscillation:1,resonant:false}),hot=resonanceStyle({oscillation:2,resonant:true});
    expect(cold.emission).toBeLessThan(warm.emission);expect(warm.emission).toBeLessThan(hot.emission);expect(warm.doubleRing).toBe(false);expect(hot.doubleRing).toBe(true);
  });
});
