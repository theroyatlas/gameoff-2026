import './ui-skins.css';
import { paperBase, walnutTexture } from './style1';
import type { ArtVariant } from './art-round2';

/**
 * 介面手作感三版（?ui=a|b|c）。版面、文字、按鈕位置都不動，只換材質：
 * a 紙卡（02-board-closeup 的紙卡：纖維、套印邊框、歪放）；
 * b 胡桃木框（01-same-angle／style-1.png 的上油木框、角塊、黃銅細邊與刻度）；
 * c 毛線與暖光（01／04 的毛線、style-1.png 單盞暖燈照出的光池）。
 * 紋理全部由程式畫在 Canvas，再以 data URL 交給 CSS；不載入外部圖檔。
 */
export function applyUiSkin(variant: ArtVariant) {
  const body = document.body; body.dataset.ui = variant;
  if (variant === 'a') {
    const c = document.createElement('canvas'); c.width = c.height = 256; paperBase(c.getContext('2d')!, 256, 256, 1201);
    body.style.setProperty('--tex-paper', `url(${c.toDataURL('image/png')})`);
  }
  if (variant === 'b') {
    const light = walnutTexture(256, true, false, 1301).image as HTMLCanvasElement, dark = walnutTexture(256, false, false, 1303).image as HTMLCanvasElement;
    body.style.setProperty('--tex-walnut', `url(${light.toDataURL('image/png')})`);
    body.style.setProperty('--tex-walnut-dark', `url(${dark.toDataURL('image/png')})`);
  }
}
