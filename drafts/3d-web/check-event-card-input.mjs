// 查看手勢在可發射的回合內不誤射，並量測新增卡文與控制項。
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [], errors = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    await context.route(/^https?:/, r => { errors.push('external request'); return r.abort(); });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(resolve(import.meta.dirname, 'dist-event-cards/index.html')).href);
    await page.locator('#board-start').click(); await page.locator('#board-roll').click();
    await page.waitForFunction(() => window.boardEvidence.snapshot().game.board.phase === 'shooting');
    await page.locator('#board-fire').click();
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 100));
    const before = await page.evaluate(() => window.boardEvidence.snapshot().game);
    if (before.status !== 'playing' || before.board.phase !== 'shooting') throw new Error('必須在可發射回合測試');
    await page.locator('#board-inspect-toggle').focus(); await page.keyboard.press('Space');
    if (await page.locator('#board-inspect-toggle').getAttribute('aria-pressed') !== 'true') throw new Error('鍵盤未開啟查看');
    await page.locator('#board-scene').scrollIntoViewIfNeeded();
    const ball = before.balls.at(-1);
    const p = await page.evaluate(b => window.boardEvidence.project(b.x, b.y, .14), ball);
    if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    const text = await page.locator('#board-inspect').textContent();
    // 受控時鐘下補一幀，呈現剛剛的查看狀態。
    await page.clock.runFor(20);
    const after = await page.evaluate(() => window.boardEvidence.snapshot().game);
    const inspected = await page.locator('#board-inspect').textContent();
    if (after.shots !== before.shots || !inspected.includes(`球 #${ball.id}`)) throw new Error('查看誤射或球號不符');
    await page.locator('#board-scene').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
    if (await page.locator('#board-inspect-toggle').getAttribute('aria-pressed') !== 'false') throw new Error('Esc 未結束查看');
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('#board-card'), button = document.querySelector('#board-inspect-toggle');
      const s = getComputedStyle(card), r = button.getBoundingClientRect();
      return { cardRole: card.getAttribute('role'), fontSize: s.fontSize, foreground: s.color, background: s.backgroundColor,
        buttonWidth: r.width, buttonHeight: r.height, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    results.push({ mobile, status: before.status, phase: before.board.phase, beforeShots: before.shots, afterShots: after.shots, inspected, keyboard: true, metrics });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(resolve(import.meta.dirname, '../../../review-event-cards/input-audit.json'), JSON.stringify({ results, errors, pass: !errors.length && results.length === 2 }, null, 2));
console.log(JSON.stringify({ results, errors }));
