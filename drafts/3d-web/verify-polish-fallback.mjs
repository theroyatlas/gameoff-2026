import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=import.meta.dirname,out=resolve(root,'../../artifacts/3d-polish');await mkdir(out,{recursive:true});
const url=pathToFileURL(resolve(root,'dist-polish/index.html')).href,results=[];
for(const mode of ['disabled','renderer-failure','context-lost']){
 const args=mode==='disabled'?['--disable-gpu','--disable-webgl','--disable-webgl2']:[];
 const browser=await chromium.launch({channel:'msedge',headless:true,args});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  if(mode==='renderer-failure')await page.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){if(String(kind).startsWith('webgl'))throw new Error('Injected renderer initialization failure');return original.call(this,kind,...args);};
  });
  await page.goto(url);
  if(mode==='context-lost'){
   await page.waitForSelector('#scene[data-ready=true]');
   await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  }
  await page.locator('#failure').waitFor({state:'visible'});
  assert(await page.locator('#scene').isHidden());assert(await page.locator('#overlay').isHidden());assert(await page.locator('#instructions').isHidden());
  const href=await page.locator('#fallback-link').getAttribute('href');assert.equal(href,'../../../dist/index.html');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(out,`fallback-${mode}-desktop.png`),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,`fallback-${mode}-mobile.png`),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#fallback-link').focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'開始',exact:true}).click();await page.locator('#game').focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('#game').dataset.shots==='1');
  results.push({mode,args,href,pageErrors:errors,consoleErrors,linked2DShot:true,finalUrl:page.url()});
 }finally{await browser.close();}
}
await writeFile(resolve(out,'fallback.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
