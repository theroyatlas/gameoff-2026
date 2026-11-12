import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out=resolve(import.meta.dirname,'../../artifacts/3d-smooth');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),result={screens:[],quality:[]};
try{
 for(const [name,width,height] of [['desktop',1280,950],['mobile',390,844]]){
  for(const build of ['dist-polish','dist-smooth']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await context.route(/^https?:/,r=>r.abort());
   await page.goto(pathToFileURL(resolve(import.meta.dirname,build,'index.html')).href);
   await page.waitForSelector('#scene[data-ready=true]',{timeout:90000});await page.waitForTimeout(300);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const file=resolve(out,`${build}-${name}.png`);await page.screenshot({path:file,fullPage:true});
   result.screens.push({build,name,width,height,file,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),errors});assert.deepEqual(errors,[]);await context.close();
  }
 }
 // 排程延遲只用於觸發既有降級路徑，不列入 FPS 驗收。
 for(const build of ['dist-polish','dist-smooth']){
  const context=await browser.newContext({viewport:{width:1280,height:950},deviceScaleFactor:1});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await context.route(/^https?:/,r=>r.abort());
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
   window.qualityFrames=[];window.slowQuality=false;let shaderMs=0,links=0;
   for(const name of ['getProgramInfoLog','linkProgram']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){const start=performance.now(),r=original.apply(this,args);shaderMs+=performance.now()-start;if(name==='linkProgram')links++;return r;};}
   const raf=requestAnimationFrame;window.requestAnimationFrame=callback=>raf.call(window,now=>{
    const run=()=>{shaderMs=0;links=0;const begin=performance.now();callback(performance.now());if(window.slowQuality)window.qualityFrames.push({begin,callbackMs:performance.now()-begin,shaderMs,links,...window.studyEvidence.timing()});};
    if(window.slowQuality)setTimeout(run,40);else run();
   });
  });
  await page.goto(pathToFileURL(resolve(import.meta.dirname,build,'index.html')).href+'?quality=low');await page.waitForSelector('#scene[data-ready=true]',{timeout:90000});
  await page.locator('#start').click();for(let i=0;i<3;i++){await page.keyboard.press('Space');await page.waitForTimeout(800);}
  await page.evaluate(()=>window.slowQuality=true);
  await page.waitForFunction(()=>window.studyEvidence.snapshot().quality.level===3,null,{timeout:60000,polling:250});
  const state=await page.evaluate(()=>({frames:window.qualityFrames,state:window.studyEvidence.snapshot()}));
  assert.deepEqual(state.state.quality.history.map(q=>q.level),[1,2,3]);assert.equal(state.state.quality.shadows,false);assert.equal(state.state.quality.pixelRatio,.75);assert.deepEqual(errors,[]);
  result.quality.push({build,...state,errors});await context.close();
 }
 await writeFile(resolve(out,'visual-quality.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({screens:result.screens,quality:result.quality.map(r=>({build:r.build,changes:r.frames.filter((f,i)=>i&&f.qualityLevel!==r.frames[i-1].qualityLevel),errors:r.errors}))}));
}finally{await browser.close();}
