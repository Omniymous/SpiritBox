export class AudioEngine {
  constructor() {
    this.context = null;
    this.noiseNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.modulatorNode = null;
    this.oscillator = null;
    this.evpSounds = [
      { freq: [100, 300], duration: [50, 150], type: 'evp' },
      { freq: [400, 800], duration: [100, 200], type: 'ghost' },
      { freq: [520, 1710], duration: [75, 175], type: 'am' },
      { freq: [87500, 108000], duration: [50, 100], type: 'fm' }
    ];
    this.reverbNode = null;
    this.delayNode = null;
    this.wetGainNode = null;
    this.dryGainNode = null;
    this.mediaStreamDestination = null;
    this.analyser = null;
    this.dataArray = null;
    this.waveformDataArray = null;
    this.waveformAnalyser = null;
  }

  async init() {
    if (!this.context || this.context.state === 'closed') {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create dry/wet mix nodes
    if (!this.dryGainNode) {
      this.dryGainNode = this.context.createGain();
      this.dryGainNode.gain.value = 0.5;
    }
    
    if (!this.wetGainNode) {
      this.wetGainNode = this.context.createGain();
      this.wetGainNode.gain.value = 0.5;
    }

    if (!this.gainNode) {
      this.gainNode = this.context.createGain();
      this.dryGainNode.connect(this.gainNode);
      this.wetGainNode.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);
    }

    if (!this.filterNode) {
      this.filterNode = this.context.createBiquadFilter();
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.value = 1000;
      this.filterNode.Q.value = 1;
      this.filterNode.connect(this.dryGainNode);
    }

    // Initialize reverb
    if (!this.reverbNode) {
      this.reverbNode = this.context.createConvolver();
      await this.createReverb();
    }

    // Initialize delay
    if (!this.delayNode) {
      this.delayNode = this.context.createDelay(1.0);
      this.delayNode.delayTime.value = 0.3;
    }
    
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // Create MediaStream destination for speech recognition
    if (!this.mediaStreamDestination) {
      this.mediaStreamDestination = this.context.createMediaStreamDestination();
      this.gainNode.connect(this.mediaStreamDestination);
    }

    // Create analyzer node for decibel meter
    if (!this.analyser) {
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.gainNode.connect(this.analyser);
    }

    // Initialize waveform analyzer
    if (!this.waveformAnalyser) {
      this.waveformAnalyser = this.context.createAnalyser();
      this.waveformAnalyser.fftSize = 2048;
      this.waveformDataArray = new Float32Array(this.waveformAnalyser.frequencyBinCount);
      this.gainNode.connect(this.waveformAnalyser);
    }
  }

  async createReverb() {
    const duration = 3;
    const decay = 2.0;
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      leftChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
      rightChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }

    this.reverbNode.buffer = impulse;
  }

  setEffectsSettings({ reverbMix = 0.5, delayMix = 0.5, delayTime = 0.3 }) {
    if (this.wetGainNode && this.dryGainNode) {
      const wetValue = Math.min(Math.max(reverbMix, 0), 1);
      const dryValue = 1 - wetValue;
      
      this.wetGainNode.gain.setValueAtTime(wetValue, this.context.currentTime);
      this.dryGainNode.gain.setValueAtTime(dryValue, this.context.currentTime);
    }

    if (this.delayNode) {
      this.delayNode.delayTime.setValueAtTime(delayTime, this.context.currentTime);
    }
  }

  setVolume(value) {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(value / 100, this.context.currentTime);
    }
  }

  generateNoise() {
    if (this.noiseNode) {
      this.noiseNode.disconnect();
    }

    const bufferSize = 2 * this.context.sampleRate;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.context.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.modulatorNode = this.context.createOscillator();
    const modulatorGain = this.context.createGain();
    
    this.modulatorNode.type = 'sine';
    this.modulatorNode.frequency.value = 0.5;
    modulatorGain.gain.value = 0.2;
    
    this.modulatorNode.connect(modulatorGain);
    modulatorGain.connect(this.gainNode.gain);
    
    // Connect noise through effects chain
    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.dryGainNode);
    this.filterNode.connect(this.reverbNode);
    this.reverbNode.connect(this.delayNode);
    this.delayNode.connect(this.wetGainNode);
    
    this.modulatorNode.start();
    this.noiseNode.start();
    this.startFilterModulation();
  }

  startFilterModulation() {
    const modulate = () => {
      if (!this.filterNode) return;
      
      // Random frequency between 200-3000 Hz
      const newFreq = Math.random() * 2800 + 200;
      // Random Q value for resonance
      const newQ = Math.random() * 5 + 0.5;
      
      this.filterNode.frequency.setValueAtTime(newFreq, this.context.currentTime);
      this.filterNode.Q.setValueAtTime(newQ, this.context.currentTime);
      
      // Schedule next modulation
      setTimeout(modulate, Math.random() * 1000 + 500);
    };
    
    modulate();
  }

  stopNoise() {
    if (this.noiseNode) {
      this.noiseNode.stop();
      this.noiseNode.disconnect();
      this.noiseNode = null;
    }
    if (this.modulatorNode) {
      this.modulatorNode.stop();
      this.modulatorNode.disconnect();
      this.modulatorNode = null;
    }
  }

  getDecibelLevel() {
    if (!this.analyser || !this.dataArray) return -Infinity;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate RMS value
    const sum = this.dataArray.reduce((acc, value) => acc + (value * value), 0);
    const rms = Math.sqrt(sum / this.dataArray.length);
    
    // Convert to decibels
    const db = 20 * Math.log10(rms / 255);
    
    return Math.max(-100, db); // Limit minimum to -100 dB
  }

  getWaveformData() {
    if (!this.waveformAnalyser || !this.waveformDataArray) return null;
    
    this.waveformAnalyser.getFloatTimeDomainData(this.waveformDataArray);
    
    // Process and normalize the data
    const normalizedData = Array.from(this.waveformDataArray)
      .slice(0, 200)
      .map(value => {
        // Apply some smoothing and scaling
        return Math.max(-1, Math.min(1, value * 1.5));
      });
    
    return normalizedData;
  }

  async generateEVP() {
    if (!this.context || this.context.state !== 'running') {
      await this.init();
    }

    const currentFreq = window.spiritBox.frequency;
    const evpType = this.evpSounds.find(sound => 
      currentFreq >= sound.freq[0] && currentFreq <= sound.freq[1]
    ) || this.evpSounds[0];

    // Create multiple oscillators for richer sound
    const oscillators = [];
    const gains = [];
    
    // Number of harmonics
    const numOscillators = 3;
    
    for (let i = 0; i < numOscillators; i++) {
      const frequency = Math.random() * (evpType.freq[1] - evpType.freq[0]) + evpType.freq[0];
      const duration = Math.random() * (evpType.duration[1] - evpType.duration[0]) + evpType.duration[0];
      
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      
      oscillator.type = ['sine', 'square', 'triangle', 'sawtooth'][Math.floor(Math.random() * 4)];
      oscillator.frequency.value = frequency * (i + 1); // Harmonics
      
      // Create envelope
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(0.3 / (i + 1), this.context.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration/1000);
      
      oscillator.connect(gain);
      gain.connect(this.filterNode);
      
      oscillator.start();
      oscillator.stop(this.context.currentTime + duration/1000);
      
      oscillators.push(oscillator);
      gains.push(gain);
    }
    
    return new Promise(resolve => {
      setTimeout(() => {
        oscillators.forEach((osc, i) => {
          osc.disconnect();
          gains[i].disconnect();
        });
        resolve();
      }, evpType.duration[1]);
    });
  }

  cleanup() {
    this.stopNoise();
    if (this.gainNode) this.gainNode.disconnect();
    if (this.filterNode) this.filterNode.disconnect();
    if (this.reverbNode) this.reverbNode.disconnect();
    if (this.delayNode) this.delayNode.disconnect();
    if (this.wetGainNode) this.wetGainNode.disconnect();
    if (this.dryGainNode) this.dryGainNode.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.waveformAnalyser) this.waveformAnalyser.disconnect();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
