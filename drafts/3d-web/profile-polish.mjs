import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const build=process.argv[2]??'dist-parity',tag=process.argv[3]??'before';
assert(['dist-parity','dist-polish'].includes(build));
const out=resolve(import.meta.dirname,'../../artifacts/3d-polish');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route(/^https?:/,r=>r.abort());
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  window.profileFrames=[];window.profileEnabled=false;let counts={},costs={};
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','bufferData','deleteBuffer','bufferSubData']){
   const proto=WebGL2RenderingContext.prototype,original=proto[name];
   proto[name]=function(...args){if(!window.profileEnabled)return original.apply(this,args);const start=performance.now();const value=original.apply(this,args);counts[name]=(counts[name]??0)+1;costs[name]=(costs[name]??0)+performance.now()-start;return value;};
  }
  const raf=requestAnimationFrame;
  window.requestAnimationFrame=callback=>raf.call(window,now=>{counts={};costs={};const begin=performance.now();callback(now);if(window.profileEnabled)window.profileFrames.push({wall:now,callbackMs:performance.now()-begin,counts,costs,...window.studyEvidence.timing()});});
 });
 await page.goto(pathToFileURL(resolve(import.meta.dirname,build,'index.html')).href+'?quality=low');await page.waitForSelector('#scene[data-ready=true]',{timeout:60000});await page.locator('#start').click();
 for(let i=0;i<32;i++){
  await page.waitForFunction(t=>window.studyEvidence.timing().seconds>=t,1+i*.8,{polling:25,timeout:60000});
  const p=await page.evaluate(a=>({start:window.studyEvidence.project(400,622),end:window.studyEvidence.project(400+Math.cos(a)*180,622+Math.sin(a)*180)}),-Math.PI/2+Math.sin(i)*.6);
  await page.mouse.move(p.start.x,p.start.y);await page.mouse.down();await page.mouse.move(p.end.x,p.end.y,{steps:4});await page.mouse.up();
 }
 const calmStart=await page.evaluate(()=>window.studyEvidence.timing().seconds+18);
 await page.waitForFunction(t=>window.studyEvidence.timing().seconds>=t,calmStart,{timeout:90000});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
 await page.evaluate(()=>window.profileEnabled=true);await page.waitForTimeout(10000);await page.evaluate(()=>window.profileEnabled=false);
 const {profile}=await cdp.send('Profiler.stop');
 const finished=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await finished;let raw='';
 while(true){const part=await cdp.send('IO.read',{handle:stream});raw+=part.data;if(part.eof)break;}await cdp.send('IO.close',{handle:stream});
 await writeFile(resolve(out,`trace-${tag}.json`),raw);await writeFile(resolve(out,`cpu-${tag}.cpuprofile`),JSON.stringify(profile));
 const data=await page.evaluate(()=>({frames:window.profileFrames,state:window.studyEvidence.snapshot()}));
 const frames=data.frames.filter(f=>f.phase==='idle'),totals={},costs={};
 for(const f of frames){for(const [key,n]of Object.entries(f.counts))totals[key]=(totals[key]??0)+n;for(const [key,n]of Object.entries(f.costs))costs[key]=(costs[key]??0)+n;}
 const self=new Map();profile.samples.forEach((id,i)=>self.set(id,(self.get(id)??0)+(profile.timeDeltas[i]??0)/1000));
 const cpu=profile.nodes.map(n=>({...n.callFrame,selfMs:self.get(n.id)??0})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,25);
 const parents=new Map(profile.nodes.flatMap(n=>(n.children??[]).map(id=>[id,n.id]))),nodes=new Map(profile.nodes.map(n=>[n.id,n]));
 let renderInclusiveMs=0,physicsInclusiveMs=0,totalSampleMs=0;
 profile.samples.forEach((id,i)=>{const milliseconds=profile.timeDeltas[i]/1000;totalSampleMs+=milliseconds;const names=[];let node=id;while(nodes.has(node)){names.push(nodes.get(node).callFrame.functionName);node=parents.get(node);}if(names.some(n=>n.toLowerCase().includes('render')))renderInclusiveMs+=milliseconds;if(names.some(n=>['step','updatePhase','collide','updateDifficulty'].includes(n)))physicsInclusiveMs+=milliseconds;});
 const trace=JSON.parse(raw),timeline={};for(const e of trace.traceEvents)if(e.ph==='X'&&e.dur&&['FunctionCall','UpdateLayoutTree','Layout','Paint','MinorGC','MajorGC'].includes(e.name))timeline[e.name]=(timeline[e.name]??0)+e.dur/1000;
 const summary={build,tag,browser:browser.version(),cpuRate:4,method:'10s calm profiler run; instrumentation overhead included; not acceptance FPS',totalSampleMs,renderInclusiveMs,physicsInclusiveMs,frames:frames.length,meanCallbackMs:frames.reduce((a,f)=>a+f.callbackMs,0)/frames.length,glCallsPerFrame:Object.fromEntries(Object.entries(totals).map(([k,n])=>[k,n/frames.length])),glCpuMsPerFrame:Object.fromEntries(Object.entries(costs).map(([k,n])=>[k,n/frames.length])),timelineMs:timeline,cpu,quality:data.state.quality,shots:data.state.shots,errors};
 assert(frames.length>100);assert.equal(data.state.shots,32);assert.deepEqual(errors,[]);
 await writeFile(resolve(out,`profile-${tag}.json`),JSON.stringify({summary,...data},null,2));console.log(JSON.stringify(summary));
}finally{await browser.close();}
