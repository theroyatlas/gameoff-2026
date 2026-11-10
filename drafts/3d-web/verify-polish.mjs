import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const out=resolve(import.meta.dirname,'../../artifacts/3d-polish');await mkdir(out,{recursive:true});
const url=pathToFileURL(resolve(import.meta.dirname,'dist-polish/index.html')).href;
const resume=process.argv.includes('--resume');
const {createHash}=await import('node:crypto');const buildSha256=createHash('sha256').update(await readFile(resolve(import.meta.dirname,'dist-polish/index.html'))).digest('hex');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1,recordVideo:{dir:resolve(out,'video'),size:{width:1280,height:950}}});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
function checkBadges(s){for(const a of s.visuals.badges)for(const b of s.visuals.badges)if(a.id!==b.id)assert(Math.hypot(a.x-b.x,a.y-b.y)>=30,'球號不可重疊');}
let result;
try{
 let initial,reset,phaseShot=false,replaySeen=false,waveSeen=false,chainSeen=false;
 if(!resume){
 await page.goto(url);await page.waitForSelector('#scene[data-ready=true]',{timeout:60000});
 assert(await page.locator('#overlay').isVisible());
 initial=await page.evaluate(()=>window.studyEvidence.snapshot());assert.equal(initial.hud.audio,'not-started');assert.equal(initial.game.status,'ready');
 await page.screenshot({path:resolve(out,'start-desktop.png'),fullPage:true});
 await page.locator('#start').click();
 let next=1,shot=0,lastProgress=0,denseShot=false;
 while(true){
  const s=await page.evaluate(()=>window.studyEvidence.snapshot());checkBadges(s);assert.equal(s.visuals.trails,0);
  if(s.seconds-lastProgress>30){lastProgress=s.seconds;console.log(JSON.stringify({seconds:s.seconds,status:s.game.status,boss:s.game.boss.hp,wave:s.game.wave,shots:s.shots,phase:s.phase}));}
  if(s.game.wave>0&&await page.locator('#wave-banner').isVisible())waveSeen=true;
  if(await page.locator('#replay').isVisible())replaySeen=true;
  if(await page.locator('.chain').count()>0)chainSeen=true;
  if(s.phase==='active'&&s.shots>=15&&s.visuals.visibleBadges<s.visuals.balls&&!phaseShot){await page.screenshot({path:resolve(out,'shift-desktop.png'),fullPage:true});await writeFile(resolve(out,'visual-desktop.json'),JSON.stringify(s,null,2));phaseShot=true;}
  if(!denseShot&&s.shots>=45&&s.visuals.visibleBadges<s.visuals.balls){await page.screenshot({path:resolve(out,'dense-desktop.png'),fullPage:true});await writeFile(resolve(out,'visual-desktop-dense.json'),JSON.stringify(s,null,2));denseShot=true;}
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
 assert.equal(result.game.status,'won');assert(result.counts.ignite>0&&result.counts.release>0&&result.maxDepth>=2);assert(result.hud.notes>0);assert(await page.locator('#overlay').isVisible());
 await page.screenshot({path:resolve(out,'won-desktop.png'),fullPage:true});
 await page.locator('#start').click();await page.waitForTimeout(200);
 reset=await page.evaluate(()=>window.studyEvidence.snapshot());assert.deepEqual(reset.game,initial.game);assert.equal(reset.visuals.balls,0);assert.equal(reset.visuals.cages,0);assert.equal(reset.visuals.particles,0);assert.equal(reset.hud.labels,0);assert.equal(reset.hud.replays,0);assert.deepEqual(reset.counts,{});
 await page.locator('#mute').click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
 await page.locator('#start').click();await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.studyEvidence.snapshot())).shots,1);
 const video=page.video();await page.close();await context.close();
 await video.saveAs(resolve(out,'won-full.webm'));
 await writeFile(resolve(out,'win.json'),JSON.stringify({buildSha256,initial,reset,seen:{phaseShot,waveSeen,replaySeen,chainSeen},pageAndConsoleErrors:errors,requests,final:result},null,2));
 }else{const saved=JSON.parse(await readFile(resolve(out,'win.json'),'utf8'));assert.equal(saved.buildSha256,buildSha256,'Cannot resume evidence from a different build');initial=saved.initial;reset=saved.reset;({phaseShot,waveSeen,replaySeen,chainSeen}=saved.seen);result=saved.final;assert.equal(result.game.status,'won');assert.deepEqual(saved.pageAndConsoleErrors,[]);await page.close();await context.close();}

 const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mobileContext.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await mobile.goto(url);await mobile.waitForSelector('#scene[data-ready=true]');await mobile.screenshot({path:resolve(out,'start-mobile.png'),fullPage:true});
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.locator('#start').tap();
 const cdp=await mobileContext.newCDPSession(mobile);let mobileCaptured=false;
 for(let i=0;i<80;i++){
  await mobile.waitForFunction(t=>window.studyEvidence.timing().seconds>=t,1+i*.8,{timeout:30000});
  const p=await mobile.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),-Math.PI/2+Math.sin(i)*.6);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p.start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p.end]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const visual=await mobile.evaluate(()=>window.studyEvidence.snapshot());checkBadges(visual);if(i%10===9){console.log(JSON.stringify({mobileShots:visual.shots,phase:visual.phase,trails:visual.visuals.trails,quality:visual.quality.level}));await writeFile(resolve(out,'mobile-progress.json'),JSON.stringify(visual,null,2));}
  if(visual.shots>=32&&visual.visuals.visibleBadges<visual.visuals.balls){await mobile.screenshot({path:resolve(out,'dense-mobile.png')});await mobile.screenshot({path:resolve(out,'dense-mobile-full.png'),fullPage:true});await writeFile(resolve(out,'visual-mobile.json'),JSON.stringify(visual,null,2));mobileCaptured=true;break;}
 }
 assert(mobileCaptured,'需要取得預設無拖尾的密集手機截圖');assert(await mobile.locator('#scene').isVisible());
 const mobileState=await mobile.evaluate(()=>window.studyEvidence.snapshot());await writeFile(resolve(out,'mobile-final.json'),JSON.stringify(mobileState,null,2));assert.equal(mobileState.visuals.trails,0);assert(mobileState.visuals.visibleBadges<mobileState.visuals.balls);assert(mobileState.shots>0);await mobileContext.close();
 if(process.argv.includes('--mobile-only')){await browser.close();console.log(JSON.stringify({mobilePass:true,shots:mobileState.shots,errors,requests}));process.exit(0);}
 const lostContext=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1,recordVideo:{dir:resolve(out,'video'),size:{width:1280,height:950}}});
 const lostPage=await lostContext.newPage(),lossErrors=[],lossConsole=[];
 lostPage.on('pageerror',e=>lossErrors.push(e.message));lostPage.on('console',m=>{if(m.type()==='error')lossConsole.push(m.text());});
 await lostContext.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await lostPage.goto(url);await lostPage.waitForSelector('#scene[data-ready=true]',{timeout:60000});await lostPage.locator('#start').click();
 await lostPage.keyboard.press('ArrowRight');await lostPage.keyboard.press('Space');
 await lostPage.waitForFunction(()=>window.studyEvidence.snapshot().game.status==='lost',null,{timeout:300000,polling:1000});
 const lost=await lostPage.evaluate(()=>window.studyEvidence.snapshot());assert(lost.game.monsters.length>10);assert(lost.game.boss.hp>0);assert.equal(lost.shots,1);
 assert(await lostPage.locator('#overlay').isVisible());assert.equal(await lostPage.locator('#overlay-title').textContent(),'怪物塞滿了球場');
 await lostPage.screenshot({path:resolve(out,'lost-desktop.png'),fullPage:true});await lostPage.waitForTimeout(2000);
 const lossVideo=lostPage.video();await lostPage.close();await lostContext.close();await lossVideo.saveAs(resolve(out,'lost-full.webm'));
 assert.deepEqual(lossErrors,[]);assert.deepEqual(lossConsole,[]);
 await writeFile(resolve(out,'loss.json'),JSON.stringify({method:'一次真實鍵盤發射後，等待正式波次使怪物超過十隻；未改規則或時鐘',pageErrors:lossErrors,consoleErrors:lossConsole,final:lost},null,2));
 for(const args of [
  ['-y','-i',resolve(out,'won-full.webm'),'-t','40','-an','-c:v','libvpx-vp9','-crf','35','-b:v','0','-cpu-used','4','-threads','4',resolve(out,'demo-40s.webm')],
  ['-y','-i',resolve(out,'demo-40s.webm'),'-sseof','-28','-i',resolve(out,'lost-full.webm'),'-filter_complex','[0:v]fps=6/40,scale=426:316,trim=end_frame=6,setpts=N/(1*TB)[a];[1:v]fps=6/28,scale=426:316,trim=end_frame=6,setpts=N/(1*TB)[b];[a][b]concat=n=2:v=1:a=0,tile=4x3:nb_frames=12:color=0x17100b[out]','-map','[out]','-frames:v','1',resolve(out,'sheet.png')]
 ]){const proc=spawnSync('ffmpeg',args,{encoding:'utf8'});assert.equal(proc.status,0,proc.stderr);}
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(resolve(out,'edge.json'),JSON.stringify({buildSha256,channel:'msedge',browser:browser.version(),errors,requests,seen:{phaseShot,waveSeen,replaySeen,chainSeen},initial,final:result,reset,mobile:mobileState,videoSeconds:40},null,2));
 console.log(JSON.stringify({pass:true,lossStatus:lost.game.status,lossSeconds:lost.seconds,lossErrors,lossConsole,status:result.game.status,seconds:result.seconds,shots:result.shots,maxDepth:result.maxDepth,shifts:result.shifts.length,replays:result.hud.replays,errors,reset:true,mobileShots:mobileState.shots}));
}catch(error){await writeFile(resolve(out,resume?'failed-resume.json':'failed-run.json'),JSON.stringify({error:String(error),errors,state:page.isClosed()?result:await page.evaluate(()=>window.studyEvidence?.snapshot()).catch(()=>null)},null,2));throw error;}
finally{await browser.close();}
