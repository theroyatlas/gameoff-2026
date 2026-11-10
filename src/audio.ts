import type { Effect } from './game';

/** 音效只在使用者手勢後建立；聲部上限與壓縮器限制密集碰撞音量。 */
export class Sound {
  context?: AudioContext; master?: GainNode; muted = false; voices = 0; played = 0;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -22; compressor.ratio.value = 10;
      this.master.gain.value = this.muted ? 0 : .23;
      this.master.connect(compressor); compressor.connect(this.context.destination);
    }
    void this.context.resume();
  }
  toggle() { this.muted = !this.muted; if(this.context&&this.master)this.master.gain.setTargetAtTime(this.muted?0:.23,this.context.currentTime,.025); }
  play(e: Effect, shifted: boolean) {
    if (!this.context || !this.master || this.voices>=18 || this.muted) return;
    const presets: Partial<Record<Effect['kind'],[number,number,OscillatorType]>> = {
      launch:[160,.12,'triangle'], impact:[100+Math.min(e.value,1500)*.12,.055,'triangle'],
      resonate:[380,.24,'sine'], burst:[220,.3,'triangle'], death:[90,.35,'sawtooth'],
      warning:[260,.6,'sine'], shift:[130,1.3,'sawtooth'], release:[170,1,'triangle'],
    };
    const preset=presets[e.kind]; if(!preset)return;
    const [base,duration,type]=preset, now=this.context.currentTime;
    const frequency=base*2**(Math.min(e.kind==='burst'?e.value:0,12)/12)*(shifted?1.5:1);
    const oscillator=this.context.createOscillator(), gain=this.context.createGain(), filter=this.context.createBiquadFilter();
    oscillator.type=shifted?'sine':type; oscillator.frequency.setValueAtTime(frequency,now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*(e.kind==='death'?.22:e.kind==='shift'?4:.65)),now+duration);
    gain.gain.setValueAtTime(.001,now); gain.gain.linearRampToValueAtTime(e.kind==='impact'?.1:.35,now+.006);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    filter.type='lowpass'; filter.frequency.value=shifted?4200:2400;
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.master);
    this.voices++; this.played++; oscillator.start(now); oscillator.stop(now+duration+.02);
    oscillator.onended=()=>{this.voices--;oscillator.disconnect();filter.disconnect();gain.disconnect();};
  }
}
