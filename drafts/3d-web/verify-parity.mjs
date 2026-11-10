import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const out=resolve(import.meta.dirname,'../../artifacts/3d-parity');await mkdir(out,{recursive:true});
const url=pathToFileURL(resolve(import.meta.dirname,'dist-parity/index.html')).href;
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1,recordVideo:{dir:resolve(out,'video'),size:{width:1280,height:950}}});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
let result;
try{
 await page.goto(url);await page.waitForSelector('#scene[data-ready=true]',{timeout:60000});
 assert(await page.locator('#overlay').isVisible());
 const initial=await page.evaluate(()=>window.studyEvidence.snapshot());assert.equal(initial.hud.audio,'not-started');assert.equal(initial.game.status,'ready');
 await page.screenshot({path:resolve(out,'start-desktop.png'),fullPage:true});
 await page.locator('#start').click();
 let next=1,shot=0,phaseShot=false,replaySeen=false,waveSeen=false,chainSeen=false,lastProgress=0;
 while(true){
  const s=await page.evaluate(()=>window.studyEvidence.snapshot());
  if(s.seconds-lastProgress>30){lastProgress=s.seconds;console.log(JSON.stringify({seconds:s.seconds,status:s.game.status,boss:s.game.boss.hp,wave:s.game.wave,shots:s.shots,phase:s.phase}));}
  if(s.game.wave>0&&await page.locator('#wave-banner').isVisible())waveSeen=true;
  if(await page.locator('#replay').isVisible())replaySeen=true;
  if(await page.locator('.chain').count()>0)chainSeen=true;
  if(s.phase==='active'&&!phaseShot){await page.screenshot({path:resolve(out,'shift-desktop.png'),fullPage:true});phaseShot=true;}
  if(s.game.status!=='playing'){result=s;break;}
  assert(s.seconds<600,'一局需在 600 秒內結束');
  if(s.seconds>=next){const a=-Math.PI/2+Math.sin(shot)*.6;
   const p=await page.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),a);
   await page.mouse.move(p.start.x,p.start.y);await page.mouse.down();await page.mouse.move(p.end.x,p.end.y,{steps:2});await page.mouse.up();
   shot++;next+=shot<32?.8:2;
  }
  await page.waitForTimeout(70);
 }
 assert(phaseShot&&waveSeen&&replaySeen&&chainSeen,JSON.stringify({phaseShot,waveSeen,replaySeen,chainSeen}));
 assert(result.counts.ignite>0&&result.counts.release>0&&result.maxDepth>=2);assert(result.hud.notes>0);assert(await page.locator('#overlay').isVisible());
 await page.screenshot({path:resolve(out,'outcome-desktop.png'),fullPage:true});
 await page.locator('#start').click();await page.waitForTimeout(200);
 const reset=await page.evaluate(()=>window.studyEvidence.snapshot());assert.deepEqual(reset.game,initial.game);assert.equal(reset.visuals.balls,0);assert.equal(reset.visuals.cages,0);assert.equal(reset.visuals.particles,0);assert.equal(reset.hud.labels,0);assert.equal(reset.hud.replays,0);assert.deepEqual(reset.counts,{});
 await page.locator('#mute').click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
 await page.locator('#start').click();await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.studyEvidence.snapshot())).shots,1);
 const video=page.video();await page.close();await context.close();const videoPath=await video.path();
 for(const args of [
  ['-y','-i',videoPath,'-t','40','-an','-c:v','libvpx-vp9','-crf','35','-b:v','0','-cpu-used','4','-threads','4',resolve(out,'demo-40s.webm')],
  ['-y','-i',resolve(out,'demo-40s.webm'),'-vf','fps=3/10,scale=426:-1,tile=4x3','-frames:v','1',resolve(out,'sheet.png')]
 ]){const proc=spawnSync('ffmpeg',args,{encoding:'utf8'});assert.equal(proc.status,0,proc.stderr);}
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mobileContext.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await mobile.goto(url);await mobile.waitForSelector('#scene[data-ready=true]');await mobile.screenshot({path:resolve(out,'start-mobile.png'),fullPage:true});
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.locator('#start').tap();
 const cdp=await mobileContext.newCDPSession(mobile);
 for(let i=0;i<32;i++){
  await mobile.waitForFunction(t=>window.studyEvidence.timing().seconds>=t,1+i*.8,{timeout:30000});
  const p=await mobile.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),-Math.PI/2+Math.sin(i)*.6);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p.start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p.end]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(await mobile.evaluate(()=>window.studyEvidence.timing().phase==='active')){await mobile.screenshot({path:resolve(out,'shift-mobile.png'),fullPage:true});break;}
 }
 const mobileState=await mobile.evaluate(()=>window.studyEvidence.snapshot());assert(mobileState.shots>0);assert.equal(mobileState.phase,'active');await mobileContext.close();
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(resolve(out,'edge.json'),JSON.stringify({channel:'msedge',browser:browser.version(),errors,requests,seen:{phaseShot,waveSeen,replaySeen,chainSeen},initial,final:result,reset,mobile:mobileState,videoSeconds:40},null,2));
 console.log(JSON.stringify({pass:true,status:result.game.status,seconds:result.seconds,shots:result.shots,maxDepth:result.maxDepth,shifts:result.shifts.length,replays:result.hud.replays,errors,reset:true,mobileShots:mobileState.shots}));
}catch(error){await writeFile(resolve(out,'failed-run.json'),JSON.stringify({error:String(error),errors,state:page.isClosed()?result:await page.evaluate(()=>window.studyEvidence?.snapshot()).catch(()=>null)},null,2));throw error;}
finally{await browser.close();}
