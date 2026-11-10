import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const url=pathToFileURL(resolve(import.meta.dirname,'dist-parity/index.html')).href;
const results=[];
for(const mode of ['disabled','renderer-failure','context-lost','quality']){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:mode==='disabled'?['--disable-gpu','--disable-webgl','--disable-webgl2']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950}}),pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  if(mode==='renderer-failure')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(String(kind).startsWith('webgl'))throw new Error('Injected renderer initialization failure');return original.call(this,kind,...args);};});
  if(mode==='quality')await page.addInitScript(()=>{const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>setTimeout(()=>raf.call(window,callback),40);});
  await page.goto(url+'?quality=low');
  if(mode==='quality'){
   await page.waitForSelector('#scene[data-ready=true]');await page.locator('#start').click();
   for(let i=0;i<12;i++){await page.keyboard.press('Space');await page.waitForTimeout(350);}
   await page.waitForFunction(()=>window.studyEvidence.snapshot().quality.level===3,null,{timeout:60000});
   const s=await page.evaluate(()=>window.studyEvidence.snapshot());
   assert.deepEqual(s.quality.history.map(x=>x.level),[1,2,3]);assert.equal(s.quality.shadows,false);assert.equal(s.quality.pixelRatio,.75);assert.equal(s.quality.effectLimit,24);assert.equal(s.shots,12);assert.deepEqual(consoleErrors,[]);
   results.push({mode,method:'injected 40ms RAF scheduling delay; not hardware benchmark',quality:s.quality,pageErrors,consoleErrors});
  }else{
   if(mode==='context-lost'){await page.waitForSelector('#scene[data-ready=true]');await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());}
   await page.locator('#failure').waitFor({state:'visible'});assert(await page.locator('#overlay').isHidden());assert(await page.locator('#scene').isHidden());
   for(const width of [1280,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#fallback-link').isVisible());}
   await page.locator('#fallback-link').click();await page.locator('#start').click();await page.locator('#game').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#game').dataset.shots==='1');
   results.push({mode,pageErrors,consoleErrors,linked2DShot:true});
  }
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();}
}
await writeFile(resolve(import.meta.dirname,'../../artifacts/3d-parity/compatibility.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
