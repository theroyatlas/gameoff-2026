import { build } from 'esbuild';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const out=resolve('../review-mobile-card-r');
const bundle=await build({stdin:{contents:`import { BoardAudio, masterLimiterCurve } from './drafts/3d-web/board-audio'; Object.assign(window,{BoardAudio,masterLimiterCurve});`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife'});
const html=resolve(out,'compressor-probe.html');
await writeFile(html,`<!doctype html><title>Master output probe</title><script>${bundle.outputFiles[0].text}</script>`);
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors={console:[],page:[],external:[]};
try {
 const page=await browser.newPage();page.on('console',m=>errors.console.push(m.text()));page.on('pageerror',e=>errors.page.push(e.message));
 await page.route(/^https?:/,r=>{errors.external.push(r.request().url());return r.abort();});
 await page.goto(pathToFileURL(html).href);
 const result=await page.evaluate(async()=>{
  const db=x=>20*Math.log10(x), rms=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length), makeup=[];
  let parameters;
  for(const inputDb of [-60,-40,-30,-20]) {
   const ctx=new OfflineAudioContext(2,48000*3,48000);let compressor;
   const original=window.AudioContext;
   const proxy=new Proxy(ctx,{get(target,key){
    if(key==='resume') return ()=>Promise.resolve();
    if(key==='createDynamicsCompressor') return ()=>{compressor=ctx.createDynamicsCompressor();return compressor;};
    const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;
   }});
   window.AudioContext=function(){return proxy;};
   try {new window.BoardAudio().unlock();} finally {window.AudioContext=original;}
   parameters=Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,compressor[k].value]));
   // Isolate the existing compressor, using its actual unlock() parameters unchanged.
   compressor.disconnect();compressor.connect(ctx.destination);
   const osc=ctx.createOscillator(), gain=ctx.createGain();osc.frequency.value=997;gain.gain.value=10**(inputDb/20);osc.connect(gain);gain.connect(compressor);osc.start();
   const rendered=await ctx.startRendering(), outputRms=rms(rendered.getChannelData(0).slice(48000,96000));
   makeup.push({inputPeakDbfs:inputDb,outputRmsDbfs:db(outputRms),makeupDb:db(outputRms/(10**(inputDb/20)/Math.SQRT2))});
  }
  const curves=[];
  for(const amplitude of [.1,.63,2]) {
   const ctx=new OfflineAudioContext(1,48000,48000), b=ctx.createBuffer(1,48000,48000), x=b.getChannelData(0);
   for(let i=0;i<x.length;i++) x[i]=amplitude*Math.sin(2*Math.PI*997*i/48000);
   const src=ctx.createBufferSource();src.buffer=b;const node=ctx.createWaveShaper();node.curve=window.masterLimiterCurve();node.oversample='none';src.connect(node);node.connect(ctx.destination);src.start();
   const y=(await ctx.startRendering()).getChannelData(0);let peak=0,error=0;
   for(let i=0;i<y.length;i++){peak=Math.max(peak,Math.abs(y[i]));error=Math.max(error,Math.abs(y[i]-x[i]));}
   curves.push({amplitude,peakDbfs:db(peak),maxSampleError:error,gainDb:db(rms(y)/rms(x))});
  }
  return {parameters,makeup,curves};
 });
 assert.deepEqual(errors,{console:[],page:[],external:[]});
 for(const c of result.curves){assert.ok(c.peakDbfs<=-1);if(c.amplitude<=.63)assert.ok(Math.abs(c.gainDb)<.001);}
 await writeFile(resolve(out,'compressor-probe.json'),JSON.stringify({browserVersion:browser.version(),...result,errors},null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
