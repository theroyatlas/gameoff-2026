/** 以實際呈現間隔量測；每個連續三秒低於 45 FPS 的視窗下降一級。 */
export class AdaptiveQuality {
  level = 0;
  fps = 0;
  private elapsed = 0;
  private frames = 0;
  private warmup = 2000;
  resetWindow() { this.elapsed = 0; this.frames = 0; this.warmup = 2000; }
  sample(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return false;
    if (this.warmup > 0) { this.warmup -= milliseconds; return false; }
    this.elapsed += milliseconds; this.frames++;
    if (this.elapsed < 3000) return false;
    this.fps = this.frames * 1000 / this.elapsed;
    this.elapsed = this.frames = 0;
    if (this.fps >= 45 || this.level >= 3) return false;
    this.level++;
    return true;
  }
}
