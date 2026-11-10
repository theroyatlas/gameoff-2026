import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[],network=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
await context.route(/^https?:/,r=>{network.push(r.request().url());return r.abort();});
await page.goto(new URL('dist/index.html',import.meta.url).href);await page.waitForSelector('#scene[data-ready=true]');
for(let i=0;i<15;i++){
  const a=-.5-i*2.1/14;
  const p=await page.evaluate(a=>({s:window.studyEvidence.project(400,622),e:window.studyEvidence.project(400+Math.cos(a)*160,622+Math.sin(a)*160)}),a);
  await page.mouse.move(p.s.x,p.s.y);await page.mouse.down();await page.mouse.move(p.e.x,p.e.y,{steps:3});await page.mouse.up();await page.waitForTimeout(300);
}
await page.waitForFunction(()=>{const s=window.studyEvidence.snapshot();return s.seconds>12&&s.phase==='idle'&&s.balls.length===15&&s.balls.every(b=>b.vx===0&&b.vy===0);},null,{timeout:40000});
await page.mouse.move(40,40);await page.locator('canvas').evaluate(c=>c.blur());
await page.screenshot({path:new URL('shots/calm.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
const s=await page.evaluate(()=>window.studyEvidence.snapshot());
await writeFile(new URL('evidence/calm.json',import.meta.url),JSON.stringify({seconds:s.seconds,phase:s.phase,shots:s.shots,allStopped:s.balls.every(b=>b.vx===0&&b.vy===0),errors,network},null,2));
await browser.close();console.log(JSON.stringify({shots:s.shots,phase:s.phase,seconds:s.seconds,errors,network}));
