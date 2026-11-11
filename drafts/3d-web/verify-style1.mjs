import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out=resolve(import.meta.dirname,'../../artifacts/3d-style1');await mkdir(out,{recursive:true});
const entry=resolve(import.meta.dirname,'dist-style1/index.html');
const buildSha256=createHash('sha256').update(await readFile(entry)).digest('hex');
const browser=await chromium.launch({channel:'msedge',headless:true});
const results={buildSha256,browser:browser.version()};
try{
 for(const mode of ['won']){
  const context=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1});
  const page=await context.newPage(),pageErrors=[],consoleErrors=[],requests=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
  await page.goto(pathToFileURL(entry).href);await page.waitForSelector('#scene[data-ready=true]',{timeout:90000});
  const initial=await page.evaluate(()=>window.studyEvidence.snapshot());assert.equal(initial.visuals.balls,0);assert.equal(initial.game.status,'ready');
  await page.locator('#start').click();let final;
  if(mode==='won'){
   let next=1,shot=0,progress=0,phaseShot=false,denseShot=false;
   while(true){
    const s=await page.evaluate(()=>window.studyEvidence.snapshot());
    assert.equal(s.visuals.trails,0);
    for(const a of s.visuals.badges)for(const b of s.visuals.badges)if(a.id!==b.id)assert(Math.hypot(a.x-b.x,a.y-b.y)>=30);
    if(s.seconds-progress>30){progress=s.seconds;console.log(JSON.stringify({mode,seconds:s.seconds,boss:s.game.boss.hp,shots:s.shots}));}
    if(s.phase==='active'&&!phaseShot){await page.screenshot({path:resolve(out,'shift-desktop.png'),fullPage:true});phaseShot=true;}
    if(s.shots>=45&&!denseShot){await page.screenshot({path:resolve(out,'dense-desktop.png'),fullPage:true});denseShot=true;}
    if(s.game.status!=='playing'){final=s;break;}
    assert(s.seconds<600);
    if(s.seconds>=next){const a=-Math.PI/2+Math.sin(shot)*.6,p=await page.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),a);
     await page.mouse.move(p.start.x,p.start.y);await page.mouse.down();await page.mouse.move(p.end.x,p.end.y,{steps:2});await page.mouse.up();shot++;next+=shot<32?.8:2;
    }
    await page.waitForTimeout(70);
   }
   assert(phaseShot&&denseShot);assert.equal(final.game.status,'won');assert.equal(final.game.boss.hp,0);assert(final.counts.ignite>0&&final.counts.release>0&&final.maxDepth>=2);
  }else{
   await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
   await page.waitForFunction(()=>window.studyEvidence.snapshot().game.status==='lost',null,{timeout:300000,polling:1000});
   final=await page.evaluate(()=>window.studyEvidence.snapshot());assert(final.game.monsters.length>10);assert(final.game.boss.hp>0);assert.equal(final.shots,1);
  }
  assert(await page.locator('#overlay').isVisible());await page.screenshot({path:resolve(out,`${mode}-desktop.png`),fullPage:true});
  await page.locator('#start').click();const reset=await page.evaluate(()=>window.studyEvidence.snapshot());
  assert.deepEqual(reset.game,initial.game);assert.equal(reset.visuals.balls,0);assert.equal(reset.visuals.cages,0);assert.equal(reset.visuals.particles,0);assert.deepEqual(reset.counts,{});
  await page.locator('#start').click();await page.keyboard.press('Space');await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>window.studyEvidence.snapshot())).shots,1);
  assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(requests,[]);
  results[mode]={initial,final,reset,pageErrors,consoleErrors,requests};await writeFile(resolve(out,`${mode}.json`),JSON.stringify(results[mode],null,2));
  console.log(JSON.stringify({mode,status:final.game.status,seconds:final.seconds,shots:final.shots,pageErrors,consoleErrors}));await context.close();
 }
 await writeFile(resolve(out,'verify.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}
