class OverseerVoice {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private enabled: boolean = true;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoice();
    // Chrome needs this event to load voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoice();
    }
  }

  private loadVoice() {
    const voices = this.synth.getVoices();
    // Prefer robotic or clinical sounding voices
    this.voice = voices.find(v => 
      v.name.includes("Google UK English Male") || 
      v.name.includes("Microsoft David") ||
      v.lang.includes("en-GB")
    ) || voices[0];
  }

  speak(text: string, priority: boolean = false) {
    if (!this.enabled || !text) return;

    if (priority) {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    
    // Robotic personality settings
    utterance.pitch = 0.8;
    utterance.rate = 0.9;
    utterance.volume = 0.8;

    this.synth.speak(utterance);
  }

  stop() {
    this.synth.cancel();
  }

  setEnabled(val: boolean) {
    this.enabled = val;
  }
}

export const overseerVoice = new OverseerVoice();
