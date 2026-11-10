import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/motion');await mkdir(out,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:4173,strictPort:false}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{for(const [name,choice] of [['夜光','glow'],['紙本','paper'],['極簡','minimal']]){
 const context=await browser.newContext({viewport:{width:1100,height:950},recordVideo:{dir:out,size:{width:1100,height:950}},reducedMotion:'no-preference'});
 const page=await context.newPage(),video=page.video(),errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1')&&!r.url().startsWith('data:'))requests.push(r.url());});
 const origin=Date.now();await page.goto(server.resolvedUrls.local[0]);await page.locator(`[data-style-choice="${choice}"]`).click();await page.locator('#seed').fill('20261110');await page.getByRole('button',{name:'開始',exact:true}).click();
 const b=await page.locator('#game').boundingBox(),x=b.x+b.width/2,y=b.y+b.height*622/680,start=Date.now(),samples=[];let shot=0,nextShot=0;
 while(Date.now()-origin<35500){const elapsed=(Date.now()-start)/1000;if(elapsed>=nextShot&&shot<32){const angle=-Math.PI/2+Math.sin(shot)*.6;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+Math.cos(angle)*b.width*.2,y+Math.sin(angle)*b.width*.2,{steps:5});await page.waitForTimeout(90);await page.mouse.up();shot++;nextShot+=1;}
 const sample=await page.evaluate(()=>{const s=window.resonanceDebug.snapshot();return {tick:s.tick,phase:s.phase,events:s.events.length,chain:s.events.some(e=>e.depth>=2),replay:!document.querySelector('#replay').hidden,feedback:window.resonanceDebug.feedback(),effectKinds:[...new Set(s.effects.filter(e=>s.tick-e.tick<24).map(e=>e.kind))]};});samples.push({wall:(Date.now()-origin)/1000,...sample});await page.waitForTimeout(35);
 }
 const final=await page.evaluate(()=>window.resonanceDebug.snapshot());await page.screenshot({path:resolve(out,`${name}-desktop.png`),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,`${name}-mobile.png`),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await context.close();const path=resolve(out,`${name}.webm`);await rename(await video.path(),path);
 const pick=(predicate,fallback)=>samples.find(predicate)?.wall??fallback;const warning=pick(s=>s.phase==='warning',10),active=pick(s=>s.phase==='active',11),card=pick(s=>s.replay&&s.feedback.release>0,20),chain=pick(s=>s.chain,6),ignite=pick(s=>s.effectKinds.includes('ignite'),5);
 const times=[.4,1.1,1.25,2.2,ignite+.08,chain+.1,warning+.15,active+.25,active+2,card+.15,card+1,33].map(t=>Math.min(35,t));
 for(let i=0;i<times.length;i++)execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(times[i]),'-i',path,'-frames:v','1','-vf',`scale=440:380,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${times[i].toFixed(2)} s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7`,resolve(out,`${choice}-${String(i).padStart(2,'0')}.png`)]);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','1','-i',resolve(out,`${choice}-%02d.png`),'-vf','tile=4x3:padding=4:margin=4:color=gray','-frames:v','1',resolve(out,`${name}-sheet.png`)]);
 const result={name,choice,video:path,seconds:Number(execFileSync('ffprobe',['-v','quiet','-show_entries','format=duration','-of','csv=p=0',path]).toString()),errors,externalRequests:requests,firstChain:final.events.find(e=>e.depth>=2)?.tick/120,shifts:final.shifts,replays:final.replays,feedback:samples.at(-1).feedback,times,samples};results.push(result);await writeFile(resolve(out,'evidence.json'),JSON.stringify(results,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert(final.events.some(e=>e.depth>=2),'錄影缺少連鎖');assert(final.shifts.some(s=>s.kind==='release'),'錄影缺少完整相變');assert(final.replays.some(r=>r.shift),'錄影缺少相變回放');console.log(JSON.stringify({...result,samples:undefined,replays:final.replays.length}));
 }}finally{await browser.close();await server.close();}
