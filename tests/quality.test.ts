import { describe, expect, it } from 'vitest';
import { AdaptiveQuality } from '../drafts/3d-web/quality';

function frames(q: AdaptiveQuality, fps: number, seconds: number) {
  for (let i=0;i<fps*seconds;i++) q.sample(1000/fps);
}
describe('3D 自動降畫質',()=>{
  it('暖機及短暫卡頓不降級',()=>{
    const q=new AdaptiveQuality();frames(q,30,2);expect(q.level).toBe(0);
    frames(q,60,1);q.sample(150);frames(q,60,2);expect(q.level).toBe(0);
  });
  it('持續不足 45 FPS 依序下降三級且不超出',()=>{
    const q=new AdaptiveQuality();frames(q,30,2.1);
    frames(q,30,3);expect(q.level).toBe(1);
    frames(q,30,3);expect(q.level).toBe(2);
    frames(q,30,3);expect(q.level).toBe(3);
    frames(q,30,30);expect(q.level).toBe(3);
  });
  it('45 FPS 不降級，隱藏與恢復清除尚未完成的視窗',()=>{
    const q=new AdaptiveQuality();frames(q,45,15);expect(q.level).toBe(0);
    frames(q,20,2);q.resetWindow();frames(q,60,8);expect(q.level).toBe(0);
  });
});
