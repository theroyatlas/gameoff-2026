import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '../review-main-integration');
await mkdir(out, {recursive:true});
const entry = resolve(root, 'drafts/3d-web/dist-main/index.html');
const url = pathToFileURL(entry).href;
const browser = await chromium.launch({channel:'msedge',headless:true});
const result = {browser:browser.version(),evidence:'Live local browser; DOM input; mobile uses emulated viewport and synthesized touch',buildSha256:createHash('sha256').update(await readFile(entry)).digest('hex'),screenshots:{},runs:{}};
async function pageFor(viewport, mobile=false) {
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:mobile?'reduce':'no-preference'});
 const page=await context.newPage(), errors={console:[],page:[],external:[]};
 result.runs['context'+Object.keys(result.runs).length]={errors};
 page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text())});
 page.on('pageerror',e=>errors.page.push(e.message));
 await context.route(/^https?:/,r=>{errors.external.push(r.request().url());return r.abort()});
 return {page,context,errors};
}
async function capture(page,name) { const path=resolve(out,name); await page.screenshot({path}); result.screenshots[name]={path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')}; }
const state=p=>p.evaluate(()=>window.boardEvidence.snapshot());
function checkVisual(s) {
 const {game:g,visual:v}=s, b=g.board;
 assert.equal(v.cards.length,14); assert.equal(v.ring,true);
 assert.equal(v.die,b.die);
 const tile=v.cards[b.position];
 assert(Math.abs(v.pawn.x-tile.x-.38)<1e-8); assert(Math.abs(v.pawn.z-tile.z+.18)<1e-8);
 assert.deepEqual(v.cards.filter(t=>t.highlighted).map(t=>t.index), b.landed?[b.position]:[]);
 assert.deepEqual(v.cards.map(t=>t.kind),['START','SURGE','TUNE','EVENT','SURGE','TUNE','SURGE','EVENT','TUNE','SURGE','TUNE','EVENT','SURGE','TUNE']);
}
const until=(p,phase)=>p.waitForFunction(phase=>{const s=window.boardEvidence.snapshot().game;return s.status!=='playing'||s.board.phase===phase},phase,{timeout:20000,polling:30});
try {
 const {page:p,context,errors}=await pageFor({width:1280,height:720});
 await p.goto(url); await p.waitForSelector('#board-scene[data-ready=true]');
 await capture(p,'board-initial-desktop.png');
 const initial=await state(p); checkVisual(initial);
 await p.locator('#board-seed').fill('20261111'); await p.locator('#board-start').click();
 let turns=[],captured=false;const began=Date.now();
 while((await state(p)).game.status==='playing') {
  assert(Date.now()-began<600000,'Board full game timeout');
  await until(p,'roll'); if((await state(p)).game.status!=='playing')break;
  const before=(await state(p)).game;
  await p.locator('#board-roll').click();
  await until(p,'effect'); const landed=await state(p); checkVisual(landed);
  assert.equal(landed.game.board.position,(before.board.position+landed.game.board.die)%14);
  turns.push({turn:landed.game.board.turn,die:landed.game.board.die,position:landed.game.board.position,shots:landed.game.board.shotsLeft});
  await until(p,'shooting');
  while((await state(p)).game.status==='playing'&&(await state(p)).game.board.phase==='shooting') {
   await p.waitForFunction(()=>!document.querySelector('#board-fire').disabled||window.boardEvidence.snapshot().game.status!=='playing',null,{polling:30});
   const s=await state(p); if(s.game.status!=='playing')break;
   await p.locator('#board-angle').fill(String(Math.round(-90+Math.sin(s.game.shots*2)*51)));
   await p.locator('#board-fire').click();
   if(!captured&&(await state(p)).game.shots>=3){await capture(p,'board-desktop-1280x720.png');captured=true;}
  }
  console.log(JSON.stringify({mode:'board',turn:landed.game.board.turn,shots:(await state(p)).game.shots}));
 }
 const final=await state(p);checkVisual(final);assert(['won','lost'].includes(final.game.status));
 await capture(p,'board-outcome.png');
 await p.locator('#board-restart').click(); const reset=await state(p);checkVisual(reset);assert.equal(reset.game.status,'ready');assert.equal(reset.game.shots,0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 result.runs.board={final,turns,reset,errors};assert.deepEqual(errors,{console:[],page:[],external:[]});
 await context.close();
 await writeFile(resolve(out,'browser-progress.json'),JSON.stringify(result,null,2));
 const m=await pageFor({width:390,height:844},true);
 await m.page.goto(url+'?mode=board&ring=0&ball=c&icon=b&light=b'); await m.page.waitForSelector('#board-scene[data-ready=true]');
 await m.page.locator('#board-start').tap();await m.page.locator('#board-roll').tap();await until(m.page,'shooting');
 const point=await m.page.evaluate(()=>window.boardEvidence.project(220,180));await m.page.touchscreen.tap(point.x,point.y);
 await m.page.waitForFunction(()=>window.boardEvidence.snapshot().game.shots===1);
 const ms=await state(m.page);checkVisual(ms);assert.equal(ms.visual.choice.ball,'c');assert.equal(ms.visual.choice.icon,'b');assert.equal(ms.visual.choice.light,'b');
 await capture(m.page,'board-mobile-390x844.png');
 const layout=await m.page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height).map(b=>({text:b.textContent,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}));
 assert.equal(layout.overflow,false);assert(layout.buttons.every(b=>b.width>=44&&b.height>=44));
 result.runs.mobile={state:ms,layout,errors:m.errors};assert.deepEqual(m.errors,{console:[],page:[],external:[]});await m.context.close();
 const r=await pageFor({width:1280,height:720});
 await r.page.goto(url+'?mode=realtime');await r.page.waitForSelector('#scene[data-ready=true]',{timeout:90000});
 await r.page.locator('#start').click(); await r.page.locator('#scene').focus();await r.page.keyboard.press('Space');
 await r.page.waitForFunction(()=>window.studyEvidence.snapshot().shots===1);
 await capture(r.page,'realtime-desktop-1280x720.png');
 // A sparse firing strategy must still reach a natural terminal state through normal clock progression.
 await r.page.waitForFunction(()=>window.studyEvidence.snapshot().game.status==='lost',null,{timeout:300000,polling:1000});
 const rf=await r.page.evaluate(()=>window.studyEvidence.snapshot());assert(rf.game.monsters.length>10);assert.equal(rf.shots,1);
 await capture(r.page,'realtime-outcome.png');assert.deepEqual(r.errors,{console:[],page:[],external:[]});
 result.runs.realtime={final:rf,errors:r.errors};await r.context.close();
 result.status='PASS';
} catch(e) {result.status='FAIL';result.error=String(e);throw e;}
finally {await writeFile(resolve(out,'browser-verification.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify({status:result.status,error:result.error,screenshots:Object.keys(result.screenshots)}));}
