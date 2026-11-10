import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=import.meta.dirname,out=resolve(root,'../../artifacts/3d-parity');await mkdir(out,{recursive:true});
const url=pathToFileURL(resolve(root,'dist-parity/index.html')).href+'?quality=low';
const rows=[];
function stats(frames,predicate){
 const intervals=[];
 for(let i=1;i<frames.length;i++)if(predicate(frames[i])&&predicate(frames[i-1]))intervals.push(frames[i].wall-frames[i-1].wall);
 const sum=intervals.reduce((s,x)=>s+x,0),slowest=[...intervals].sort((a,b)=>b-a).slice(0,Math.max(1,Math.ceil(intervals.length*.01)));
 return{frames:intervals.length,seconds:sum/1000,averageFps:1000*intervals.length/sum,onePercentLow:1000/(slowest.reduce((s,x)=>s+x,0)/slowest.length),tailFrames:slowest.length};
}
for(const rate of [4]){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 await page.addInitScript(()=>{
  window.perfFrames=[];const raf=window.requestAnimationFrame;
  window.requestAnimationFrame=callback=>raf.call(window,now=>{
   callback(now);const s=window.studyEvidence?.timing();if(s)window.perfFrames.push({wall:now,...s});
  });
 });
 try{
  await page.goto(url);await page.waitForSelector('#scene[data-ready=true]',{timeout:60000});
  await page.locator('#start').click();
  const gpu=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),attributes:g.getContextAttributes()};});
  for(let i=0;i<32;i++){
   await page.waitForFunction(seconds=>window.studyEvidence.timing().seconds>=seconds,1+i*.8,{timeout:30000,polling:25});
   const p=await page.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),-Math.PI/2+Math.sin(i)*.6);
   await page.mouse.move(p.start.x,p.start.y);await page.mouse.down();await page.mouse.move(p.end.x,p.end.y,{steps:4});await page.mouse.up();
  }
  const calmStart=(await page.evaluate(()=>window.studyEvidence.timing().seconds))+18;
  await page.waitForFunction(end=>window.studyEvidence.timing().seconds>=end,calmStart+10,{timeout:90000,polling:100});
  // 截圖在採樣區間之後，避免截圖成本污染 FPS。
  const state=await page.evaluate(()=>({snapshot:window.studyEvidence.snapshot(),frames:window.perfFrames}));
  const calm=stats(state.frames,f=>f.seconds>=calmStart&&f.seconds<=calmStart+10&&f.phase==='idle');
  const shift=stats(state.frames,f=>f.phase==='active');
  await writeFile(resolve(out,`cpu-${rate}x-raw.json`),JSON.stringify({rate,gpu,calm,shift,errors,requests,...state},null,2));
  console.log(JSON.stringify({rate,calm,shift,shots:state.snapshot.shots,shifts:state.snapshot.shifts,quality:state.snapshot.quality,errors}));
  assert(calm.frames>100&&shift.frames>50,'需要完整平靜與自然相變樣本');
  assert.equal(state.snapshot.shots,32);assert(state.snapshot.shifts.some(s=>s.kind==='release'));
  assert.equal(state.snapshot.quality.antialias,false);assert.equal(state.snapshot.quality.shadowMapSize,512);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);

  if(rate===6){await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const result={rate,calmStart,calmEnd:calmStart+10,channel:'msedge',browser:browser.version(),gpu,calm,shift,errors,requests,...state};
  await writeFile(resolve(out,`cpu-${rate}x.json`),JSON.stringify(result,null,2));
  rows.push({rate,calm,shift,quality:state.snapshot.quality});console.log(JSON.stringify(rows.at(-1)));
 }finally{await browser.close();}
}
await writeFile(resolve(out,'performance.json'),JSON.stringify(rows,null,2));
