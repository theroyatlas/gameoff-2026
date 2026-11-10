import { chromium } from 'playwright';
import { mkdir,writeFile,copyFile } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('.',import.meta.url));
await mkdir(resolve(root,'shots'),{recursive:true});await mkdir(resolve(root,'evidence'),{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const consoleErrors=[],pageErrors=[],externalRequests=[];
const url=pathToFileURL(resolve(root,'dist/index.html')).href;
async function instrument(context){
  await context.route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.abort();});
  context.on('page',page=>{page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('pageerror',e=>pageErrors.push(e.message));});
}
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:resolve(root,'shots'),size:{width:1440,height:1000}}});
await instrument(context);const page=await context.newPage();const video=page.video();
const screenshots={};let result;
try{
  await page.goto(url);await page.waitForSelector('#scene[data-ready=true]');
  const renderer=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return{vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};});
  const phaseCapture=(async()=>{
    await page.waitForFunction(()=>window.studyEvidence.snapshot().phase==='active',null,{timeout:45000,polling:30});
    const phaseState=await page.evaluate(()=>window.studyEvidence.snapshot());
    await page.screenshot({path:resolve(root,'shots/shift.png'),fullPage:true});screenshots.shift={seconds:phaseState.seconds,shots:phaseState.shots,friction:phaseState.friction};
  })().catch(error=>{screenshots.shiftFailure=error.message;});
  const angles=[-1.25,-1.9,-.92,-2.2,-1.5,-.6,-2.5,-1.15,-2,-.8,-2.3,-1.7,-1.05,-2.65,-1.45];
  for(let i=0;i<15;i++){
    await page.waitForFunction(seconds=>window.studyEvidence.snapshot().seconds>=seconds,1+i*1.7,{timeout:10000,polling:8});
    const points=await page.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),angles[i]);
    await page.mouse.move(points.start.x,points.start.y);await page.mouse.down();await page.mouse.move(points.end.x,points.end.y,{steps:4});await page.mouse.up();
    if(i===4){await page.screenshot({path:resolve(root,'shots/calm.png'),fullPage:true});screenshots.calm=await page.evaluate(()=>({seconds:window.studyEvidence.snapshot().seconds,phase:window.studyEvidence.snapshot().phase,shots:window.studyEvidence.snapshot().shots}));}
  }
  await phaseCapture;
  await page.waitForFunction(()=>window.studyEvidence.snapshot().seconds>=40,null,{timeout:50000,polling:100});
  const snapshot=await page.evaluate(()=>window.studyEvidence.snapshot());
  const desktop=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()}));
  result={browser:browser.version(),channel:'msedge',url,renderer,consoleErrors,pageErrors,externalRequests,screenshots,desktop,...snapshot};
}finally{
  await context.close();if(video){await copyFile(await video.path(),resolve(root,'shots/capture.webm'));}
}
const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});await instrument(mobileContext);
const mobile=await mobileContext.newPage();await mobile.goto(url);await mobile.waitForSelector('#scene[data-ready=true]');
const mobilePoints=await mobile.evaluate(()=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(440,430)}));
const cdp=await mobileContext.newCDPSession(mobile);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobilePoints.start.x,y:mobilePoints.start.y}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mobilePoints.end.x,y:mobilePoints.end.y}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await mobile.waitForFunction(()=>window.studyEvidence.snapshot().shots===1);
await mobile.screenshot({path:resolve(root,'shots/mobile.png'),fullPage:true});
result.mobile=await mobile.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,shots:window.studyEvidence.snapshot().shots,method:'Edge CDP synthesized touch, no physical device'}));
await mobileContext.close();await browser.close();
const ffmpeg=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',resolve(root,'shots/capture.webm'),'-t','30','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-threads','4','-crf','32','-b:v','0',resolve(root,'shots/demo-30s.webm')],{encoding:'utf8',windowsHide:true});
if(ffmpeg.status!==0)throw new Error(ffmpeg.stderr);
const sheet=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',resolve(root,'shots/demo-30s.webm'),'-vf','fps=2/5,scale=480:-1,tile=4x3:padding=4:margin=4:color=0x17100b','-frames:v','1',resolve(root,'shots/sheet.png')],{encoding:'utf8',windowsHide:true});
if(sheet.status!==0)throw new Error(sheet.stderr);
const probe=spawnSync('ffprobe',['-v','quiet','-show_entries','format=duration','-of','json',resolve(root,'shots/demo-30s.webm')],{encoding:'utf8',windowsHide:true});result.video=JSON.parse(probe.stdout);
const releases=result.shifts.filter(s=>s.kind==='release');
result.checks={shots15:result.shots===15,retained15:result.balls.length===15,consoleClean:consoleErrors.length===0,pageClean:pageErrors.length===0,noNetwork:externalRequests.length===0,phaseObserved:!!screenshots.shift,release:releases.length>=1,chain:result.maxDepth>=2,stopped:result.balls.every(b=>b.vx===0&&b.vy===0),touch:result.mobile.shots===1,noOverflow:!result.desktop.overflow&&!result.mobile.overflow,sameTickRelease:releases.some(r=>result.events.filter(e=>e.tick===r.tick&&e.kind==='amplified').length>=10),duration30:Math.abs(Number(result.video.format.duration)-30)<.15};
await writeFile(resolve(root,'evidence/edge.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks,shifts:result.shifts,screenshots,consoleErrors,pageErrors,meanFrameMs:result.meanFrameMs,maxDepth:result.maxDepth},null,2));
assert.ok(Object.values(result.checks).every(Boolean),'See evidence/edge.json for unmet checks');
