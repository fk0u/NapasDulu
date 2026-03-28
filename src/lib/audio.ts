// Web Audio API Synthesizer Minimalist
// To run: import { audioSynth } from './lib/audio'

class AudioSynth {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    // A techy boot sound when starting the dashboard
    public playBootSequence() {
        try {
            this.init();
            if(!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.5);

            gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 1.0);
        } catch(e) {}
    }

    // Low pulsing drone
    public playBreathingDrone(phase: "inhale" | "hold" | "exhale") {
         try {
            this.init();
            if(!this.ctx) return;
            
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = "sine";
            
            if(phase === "inhale") {
                osc.frequency.setValueAtTime(50, this.ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 4.0);
                gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2.0);
                osc.start();
                osc.stop(this.ctx.currentTime + 4.0);
            } else if (phase === "hold") {
                osc.frequency.setValueAtTime(100, this.ctx.currentTime);
                gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 7.0);
                osc.start();
                osc.stop(this.ctx.currentTime + 7.0);
            } else {
                osc.frequency.setValueAtTime(100, this.ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 8.0);
                gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 8.0);
                osc.start();
                osc.stop(this.ctx.currentTime + 8.0);
            }

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
         } catch(e) {}
    }

    public playWarningSiren() {
        try {
            this.init();
            if(!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = "square";
            osc.frequency.setValueAtTime(400, this.ctx.currentTime);
            osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.3);
            osc.frequency.setValueAtTime(400, this.ctx.currentTime + 0.6);
            osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.9);

            gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 1.2);
        } catch(e) {}
    }

    public playSciFiAlarm() {
        try {
            this.init();
            if(!this.ctx) return;
            // Create a jarring, high-pitched multi-oscillator sci-fi siren
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const lfo = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            // Main tones
            osc1.type = "sawtooth";
            osc2.type = "square";
            
            // LFO for the frequency modulation (siren warble effect)
            lfo.type = "sine";
            lfo.frequency.value = 8; // 8 Hz warble

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 300; // Pitch variation range
            lfo.connect(lfoGain);
            lfoGain.connect(osc1.frequency);
            lfoGain.connect(osc2.frequency);

            // Starting frequencies
            osc1.frequency.setValueAtTime(1200, this.ctx.currentTime);
            osc2.frequency.setValueAtTime(1250, this.ctx.currentTime);

            // Volume envelope
            gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime + 1.0);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            osc1.start();
            osc2.start();
            lfo.start();
            
            osc1.stop(this.ctx.currentTime + 1.5);
            osc2.stop(this.ctx.currentTime + 1.5);
            lfo.stop(this.ctx.currentTime + 1.5);
        } catch(e) {}
    }
}

export const audioSynth = new AudioSynth();
