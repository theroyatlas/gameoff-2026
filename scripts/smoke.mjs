import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
await mkdir(artifacts,{recursive:true});
const server = await createServer({ root, server: { host: '127.0.0.1', port: 4173, strictPort: false } });
await server.listen();
let browser;
let channel;
const errors = [], externalRequests = [];
const result = { passed: false, shots: 0, errors, externalRequests, channel: '', checks: [] };
try {
  for (const candidate of ['msedge','chrome']) {
    try { browser = await chromium.launch({channel:candidate,headless:true}); channel=candidate; break; }
    catch (error) { if(candidate==='chrome')throw error; }
  }
  result.channel=channel;
  const page = await browser.newPage({viewport:{width:1100,height:1000}});
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('pageerror',err=>errors.push(err.message));
  page.on('request',request=>{if(!/^(https?:\/\/(127\.0\.0\.1|localhost)(:|\/)|file:|data:)/.test(request.url()))externalRequests.push(request.url());});
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button',{name:'開始',exact:true}).click();
  const canvas=page.locator('#game');
  const box=await canvas.boundingBox();
  const x=box.x+400/800*box.width,y=box.y+622/680*box.height;
  for(let i=0;i<10;i++) {
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x+Math.sin(i*1.2)*140,y-180,{steps:12});
    if(i===0)await page.screenshot({path:resolve(artifacts,'aim-desktop.png'),fullPage:true});
    await page.mouse.up();
    await page.waitForFunction(n=>Number(document.querySelector('#game').dataset.shots)===n,i+1);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(2500);
  const snapshot=await page.evaluate(()=>window.resonanceDebug.snapshot());
  assert.equal(snapshot.shots,10); assert.equal(snapshot.balls.length,10);
  assert(snapshot.inputs.every(s=>Math.abs(s.actualAngle-s.angle)<=Math.PI/15));
  result.shots=snapshot.shots; result.bursts=snapshot.events.length; result.bossHp=snapshot.boss.hp;
  result.checks.push('開頁面、滑鼠拖拉發射 10 次、球保留、扇形偏移');
  await page.screenshot({path:resolve(artifacts,'smoke-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(artifacts,'smoke-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  result.checks.push('390px 窄畫面無水平溢出');
  await page.getByRole('button',{name:'重來',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.status==='ready');
  const reset=await page.evaluate(()=>window.resonanceDebug.snapshot());
  assert.equal(reset.shots,0); assert.equal(reset.balls.length,0); assert.equal(reset.boss.hp,snapshot.boss.maxHp);
  assert.equal(reset.events.length,0); assert.equal(reset.contacts.length,0); assert.equal(reset.monsters.length,0);
  result.checks.push('畫面重來完全重置');
  await page.goto(pathToFileURL(resolve(root,'dist/index.html')).href);
  await page.getByRole('button',{name:'開始',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#game').dataset.status==='playing');
  result.checks.push('dist/index.html 直接以 file URL 開啟並開始');
  // 以實際繪圖程式捕捉密集連鎖。只加速測試頁的 RAF 時鐘，不改遊戲狀態。
  const feedbackPage = await browser.newPage({viewport:{width:1100,height:1000}});
  feedbackPage.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  feedbackPage.on('pageerror',error=>errors.push(String(error)));
  await feedbackPage.addInitScript(() => {
    const realRAF = window.requestAnimationFrame.bind(window);
    let time = performance.now();
    window.requestAnimationFrame = callback => realRAF(() => {
      if (window.feedbackCaptured) return;
      time+=250; callback(time);
      const after=window.resonanceDebug?.snapshot();
      if(after?.effects.some(e=>e.kind==='burst'&&e.value>=8&&after.tick-e.tick<30)) {
        window.feedbackCaptured={seed:after.seed,tick:after.tick,shots:after.shots,
          activeEffects:after.effects.length,maxDepth:Math.max(...after.events.map(e=>e.depth))};
      }
    });
  });
  await feedbackPage.goto(server.resolvedUrls.local[0]);
  await feedbackPage.getByRole('button',{name:'開始',exact:true}).click();
  const feedbackBox=await feedbackPage.locator('#game').boundingBox();
  const fx=feedbackBox.x+400/800*feedbackBox.width,fy=feedbackBox.y+622/680*feedbackBox.height;
  let aimState=(20261110^0x9e3779b9)>>>0;
  for(let i=0;i<100;i++) {
    await feedbackPage.waitForFunction(t=>window.feedbackCaptured||window.resonanceDebug.snapshot().tick>=t,i*240);
    if(await feedbackPage.evaluate(()=>Boolean(window.feedbackCaptured)))break;
    aimState=(Math.imul(aimState,1664525)+1013904223)>>>0;
    const angle=-Math.PI/2+(aimState/4294967296*2-1)*Math.PI/3;
    await feedbackPage.mouse.move(fx,fy); await feedbackPage.mouse.down();
    await feedbackPage.mouse.move(fx+Math.cos(angle)*150/800*feedbackBox.width,fy+Math.sin(angle)*150/680*feedbackBox.height);
    await feedbackPage.mouse.up();
  }
  assert(await feedbackPage.evaluate(()=>Boolean(window.feedbackCaptured)),'未捕捉到八層連鎖');
  result.feedback=await feedbackPage.evaluate(()=>window.feedbackCaptured);
  await feedbackPage.screenshot({path:resolve(artifacts,'feedback-desktop.png'),fullPage:true});
  await feedbackPage.setViewportSize({width:390,height:844});
  await feedbackPage.screenshot({path:resolve(artifacts,'feedback-mobile.png'),fullPage:true});
  assert(await feedbackPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  result.checks.push('實際八層連鎖回饋：桌面與 390px 截圖，RAF 時鐘加速，非真人試玩');
  await feedbackPage.close();
  assert.deepEqual(errors,[]); assert.deepEqual(externalRequests,[]);
  result.checks.push('console error = 0、page error = 0、外部資源請求 = 0'); result.passed=true;
} finally {
  await writeFile(resolve(artifacts,'smoke-result.json'),JSON.stringify(result,null,2)+'\n');
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(result,null,2));
