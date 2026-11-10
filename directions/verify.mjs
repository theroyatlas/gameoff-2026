import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const shots=join(root,'shots');mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results={browser:browser.version(),channel:'msedge',protocol:'file:',viewport:{width:1440,height:960},samples:[],selection:{}};
try {
for(const folder of ['a-chorus','b-fireflies','c-crew']){
  const page=await browser.newPage({viewport:results.viewport,deviceScaleFactor:1});
  const errors=[],network=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url())});
  await page.goto(pathToFileURL(join(root,folder,'index.html')).href);
  assert.equal(await page.evaluate(()=>window.__sample.audioState),'not-started');
  const chainCapture=(async()=>{await page.waitForFunction(()=>window.__sample.firstChain!==null,{},{timeout:18000,polling:'raf'});await page.screenshot({path:join(shots,folder+'-chain.png')})})();
  const phaseCapture=(async()=>{await page.waitForFunction(()=>window.__sample.phaseAt!==null,{},{timeout:60000,polling:'raf'});if(folder==='b-fireflies'){await page.screenshot({path:join(shots,folder+'-flash.png')});await page.waitForTimeout(700)}else if(folder==='c-crew')await page.waitForFunction(()=>window.__sample.hero!==null,{},{timeout:10000});else await page.waitForTimeout(550);await page.screenshot({path:join(shots,folder+'-phase.png')})})();
  for(let i=0;i<15;i++){
    const dx=[0,-130,170,-260,300,-50,110,-210,240,40,-320,310,-100,140,0][i];
    await page.mouse.move(720,816);await page.mouse.down();await page.mouse.move(720+dx,550,{steps:8});await page.mouse.up();await page.waitForTimeout(1050);
  }
  await chainCapture;await phaseCapture;
  await page.waitForTimeout(6500);
  await page.screenshot({path:join(shots,folder+'-calm.png')});
  const state=await page.evaluate(()=>window.__sample);
  assert.equal(state.launchCount,15);assert.equal(state.balls,15);assert.equal(state.finite,true);assert.equal(state.audioState,'running');assert.ok(state.notesPlayed>15);assert.ok(state.accelerations>0);assert.ok(state.firstChainWall<10);assert.ok(state.shiftWall<60);assert.equal(errors.length,0);assert.equal(network.length,0);assert.equal(state.moving,0);
  if(folder==='c-crew')assert.ok(state.hero.hits>0);
  await page.keyboard.press('r');const reset=await page.evaluate(()=>window.__sample);assert.equal(reset.balls,0);assert.equal(reset.phaseAt,null);assert.equal(reset.totalHits,0);
  await page.setViewportSize({width:390,height:844});
  for(let i=0;i<5;i++){await page.mouse.move(195,779);await page.mouse.down();await page.mouse.move(130+i*26,560,{steps:5});await page.mouse.up();await page.waitForTimeout(350)}
  await page.waitForTimeout(1200);await page.screenshot({path:join(shots,folder+'-mobile.png')});
  const mobile=await page.evaluate(()=>({state:window.__sample,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(mobile.state.launchCount,5);assert.equal(mobile.state.finite,true);assert.equal(mobile.overflow,false);
  const html=readFileSync(join(root,folder,'index.html'),'utf8');assert.ok(!/src=|@import|https?:\/\//.test(html));
  results.samples.push({folder,consoleErrors:errors,externalRequests:network,firstChainSeconds:state.firstChainWall,phaseSeconds:state.shiftWall,phaseSimulationSeconds:state.phaseAt,launches:state.launchCount,balls:state.balls,hits:state.totalHits,chains:state.chainCount,accelerations:state.accelerations,notesPlayed:state.notesPlayed,audioState:state.audioState,movingAfterWait:state.moving,hero:state.hero,mobile:{width:390,height:844,launches:mobile.state.launchCount,overflow:mobile.overflow},resetPassed:true,events:state.events});
  console.log(JSON.stringify({folder,errors:errors.length,firstChain:state.firstChainWall,phase:state.shiftWall,hero:state.hero}));
  await page.close();
}
const page=await browser.newPage({viewport:{width:1440,height:960}});
await page.goto(pathToFileURL(join(root,'index.html')).href);await page.screenshot({path:join(shots,'selection-desktop.png'),fullPage:true});
results.selection.imagesLoaded=await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0));assert.equal(results.selection.imagesLoaded,true);
for(const link of await page.locator('a').all()){const href=await link.getAttribute('href');assert.ok(readFileSync(join(root,href),'utf8').includes('<canvas'))}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(shots,'selection-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
writeFileSync(join(root,'verification.json'),JSON.stringify(results,null,2)+'\n');
console.log('驗證完成，結果已寫入 directions/verification.json。');
} finally {await browser.close()}
