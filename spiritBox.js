import { AudioEngine } from './audioEngine.js';

class SpiritBox {
  constructor() {
    this.frequency = 87.5;
    this.mode = 'FM';
    this.isOn = false;
    this.sweepInterval = null;
    this.audioEngine = new AudioEngine();
    this.evpChance = 0.1; // 10% chance of EVP per sweep
    this.lastEvpTime = 0;
    this.evpCooldown = 2000; // Minimum time between EVPs
    
    this.frequencyRanges = {
      fm: { min: 87.5, max: 108.0, step: 0.1, unit: 'MHz' },
      am: { min: 520, max: 1710, step: 10, unit: 'kHz' },
      evp: { min: 100, max: 300, step: 1, unit: 'Hz' },
      ghost: { min: 400, max: 800, step: 1, unit: 'Hz' },
      custom: { min: 0, max: 0, step: 0.1, unit: 'Hz' }
    };
    
    this.currentRange = this.frequencyRanges.fm;
    
    this.speechRecognition = null;
    this.transcribedWords = new Map(); // Store word frequency
    this.initializeSpeechRecognition();
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupEffectsControls();
    
    this.updateFrequencyVisualization = this.updateFrequencyVisualization.bind(this);
    this.initializeVisualization();
    
    // Add new properties for frequency visualization
    this.graphBars = [];
    this.numBars = 50; // Number of bars in the frequency graph
    this.initializeFrequencyGraph();
    
    // Bind cleanup to window unload
    window.addEventListener('unload', () => {
      this.cleanup();
    });
    this.decibelUpdateInterval = null;
    this.updateSpeedIndicator = this.updateSpeedIndicator.bind(this);
    
    setInterval(() => {
      if (this.isOn) {
        this.createGhostTrail();
      }
    }, 2000);

    // Add button hover effect tracking
    document.querySelectorAll('button').forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / button.offsetWidth) * 100;
        const y = ((e.clientY - rect.top) / button.offsetHeight) * 100;
        button.style.setProperty('--x', `${x}%`);
        button.style.setProperty('--y', `${y}%`);
      });
    });
    
    // Update the SpiritBox class with enhanced scanning visualization
    this.scanLine = null;
    this.isScanning = false;
    this.lastUpdateTime = 0;
    this.frameCount = 0;
    
    // Initialize scanning visualization
    this.initializeScanningVisuals();
    
    // Add speed labels
    this.speedLabels = {
      50: 'Very Fast',
      150: 'Fast',
      250: 'Normal',
      350: 'Slow',
      500: 'Very Slow'
    };
    
    this.setupSpeedControls();
    
    // Add waveform visualization properties
    this.waveformCanvas = null;
    this.waveformCtx = null;
    this.waveformData = new Array(200).fill(0);
    this.initializeWaveform();
    
    // Start waveform animation
    this.animateWaveform();
    
    this.peakDecibelLevel = -Infinity;
    this.peakHoldTimer = null;
    this.decibelHistory = new Array(30).fill(-100);
    
    // Add decibel marks initialization
    this.initializeDecibelMarks();
  }

  createGhostTrail() {
    const trails = document.querySelector('.ghost-trails');
    if (!trails) return;
    
    const trail = document.createElement('div');
    trail.className = 'ghost-trail';
    
    // Random start and end positions
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    const endX = Math.random() * window.innerWidth;
    const endY = Math.random() * window.innerHeight;
    
    trail.style.setProperty('--start-x', `${startX}px`);
    trail.style.setProperty('--start-y', `${startY}px`);
    trail.style.setProperty('--end-x', `${endX}px`);
    trail.style.setProperty('--end-y', `${endY}px`);
    
    trail.style.animation = 'ghostTrail 4s ease-in-out forwards';
    
    trails.appendChild(trail);
    
    // Remove the trail element after animation
    setTimeout(() => {
      trails.removeChild(trail);
    }, 4000);
  }

  initializeElements() {
    this.powerBtn = document.querySelector('.power-btn');
    this.modeBtn = document.querySelector('.mode-btn');
    this.frequencyDisplay = document.querySelector('.frequency');
    this.activeFrequency = document.querySelector('.active-frequency');
    this.modeDisplay = document.querySelector('.mode');
    this.speedSlider = document.getElementById('speed');
    this.speedValue = document.querySelector('.speed-value');
    this.speedDot = document.querySelector('.speed-dot');
    this.volumeControl = document.getElementById('volume');
    this.bandSelect = document.getElementById('band');
    this.customRange = document.querySelector('.custom-range');
    this.minFreqInput = document.getElementById('minFreq');
    this.maxFreqInput = document.getElementById('maxFreq');
    this.stepInput = document.getElementById('step');
    this.reverbControl = document.getElementById('reverb');
    this.delayTimeControl = document.getElementById('delayTime');
    this.reverbValue = document.getElementById('reverbValue');
    this.delayTimeValue = document.getElementById('delayTimeValue');
    this.clips = document.querySelectorAll('.clip');
    this.meter = document.querySelector('.meter');
    this.logEntries = document.querySelector('.log-entries');
    this.rangeInfo = document.querySelector('.range-info');
    this.frequencyMarker = document.querySelector('.frequency-marker');
    this.scaleStart = document.querySelector('.scale-start');
    this.scaleEnd = document.querySelector('.scale-end');
  }

  setupEventListeners() {
    this.powerBtn.addEventListener('click', () => this.togglePower());
    this.modeBtn.addEventListener('click', () => this.toggleMode());
    this.speedSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.updateSpeedIndicator(value);
      this.updateSpeedLabels(value);
      this.updateSweepSpeed();
      
      // Update scan line animation duration
      if (this.scanLine) {
        this.scanLine.style.animationDuration = `${value * 4}ms`;
      }
      
      // Update graph animation timing
      document.documentElement.style.setProperty('--sweep-duration', `${value}ms`);
    });
    this.volumeControl.addEventListener('input', (e) => {
      this.audioEngine.setVolume(e.target.value);
    });
    
    this.bandSelect.addEventListener('change', (e) => this.handleBandChange(e));
    this.minFreqInput.addEventListener('change', () => this.updateCustomRange());
    this.maxFreqInput.addEventListener('change', () => this.updateCustomRange());
    this.stepInput.addEventListener('change', () => this.updateSweepStep());
  }

  setupEffectsControls() {
    this.reverbControl.addEventListener('input', () => {
      const value = this.reverbControl.value;
      this.reverbValue.textContent = `${value}%`;
      this.updateEffects();
    });

    this.delayTimeControl.addEventListener('input', () => {
      const value = this.delayTimeControl.value;
      this.delayTimeValue.textContent = `${value}ms`;
      this.updateEffects();
    });
  }

  setupSpeedControls() {
    const speedControl = document.querySelector('.speed-control');
    const speedLabelsContainer = document.createElement('div');
    speedLabelsContainer.className = 'speed-labels';
    
    // Create labels for different speed values
    Object.entries(this.speedLabels).forEach(([value, label]) => {
      const labelEl = document.createElement('span');
      labelEl.className = 'speed-label';
      labelEl.textContent = label;
      labelEl.style.left = `${((value - 50) / (500 - 50)) * 100}%`;
      speedLabelsContainer.appendChild(labelEl);
    });
    
    speedControl.appendChild(speedLabelsContainer);
  }

  initializeVisualization() {
    this.updateRangeDisplay();
    this.updateFrequencyVisualization();
  }

  initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
      this.speechRecognition = new webkitSpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event) => {
        this.handleSpeechResult(event);
      };

      this.speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };
    }
  }

  initializeFrequencyGraph() {
    const graphContainer = document.querySelector('.frequency-graph');
    if (!graphContainer) return;
    
    graphContainer.innerHTML = ''; // Clear existing bars
    this.graphBars = [];
    
    for (let i = 0; i < this.numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'graph-bar';
      bar.style.height = '0%';
      graphContainer.appendChild(bar);
      this.graphBars.push(bar);
    }
  }

  updateFrequencyGraph(frequencyData = null) {
    if (!frequencyData) {
      // Generate dummy frequency data if none provided
      frequencyData = Array(this.numBars).fill(0).map(() => 
        this.isOn ? Math.random() * 100 : 0
      );
    }
    
    const bars = this.graphBars;
    if (!bars || !bars.length) return;

    frequencyData.forEach((value, index) => {
      if (bars[index]) {
        const height = `${value}%`;
        bars[index].style.height = height;
        
        // Add glow effect based on intensity
        const glow = Math.min(value / 20, 1);
        bars[index].style.boxShadow = `0 0 ${glow * 10}px var(--display-text)`;
      }
    });
  }

  updateRangeDisplay() {
    const {min, max, unit} = this.currentRange;
    this.rangeInfo.textContent = `Range: ${min}-${max}${unit}`;
    this.scaleStart.textContent = min;
    this.scaleEnd.textContent = max;
  }

  updateFrequencyVisualization() {
    const {min, max} = this.currentRange;
    const percentage = ((this.frequency - min) / (max - min)) * 100;
    this.frequencyMarker.style.left = `${percentage}%`;
  }

  handleBandChange(e) {
    const band = e.target.value;
    this.customRange.classList.toggle('hidden', band !== 'custom');
    
    if (band === 'custom') {
      this.updateCustomRange();
    } else {
      this.currentRange = this.frequencyRanges[band];
      this.frequency = this.currentRange.min;
      this.stepInput.value = this.currentRange.step;
      this.updateFrequencyDisplay();
    }
    
    this.updateRangeDisplay();
    this.updateFrequencyVisualization();
    
    if (this.isOn) {
      this.stopSweep();
      this.startSweep();
    }
  }

  updateCustomRange() {
    const min = parseFloat(this.minFreqInput.value);
    const max = parseFloat(this.maxFreqInput.value);
    
    if (min < max) {
      this.currentRange = {
        min,
        max,
        step: parseFloat(this.stepInput.value),
        unit: 'Hz'
      };
      this.frequency = min;
      this.updateFrequencyDisplay();
      
      this.updateRangeDisplay();
      this.updateFrequencyVisualization();
      
      if (this.isOn) {
        this.stopSweep();
        this.startSweep();
      }
    }
  }

  updateSweepStep() {
    const step = parseFloat(this.stepInput.value);
    if (step > 0) {
      this.currentRange.step = step;
      if (this.isOn) {
        this.stopSweep();
        this.startSweep();
      }
    }
  }

  async togglePower() {
    try {
      this.isOn = !this.isOn;
      this.powerBtn.classList.toggle('active');
      
      if (this.isOn) {
        await this.audioEngine.init();
        this.audioEngine.setVolume(this.volumeControl.value);
        this.audioEngine.generateNoise();
        this.startSweep();
        this.startDecibelMeter();
        if (this.speechRecognition) {
          this.speechRecognition.start();
        }
      } else {
        this.stopSweep();
        this.stopDecibelMeter();
        this.audioEngine.stopNoise();
        if (this.speechRecognition) {
          this.speechRecognition.stop();
        }
      }
    } catch (error) {
      console.error('Error toggling power:', error);
      this.isOn = false;
      this.powerBtn.classList.remove('active');
    }
  }

  toggleMode() {
    if (!this.isOn) return;
    
    this.mode = this.mode === 'FM' ? 'AM' : 'FM';
    this.modeDisplay.textContent = this.mode;
    
    // Reset frequency range based on mode
    if (this.mode === 'FM') {
      this.frequency = 87.5;
    } else {
      this.frequency = 520;
    }
    this.updateFrequencyDisplay();
  }

  startSweep() {
    const speed = parseInt(this.speedSlider.value);
    this.updateSpeedIndicator(speed);
    this.sweepInterval = setInterval(() => this.sweep(), speed);
    this.isScanning = true;
    this.scanLine?.classList.add('active');
    
    // Update scan animation duration based on sweep speed
    if (this.scanLine) {
      this.scanLine.style.animationDuration = `${speed * 4}ms`;
    }
  }

  stopSweep() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.isScanning = false;
    this.scanLine?.classList.remove('active');
  }

  sweep() {
    this.frequency += this.currentRange.step;
    if (this.frequency > this.currentRange.max) {
      this.frequency = this.currentRange.min;
    }
    
    this.updateFrequencyDisplay();
    this.updateSignalStrength();
    this.updateFrequencyVisualization();
    
    // Generate dynamic frequency data based on current frequency
    const frequencyData = Array(this.numBars).fill(0).map(() => {
      // Create peaks around the current frequency position
      const position = (this.frequency - this.currentRange.min) / 
        (this.currentRange.max - this.currentRange.min) * this.numBars;
      const distance = Math.abs(position - Math.random() * this.numBars);
      return Math.max(0, 100 - distance * 10) * Math.random();
    });
    
    this.updateFrequencyGraph(frequencyData);
    
    if (this.shouldTriggerEVP()) {
      this.triggerEVP();
    }
  }

  updateFrequencyDisplay() {
    let displayFreq = this.frequency;
    if (this.currentRange.unit === 'MHz') {
      displayFreq = displayFreq.toFixed(1);
    } else {
      displayFreq = Math.round(displayFreq);
    }
    this.activeFrequency.textContent = `${displayFreq}`;
    this.updateFrequencyVisualization();
  }

  updateSweepSpeed() {
    const speed = parseInt(this.speedSlider.value);
    
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = setInterval(() => this.sweep(), speed);
    }
    
    // Update scanning visual elements
    if (this.scanLine) {
      this.scanLine.style.animationDuration = `${speed * 4}ms`;
    }
    
    // Update frequency graph transition timing
    document.documentElement.style.setProperty('--graph-transition', `${speed * 0.8}ms`);
  }

  updateSignalStrength() {
    const strength = Math.random() * 100;
    this.meter.style.width = `${strength}%`;
  }

  shouldTriggerEVP() {
    const now = Date.now();
    if (now - this.lastEvpTime < this.evpCooldown) return false;
    return Math.random() < this.evpChance;
  }

  async triggerEVP() {
    this.lastEvpTime = Date.now();
    const clipIndex = Math.floor(Math.random() * this.clips.length);
    this.clips[clipIndex].classList.add('active');
    
    await this.audioEngine.generateEVP();
    
    this.logEvp();
    setTimeout(() => {
      this.clips[clipIndex].classList.remove('active');
    }, 1000);
  }

  logEvp() {
    const evpPhrases = [
      "Unknown voice detected",
      "Possible EVP captured",
      "Signal anomaly recorded",
      "Frequency disturbance",
      "Spirit communication attempt"
    ];
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `${new Date().toLocaleTimeString()} - ${evpPhrases[Math.floor(Math.random() * evpPhrases.length)]}`;
    
    this.logEntries.insertBefore(entry, this.logEntries.firstChild);
    
    // Keep only last 10 entries
    while (this.logEntries.children.length > 10) {
      this.logEntries.removeChild(this.logEntries.lastChild);
    }
  }

  updateEffects() {
    if (this.audioEngine) {
      this.audioEngine.setEffectsSettings({
        reverbMix: this.reverbControl.value / 100,
        delayTime: this.delayTimeControl.value / 1000
      });
    }
  }

  handleSpeechResult(event) {
    const transcriptionDisplay = document.querySelector('.transcription-display');
    const confidenceBar = document.querySelector('.confidence-bar');
    const wordCloud = document.querySelector('.word-cloud');
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();
      const confidence = event.results[i][0].confidence;
      
      if (event.results[i].isFinal) {
        // Update transcription display
        const timestamp = new Date().toLocaleTimeString();
        transcriptionDisplay.innerHTML = 
          `<div style="opacity: 0.7">${timestamp}</div>` +
          `<div>${transcript}</div>`;

        // Update confidence meter
        confidenceBar.style.width = `${confidence * 100}%`;

        // Update word cloud
        const words = transcript.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) { // Ignore very short words
            const count = this.transcribedWords.get(word) || 0;
            this.transcribedWords.set(word, count + 1);
          }
        });

        this.updateWordCloud(wordCloud);
        this.logEvpTranscription(transcript, confidence);
      }
    }
  }

  updateWordCloud(container) {
    container.innerHTML = '';
    
    // Sort words by frequency
    const sortedWords = [...this.transcribedWords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Show top 10 words

    sortedWords.forEach(([word, count]) => {
      const tag = document.createElement('span');
      tag.className = 'word-tag';
      tag.textContent = `${word} (${count})`;
      container.appendChild(tag);
    });
  }

  logEvpTranscription(transcript, confidence) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      ${new Date().toLocaleTimeString()} - 
      EVP Transcription (${Math.round(confidence * 100)}% confidence):
      "${transcript}"
    `;
    
    const logEntries = document.querySelector('.log-entries');
    logEntries.insertBefore(entry, logEntries.firstChild);
    
    while (logEntries.children.length > 10) {
      logEntries.removeChild(logEntries.lastChild);
    }
  }

  startDecibelMeter() {
    const decibelFill = document.querySelector('.decibel-fill');
    const decibelValue = document.querySelector('.decibel-value');
    const decibelBar = document.querySelector('.decibel-bar');
    
    if (!this.peakIndicator) {
      this.peakIndicator = document.createElement('div');
      this.peakIndicator.className = 'decibel-peak';
      decibelBar.appendChild(this.peakIndicator);
    }
    
    this.decibelUpdateInterval = setInterval(() => {
      const db = this.audioEngine.getDecibelLevel();
      
      // Update history array for smoother transitions
      this.decibelHistory.push(db);
      this.decibelHistory.shift();
      
      // Calculate smoothed value
      const smoothedDb = this.decibelHistory.reduce((a, b) => a + b) / this.decibelHistory.length;
      
      // Convert dB to percentage (assuming range from -100 to 0 dB)
      const percentage = Math.max(0, Math.min(100, (smoothedDb + 100)));
      
      // Update fill with smooth transition
      decibelFill.style.width = `${percentage}%`;
      
      // Update peak indicator
      if (smoothedDb > this.peakDecibelLevel) {
        this.peakDecibelLevel = smoothedDb;
        this.peakIndicator.style.left = `${percentage}%`;
        
        // Reset peak hold timer
        if (this.peakHoldTimer) clearTimeout(this.peakHoldTimer);
        this.peakHoldTimer = setTimeout(() => {
          this.peakDecibelLevel = -Infinity;
        }, 2000);
      }
      
      // Update numerical display with formatting
      const displayValue = smoothedDb === -Infinity ? '-∞' : smoothedDb.toFixed(1);
      decibelValue.textContent = `${displayValue} dB`;
      
      // Add visual feedback for active state
      decibelBar.classList.toggle('decibel-active', smoothedDb > -50);
      
      // Trigger EVP detection if signal is strong
      if (smoothedDb > -20 && this.shouldTriggerEVP()) {
        this.triggerEVP();
      }
    }, 50); // Update more frequently for smoother animation
  }

  stopDecibelMeter() {
    if (this.decibelUpdateInterval) {
      clearInterval(this.decibelUpdateInterval);
      this.decibelUpdateInterval = null;
    }
    if (this.peakHoldTimer) {
      clearTimeout(this.peakHoldTimer);
      this.peakHoldTimer = null;
    }
    this.peakDecibelLevel = -Infinity;
    this.decibelHistory = new Array(30).fill(-100);
  }

  initializeDecibelMarks() {
    const decibelBar = document.querySelector('.decibel-bar');
    const scale = document.createElement('div');
    scale.className = 'decibel-scale';
    
    // Add marking points at -60, -40, -20, and 0 dB
    [-60, -40, -20, 0].forEach(value => {
      const mark = document.createElement('div');
      mark.className = 'decibel-mark';
      mark.setAttribute('data-value', value);
      scale.appendChild(mark);
    });
    
    decibelBar.appendChild(scale);
  }

  updateSpeedIndicator(value) {
    if (!this.speedDot) return;
    
    // Calculate position percentage
    const percentage = ((value - 50) / (500 - 50)) * 100;
    
    // Update dot position with smooth transition
    this.speedDot.style.left = `${percentage}%`;
    
    // Update value display
    this.speedValue.textContent = `${value}ms`;
    
    // Add visual feedback based on speed
    if (value <= 150) {
      this.speedDot.style.boxShadow = '0 0 10px #ff0000';
    } else if (value >= 400) {
      this.speedDot.style.boxShadow = '0 0 10px #00ff00';
    } else {
      this.speedDot.style.boxShadow = '0 0 5px var(--display-text)';
    }
  }

  updateSpeedLabels(currentValue) {
    const labels = document.querySelectorAll('.speed-label');
    labels.forEach(label => {
      const labelValue = parseInt(label.style.left);
      const isClosest = Math.abs(labelValue - currentValue) < 50;
      label.classList.toggle('active', isClosest);
    });
  }

  initializeScanningVisuals() {
    this.scanLine = document.querySelector('.scan-line');
    // Initialize frequency graph with default data
    this.updateFrequencyGraph(Array(50).fill(0));
    
    // Start animation loop
    this.animate();
  }

  animate() {
    if (this.isOn) {
      const now = performance.now();
      const deltaTime = now - this.lastUpdateTime;
      
      if (deltaTime >= 16) { // Cap at ~60fps
        this.frameCount++;
        this.updateVisualization();
        this.lastUpdateTime = now;
      }
    }
    
    requestAnimationFrame(() => this.animate());
  }

  updateVisualization() {
    if (!this.isOn) return;
    
    // Generate some random frequency data for visualization
    const frequencyData = Array(50).fill(0).map(() => {
      return Math.random() * 100 * (this.isOn ? 1 : 0.1);
    });
    
    // Add some peaks near the current frequency
    const currentIndex = Math.floor((this.frequency - this.currentRange.min) / 
      (this.currentRange.max - this.currentRange.min) * 50);
    
    if (currentIndex >= 0 && currentIndex < 50) {
      frequencyData[currentIndex] = 80 + Math.random() * 20;
      if (currentIndex > 0) frequencyData[currentIndex - 1] = 60 + Math.random() * 20;
      if (currentIndex < 49) frequencyData[currentIndex + 1] = 60 + Math.random() * 20;
    }
    
    this.updateFrequencyGraph(frequencyData);
  }

  initializeWaveform() {
    // Create and setup waveform canvas
    this.waveformCanvas = document.querySelector('.waveform-canvas');
    if (this.waveformCanvas) {
      this.waveformCtx = this.waveformCanvas.getContext('2d');
      this.resizeWaveform();
      
      // Handle resize events
      window.addEventListener('resize', () => this.resizeWaveform());
    }
  }

  resizeWaveform() {
    if (!this.waveformCanvas) return;
    
    const container = this.waveformCanvas.parentElement;
    this.waveformCanvas.width = container.offsetWidth;
    this.waveformCanvas.height = container.offsetHeight;
  }

  animateWaveform() {
    const drawWaveform = () => {
      if (!this.waveformCtx || !this.isOn) {
        requestAnimationFrame(drawWaveform);
        return;
      }

      // Get current audio data
      const audioData = this.audioEngine.getWaveformData();
      
      // Smooth transition of waveform data
      this.waveformData = this.waveformData.map((prev, i) => {
        const target = audioData ? audioData[i] || 0 : 0;
        return prev + (target - prev) * 0.2;
      });

      // Clear canvas
      this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
      
      // Draw waveform
      this.waveformCtx.beginPath();
      this.waveformCtx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--display-text').trim();
      this.waveformCtx.lineWidth = 2;
      
      const width = this.waveformCanvas.width;
      const height = this.waveformCanvas.height;
      const centerY = height / 2;
      
      // Move to start point
      this.waveformCtx.moveTo(0, centerY + (this.waveformData[0] * centerY));
      
      // Draw smooth curve through points
      for (let i = 1; i < this.waveformData.length; i++) {
        const x = (i / (this.waveformData.length - 1)) * width;
        const y = centerY + (this.waveformData[i] * centerY);
        
        if (i === 1) {
          this.waveformCtx.lineTo(x, y);
        } else {
          const xc = (x + ((i - 1) / (this.waveformData.length - 1)) * width) / 2;
          const yc = (y + (centerY + (this.waveformData[i - 1] * centerY))) / 2;
          this.waveformCtx.quadraticCurveTo(xc, yc, x, y);
        }
      }
      
      this.waveformCtx.stroke();
      
      // Add glow effect
      this.waveformCtx.shadowColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--display-text').trim();
      this.waveformCtx.shadowBlur = 10;
      this.waveformCtx.stroke();

      requestAnimationFrame(drawWaveform);
    };

    drawWaveform();
  }

  cleanup() {
    this.stopSweep();
    this.stopDecibelMeter();
    if (this.audioEngine) {
      this.audioEngine.cleanup();
    }
    if (this.speechRecognition) {
      this.speechRecognition.stop();
    }
  }

}

window.spiritBox = new SpiritBox();
