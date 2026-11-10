import {describe,it,expect} from 'vitest';
import {selectBadges,trailStyle} from '../drafts/3d-web/polish';

describe('速度與密集球號',()=>{
  it('靜止與慢球沒有拖尾，加速同時增加長度和亮度，低畫質可關閉',()=>{
    expect(trailStyle(0)).toEqual({length:0,opacity:0});
    expect(trailStyle(220)).toEqual({length:0,opacity:0});
    const fast=trailStyle(1280),boosted=trailStyle(1850);
    expect(boosted.length).toBeGreaterThan(fast.length);
    expect(boosted.opacity).toBeGreaterThan(fast.opacity);
    expect(trailStyle(1850,true)).toEqual({length:0,opacity:0});
    expect(trailStyle(9000)).toEqual(boosted);
  });
  it('密集時保留最高優先球，空間足夠的低優先球仍可讀',()=>{
    expect([...selectBadges([{id:1,x:40,y:40,priority:0},{id:2,x:41,y:42,priority:10},{id:3,x:100,y:40,priority:0}],390,390)])
      .toEqual([2,3]);
  });
  it('同權重不受輸入順序影響；全部可見圓牌彼此分離且不越界',()=>{
    const candidates=Array.from({length:120},(_,i)=>({id:i,x:10+i%12*10,y:10+Math.floor(i/12)*10,priority:i%3}));
    const ids=selectBadges(candidates,390,390);
    expect(selectBadges([...candidates].reverse(),390,390)).toEqual(ids);
    const shown=candidates.filter(b=>ids.has(b.id));expect(shown.length).toBeGreaterThan(1);
    for(const a of shown){expect(a.x).toBeGreaterThanOrEqual(15);expect(a.y).toBeGreaterThanOrEqual(15);
      for(const b of shown)if(a.id!==b.id)expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeGreaterThanOrEqual(30);}
  });
});
