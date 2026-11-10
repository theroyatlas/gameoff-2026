import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(import.meta.dirname,'../../artifacts/perf-3d');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // 實際延後幀回呼，測試降畫質整合；此數字不列入硬體效能表。
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>setTimeout(()=>raf.call(window,callback),40);});
 await page.goto(pathToFileURL(resolve(import.meta.dirname,'dist-perf/index.html')).href+'?quality=low');
 await page.waitForSelector('#scene[data-ready=true]');
 await page.locator('#scene').focus();
 for(let i=0;i<12;i++){await page.keyboard.press('Space');await page.waitForTimeout(350);}
 await page.waitForFunction(()=>window.studyEvidence.snapshot().quality.level===3,null,{timeout:45000});
 const state=await page.evaluate(()=>window.studyEvidence.snapshot());
 assert.deepEqual(state.quality.history.map(x=>x.level),[1,2,3]);assert(!state.quality.shadows);
 assert.equal(state.quality.pixelRatio,.75);assert(Math.abs(state.quality.composerPixelRatio-.75)<.002);
 assert.equal(state.quality.effectLimit,24);assert(state.quality.effects<=24);
 assert.equal(state.shots,12);assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve(out,'quality-level-3.png'),fullPage:true});
 await writeFile(resolve(out,'quality.json'),JSON.stringify({method:'injected 40ms RAF scheduling delay; not hardware benchmark',errors,...state},null,2));console.log(JSON.stringify(state.quality,null,2));
}finally{await browser.close();}
