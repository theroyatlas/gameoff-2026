import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  // 從完整局的短波證據選一段，以真實滑鼠輸入重播；只控制測試頁的時鐘。
  const balance = JSON.parse(await readFile(resolve(artifacts,'balance-round2-final.json'),'utf8'));
  const examples = balance.results.flatMap(r => r.games.flatMap(g => g.waves
    .filter(w => w.anyWow && !w.endedByOutcome && w.endSeconds < 120)
    .map(w => ({ strategy:r.strategy, seed:g.seed, median:g.medianWaveBursts, wave:w }))));
  examples.sort((a,b) => Number(b.wave.wow.boss)-Number(a.wave.wow.boss) || a.wave.endTick-b.wave.endTick);
  let example = examples.find(e=>e.seed===20261120&&e.strategy==='random-up') ?? examples[0]; assert(example,'沒有前兩分鐘內自然結束的哇');
  const feedbackPage = await browser.newPage({viewport:{width:1100,height:1000}});
  feedbackPage.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  feedbackPage.on('pageerror',error=>errors.push(String(error)));
  feedbackPage.on('request',request=>{if(!/^(https?:\/\/(127\.0\.0\.1|localhost)(:|\/)|file:|data:)/.test(request.url()))externalRequests.push(request.url());});
  await feedbackPage.addInitScript(() => {
    const realRAF = window.requestAnimationFrame.bind(window);
    let time = 0; window.advanceToTick = 0;
    performance.now = () => time;
    window.requestAnimationFrame = callback => realRAF(() => {
      const before=window.resonanceDebug?.snapshot();
      if(before?.status==='playing' && before.tick < window.advanceToTick) {
        time=Math.min(before.tick+30,window.advanceToTick)*1000/120+.001;
      }
      callback(time);
    });
  });
  await feedbackPage.goto(server.resolvedUrls.local[0]);
  await feedbackPage.locator('#seed').fill(String(example.seed));
  await feedbackPage.getByRole('button',{name:'開始',exact:true}).click();
  const feedbackBox=await feedbackPage.locator('#game').boundingBox();
  const fx=feedbackBox.x+400/800*feedbackBox.width,fy=feedbackBox.y+622/680*feedbackBox.height;
  let aimState=(example.seed^0x9e3779b9)>>>0, nextShot=0;
  const advanceTo = async (tick, allowOutcome = false) => {
    await feedbackPage.evaluate(t=>{window.advanceToTick=t;},tick);
    await feedbackPage.waitForFunction(t=>{
      const s=window.resonanceDebug.snapshot();return s.tick>=t||s.status!=='playing';
    },tick,{polling:20});
    const reached=await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot().tick);
    if(allowOutcome&&reached<tick)return false;
    assert.equal(reached,tick,'重播未到指定 tick'); return true;
  };
  const replayTo = async (endTick, allowOutcome = false) => {
    while(nextShot*240<=endTick) {
      if(!await advanceTo(nextShot*240,allowOutcome))return false;
      if(allowOutcome&&await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot().status!=='playing'))return false;
      aimState=(Math.imul(aimState,1664525)+1013904223)>>>0;
      const offset=aimState/4294967296*2-1;
      const angle=example.strategy==='random-up' ? -Math.PI/2+offset*Math.PI/3
        : Math.atan2(balance.config.boss.y-balance.config.launcher.y,offset*balance.config.boss.radius);
      await feedbackPage.mouse.move(fx,fy); await feedbackPage.mouse.down();
      await feedbackPage.mouse.move(fx+Math.cos(angle)*150/800*feedbackBox.width,fy+Math.sin(angle)*150/680*feedbackBox.height);
      await feedbackPage.mouse.up(); nextShot++;
      assert.equal(await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot().shots),nextShot);
    }
    return await advanceTo(endTick,allowOutcome);
  };
  const { waveStats } = await server.ssrLoadModule('/scripts/balance-sim.ts');
  // 指標座標經瀏覽器精度轉換後，角度會與數學策略有微差；混沌碰撞不能假設整局相同。
  // 先跑完整的實際滑鼠局，用完整局中位數評分，再以相同滑鼠序列重播所觀察到的短波。
  await replayTo(72000,true);
  const browserGame=await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot());
  assert.notEqual(browserGame.status,'playing','滑鼠驗證局逾時');
  const browserStats=waveStats(browserGame.events,browserGame.boss.maxHp,browserGame.tick);
  const browserWave=browserStats.waves.find(w=>w.anyWow&&!w.endedByOutcome&&w.endSeconds<120);
  assert(browserWave,'實際滑鼠局前兩分鐘內沒有自然結束的哇');
  example={...example,wave:browserWave,median:browserStats.medianWaveBursts};
  await feedbackPage.goto(server.resolvedUrls.local[0]);
  await feedbackPage.locator('#seed').fill(String(example.seed));
  await feedbackPage.getByRole('button',{name:'開始',exact:true}).click();
  aimState=(example.seed^0x9e3779b9)>>>0; nextShot=0;
  await replayTo(example.wave.endTick);
  const captured=await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot());
  assert(captured.inputs.every((s,i)=>s.tick===i*240),'發射時刻必須與固定策略一致');
  const observed=waveStats(captured.events,captured.boss.maxHp,captured.tick).waves.at(-1);
  assert(observed,'實際滑鼠序列重播尚無爆發');
  for(const key of ['startTick','endTick','bursts','bossDamage','kills']) assert.equal(observed[key],example.wave[key],`短波 ${key}`);
  assert(observed.durationSeconds<=3);
  assert(observed.bossDamage>=captured.boss.maxHp*.25||observed.kills>=3||(observed.bursts>=8&&observed.bursts>=4*example.median));
  await feedbackPage.screenshot({path:resolve(artifacts,'feedback-desktop.png'),fullPage:true});
  await feedbackPage.setViewportSize({width:390,height:844});
  await feedbackPage.screenshot({path:resolve(artifacts,'feedback-mobile.png'),fullPage:true});
  assert(await feedbackPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await feedbackPage.setViewportSize({width:1100,height:1000});
  // 繼續相同輸入序列，確認這波自然結束，而非只取長波的一段。
  await replayTo(example.wave.endTick+121);
  const completed=await feedbackPage.evaluate(()=>window.resonanceDebug.snapshot());
  assert.equal(completed.events.filter(e=>e.tick>example.wave.endTick&&e.tick<=example.wave.endTick+120).length,0);
  result.feedback={seed:example.seed,strategy:example.strategy,tick:captured.tick,shots:captured.shots,
    wave:example.wave,medianWaveBursts:example.median,quietGapVerified:true,
    browserGame:{status:browserGame.status,seconds:browserGame.tick/120,shots:browserGame.shots,quietRatio:browserStats.quietRatio},
    evidence:'實際滑鼠完整局評分後重播；指標座標精度與數學策略不同，獨立於 80 局模擬；測試頁時鐘加速，非真人試玩'};
  result.checks.push('固定種子短波重播、三秒門檻、Boss 傷害或擊殺或相對爆發數、一秒自然沉寂、桌面與 390px 截圖');
  await feedbackPage.close();
  assert.deepEqual(errors,[]); assert.deepEqual(externalRequests,[]);
  result.checks.push('console error = 0、page error = 0、外部資源請求 = 0'); result.passed=true;
} finally {
  await writeFile(resolve(artifacts,'smoke-result.json'),JSON.stringify(result,null,2)+'\n');
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(result,null,2));
