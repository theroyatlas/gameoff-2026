import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),artifacts=resolve(root,'artifacts');await mkdir(artifacts,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:4173,strictPort:false}});await server.listen();
let browser;const result={passed:false,channel:'msedge',errors:[],externalRequests:[],checks:[]};
function observe(page){page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});page.on('request',r=>{if(!/^(https?:\/\/(127\.0\.0\.1|localhost)(:|\/)|file:|data:)/.test(r.url()))result.externalRequests.push(r.url());});}
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1100,height:950}});observe(page);await page.goto(server.resolvedUrls.local[0]);
 assert.equal((await page.evaluate(()=>window.resonanceDebug.feedback())).audioState,'not-started');
 result.styleChecks=[];
 for(const choice of ['glow','paper','minimal']){await page.locator(`[data-style-choice="${choice}"]`).click();const computed=await page.evaluate(()=>({body:getComputedStyle(document.body).color,background:getComputedStyle(document.body).backgroundColor,h1:getComputedStyle(document.querySelector('h1')).fontSize,h2:getComputedStyle(document.querySelector('h2')).fontSize,buttonHeight:document.querySelector('#start').getBoundingClientRect().height}));assert(computed.buttonHeight>=44);assert.equal(computed.h1,'24px');assert(parseFloat(computed.h2)>=22);result.styleChecks.push({choice,...computed});}
 await page.locator('[data-style-choice="glow"]').click();
 await page.getByRole('button',{name:'開始',exact:true}).click();const box=await page.locator('#game').boundingBox();const x=box.x+box.width*.5,y=box.y+box.height*622/680;
 for(let i=0;i<10;i++){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+Math.sin(i)*box.width*.15,y-box.height*.25,{steps:8});if(i===0)await page.screenshot({path:resolve(artifacts,'aim-desktop.png'),fullPage:true});await page.mouse.up();await page.waitForTimeout(650);}
 const state=await page.evaluate(()=>window.resonanceDebug.snapshot());assert.equal(state.shots,10);assert.equal(state.balls.length,10);assert(state.inputs.every(s=>Math.abs(s.actualAngle-s.angle)<=Math.PI/15));
 result.checks.push('十次真實滑鼠拖拉、球留場、扇形隨機角度');result.feedback=await page.evaluate(()=>window.resonanceDebug.feedback());assert.equal(result.feedback.audioState,'running');assert(result.feedback.notes>0);
 await page.getByRole('button',{name:'音效：開'}).click();await page.getByRole('button',{name:'音效：關'}).click();result.checks.push('首次手勢才啟動 WebAudio、靜音切換');
 await page.screenshot({path:resolve(artifacts,'smoke-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(artifacts,'smoke-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'重來',exact:true}).click();const fresh=await page.evaluate(()=>window.resonanceDebug.snapshot());assert.equal(fresh.shots,0);assert.equal(fresh.balls.length,0);assert.equal(fresh.shifts.length,0);assert.equal(fresh.replays.length,0);assert.equal(fresh.wave,0);result.checks.push('390px 無溢出、重來清除相變與回放');
 await page.goto(pathToFileURL(resolve(root,'dist/index.html')).href);await page.getByRole('button',{name:'紙本',exact:true}).click();await page.getByRole('button',{name:'開始',exact:true}).click();await page.locator('#game').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#game').dataset.shots==='1');assert.equal(await page.evaluate(()=>typeof window.resonanceDebug),'undefined');result.checks.push('file URL 開始與發射、正式成品無 debug 介面');
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[]);result.passed=true;
}finally{await writeFile(resolve(artifacts,'smoke-result.json'),JSON.stringify(result,null,2));await browser?.close();await server.close();}console.log(JSON.stringify(result,null,2));
