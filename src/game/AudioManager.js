export class AudioManager {
    context = null;
    ensureContext() {
        this.context ??= new AudioContext();
        if (this.context.state === 'suspended')
            void this.context.resume();
        return this.context;
    }
    play(kind) {
        const ctx = this.ensureContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const settings = {
            move: [180, 0.035, 'square'],
            jump: [360, 0.11, 'triangle'],
            collect: [760, 0.15, 'sine'],
            crash: [74, 0.38, 'sawtooth'],
        };
        const [frequency, duration, type] = settings[kind];
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        if (kind === 'collect')
            oscillator.frequency.exponentialRampToValueAtTime(1280, now + duration);
        if (kind === 'crash')
            oscillator.frequency.exponentialRampToValueAtTime(32, now + duration);
        gain.gain.setValueAtTime(kind === 'crash' ? 0.08 : 0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
}
