import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const result=await build({entryPoints:['adapter.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {Study,CONFIG:C}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const angles=[-1.25,-1.9,-.92,-2.2,-1.5,-.6,-2.5,-1.15,-2,-.8,-2.3,-1.7,-1.05,-2.65,-1.45];
const trials=[];
for(const interval of [144,180,204,216])for(const pattern of ['spread','center']){
  const game=new Study(),inputAngles=pattern==='spread'?angles:angles.map(()=>-Math.PI/2);
  for(let tick=0;tick<120*40;tick++){
    const shot=Math.floor((tick-120)/interval);
    if(tick>=120&&(tick-120)%interval===0&&shot<15)game.fire(inputAngles[shot]);
    game.step();
  }
  trials.push({interval,pattern,shots:game.shots,shifts:game.shifts.map(s=>({...s,seconds:s.tick*C.dt})),maxDepth:Math.max(0,...game.events.map(e=>e.depth)),stopped:game.balls.filter(b=>b.vx===0&&b.vy===0).length,angles:inputAngles});
}
await writeFile('evidence/simulation.json',JSON.stringify(trials,null,2));console.log(JSON.stringify(trials.map(({angles,...s})=>s)));
