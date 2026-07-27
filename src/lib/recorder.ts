import { AudioLevels, CameraConfig } from '../types';

export interface RecorderEngineOptions {
  cameraConfig: CameraConfig;
  onAudioLevels?: (levels: AudioLevels) => void;
  onTimerTick?: (seconds: number) => void;
}

export class RecorderEngine {
  private displayStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  
  private screenVideoTrack: MediaStreamTrack | null = null;
  private cameraVideoTrack: MediaStreamTrack | null = null;
  private micAudioTrack: MediaStreamTrack | null = null;
  private systemAudioTrack: MediaStreamTrack | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;

  private screenVideoEl: HTMLVideoElement | null = null;
  private cameraVideoEl: HTMLVideoElement | null = null;

  private audioCtx: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;
  private levelCheckInterval: number | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private timerInterval: number | null = null;
  private elapsedSeconds: number = 0;

  private cameraConfig: CameraConfig;
  private onAudioLevels?: (levels: AudioLevels) => void;
  private onTimerTick?: (seconds: number) => void;

  constructor(options: RecorderEngineOptions) {
    this.cameraConfig = options.cameraConfig;
    this.onAudioLevels = options.onAudioLevels;
    this.onTimerTick = options.onTimerTick;
  }

  public updateCameraConfig(config: CameraConfig) {
    this.cameraConfig = config;
  }

  public getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public async startPreviewStreams(): Promise<{ screenStream: MediaStream; cameraStream?: MediaStream }> {
    // 1. Request display media (screen + system audio)
    try {
      this.displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true, // system audio if user grants permission
      });
    } catch (err: any) {
      console.error('Error starting display capture:', err);
      if (err.name === 'NotAllowedError') {
        if (err.message && err.message.includes('permissions policy')) {
          throw new Error('IFRAME_PERMISSION_ERROR: El iFrame restringe la captura de pantalla. Haz clic en "Abrir en nueva pestaña" para grabar.');
        }
        throw new Error('Permiso de captura de pantalla cancelado por el usuario.');
      }
      if (err.name === 'SecurityError') {
        throw new Error('IFRAME_PERMISSION_ERROR: Permisos de iFrame restringidos. Abre la app en una nueva pestaña.');
      }
      throw new Error(err.message || 'Error al iniciar captura de pantalla');
    }

    this.screenVideoTrack = this.displayStream.getVideoTracks()[0] || null;
    const systemAudioTracks = this.displayStream.getAudioTracks();
    if (systemAudioTracks.length > 0) {
      this.systemAudioTrack = systemAudioTracks[0];
    }

    // Handle screen share stop by user from browser UI bar
    if (this.screenVideoTrack) {
      this.screenVideoTrack.onended = () => {
        this.stopRecording();
      };
    }

    // 2. Request mic and camera if enabled
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.micAudioTrack = this.micStream.getAudioTracks()[0] || null;
    } catch (err) {
      console.warn('Microphone permission not granted or mic unavailable:', err);
    }

    if (this.cameraConfig.enabled) {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });
        this.cameraVideoTrack = this.cameraStream.getVideoTracks()[0] || null;
      } catch (err) {
        console.warn('Camera permission not granted or camera unavailable:', err);
      }
    }

    // 3. Setup video elements for canvas rendering
    this.screenVideoEl = document.createElement('video');
    this.screenVideoEl.srcObject = new MediaStream([this.screenVideoTrack!]);
    this.screenVideoEl.muted = true;
    this.screenVideoEl.playsInline = true;
    await this.screenVideoEl.play().catch(() => {});

    if (this.cameraVideoTrack) {
      this.cameraVideoEl = document.createElement('video');
      this.cameraVideoEl.srcObject = new MediaStream([this.cameraVideoTrack]);
      this.cameraVideoEl.muted = true;
      this.cameraVideoEl.playsInline = true;
      await this.cameraVideoEl.play().catch(() => {});
    }

    // 4. Setup canvas compositor
    this.canvas = document.createElement('canvas');
    const targetWidth = this.screenVideoEl.videoWidth || 1920;
    const targetHeight = this.screenVideoEl.videoHeight || 1080;
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.ctx = this.canvas.getContext('2d');

    // Start drawing compositor loop
    this.startCanvasDrawLoop();

    // 5. Setup AudioContext audio mixer
    this.setupAudioMixer();

    return {
      screenStream: this.displayStream,
      cameraStream: this.cameraStream || undefined,
    };
  }

  private setupAudioMixer() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    this.audioCtx = new AudioCtx();
    this.audioDestination = this.audioCtx.createMediaStreamDestination();

    // Mic source
    if (this.micAudioTrack) {
      try {
        const micStream = new MediaStream([this.micAudioTrack]);
        const micSource = this.audioCtx.createMediaStreamSource(micStream);
        this.micAnalyser = this.audioCtx.createAnalyser();
        this.micAnalyser.fftSize = 64;

        micSource.connect(this.micAnalyser);
        micSource.connect(this.audioDestination);
      } catch (e) {
        console.warn('Error setting up mic audio source:', e);
      }
    }

    // System audio source
    if (this.systemAudioTrack) {
      try {
        const sysStream = new MediaStream([this.systemAudioTrack]);
        const sysSource = this.audioCtx.createMediaStreamSource(sysStream);
        this.systemAnalyser = this.audioCtx.createAnalyser();
        this.systemAnalyser.fftSize = 64;

        sysSource.connect(this.systemAnalyser);
        sysSource.connect(this.audioDestination);
      } catch (e) {
        console.warn('Error setting up system audio source:', e);
      }
    }

    // Level check interval for Audio Visualizer component
    this.levelCheckInterval = window.setInterval(() => {
      let micLevel = 0;
      let systemLevel = 0;

      if (this.micAnalyser) {
        const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteFrequencyData(data);
        const sum = data.reduce((acc, val) => acc + val, 0);
        micLevel = Math.min(100, Math.round((sum / data.length / 255) * 200));
      }

      if (this.systemAnalyser) {
        const data = new Uint8Array(this.systemAnalyser.frequencyBinCount);
        this.systemAnalyser.getByteFrequencyData(data);
        const sum = data.reduce((acc, val) => acc + val, 0);
        systemLevel = Math.min(100, Math.round((sum / data.length / 255) * 200));
      }

      if (this.onAudioLevels) {
        this.onAudioLevels({
          micLevel,
          systemLevel,
          micActive: !!this.micAudioTrack,
          systemActive: !!this.systemAudioTrack,
        });
      }
    }, 100);
  }

  private startCanvasDrawLoop() {
    const draw = () => {
      if (!this.canvas || !this.ctx || !this.screenVideoEl) return;

      const w = this.canvas.width;
      const h = this.canvas.height;

      // Draw Screen Video
      this.ctx.fillStyle = '#09090b';
      this.ctx.fillRect(0, 0, w, h);

      if (this.screenVideoEl.readyState >= 2) {
        this.ctx.drawImage(this.screenVideoEl, 0, 0, w, h);
      }

      // Draw Camera Overlay Circle / Bubble if enabled
      if (this.cameraConfig.enabled && this.cameraVideoEl && this.cameraVideoEl.readyState >= 2) {
        this.ctx.save();

        const camSize = Math.round(Math.min(w, h) * 0.2); // 20% of smallest dimension
        let x = 40;
        let y = h - camSize - 40;

        if (this.cameraConfig.position === 'bottom-right') {
          x = w - camSize - 40;
          y = h - camSize - 40;
        } else if (this.cameraConfig.position === 'top-left') {
          x = 40;
          y = 40;
        } else if (this.cameraConfig.position === 'top-right') {
          x = w - camSize - 40;
          y = 40;
        }

        const centerX = x + camSize / 2;
        const centerY = y + camSize / 2;
        const radius = camSize / 2;

        // Draw camera shape clip
        this.ctx.beginPath();
        if (this.cameraConfig.shape === 'circle') {
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
          this.ctx.roundRect(x, y, camSize, camSize, 16);
        }
        this.ctx.clip();

        // Draw Camera Video
        const camW = this.cameraVideoEl.videoWidth || 640;
        const camH = this.cameraVideoEl.videoHeight || 480;
        const aspect = camW / camH;

        let drawW = camSize;
        let drawH = camSize;
        let drawX = x;
        let drawY = y;

        if (aspect > 1) {
          drawW = camSize * aspect;
          drawX = x - (drawW - camSize) / 2;
        } else {
          drawH = camSize / aspect;
          drawY = y - (drawH - camSize) / 2;
        }

        this.ctx.drawImage(this.cameraVideoEl, drawX, drawY, drawW, drawH);

        // Draw Orange REC Border Ring
        this.ctx.restore();
        this.ctx.save();
        this.ctx.beginPath();
        if (this.cameraConfig.shape === 'circle') {
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        } else {
          this.ctx.roundRect(x, y, camSize, camSize, 16);
        }
        this.ctx.strokeStyle = '#ea580c'; // orange-600
        this.ctx.lineWidth = 6;
        this.ctx.stroke();

        this.ctx.restore();
      }

      this.animFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  public async startRecording(): Promise<void> {
    if (!this.canvas) {
      await this.startPreviewStreams();
    }

    const canvasStream = this.canvas!.captureStream(30); // 30fps
    const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

    if (this.audioDestination) {
      const audioTracks = this.audioDestination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedTracks.push(audioTracks[0]);
      }
    }

    const finalStream = new MediaStream(combinedTracks);

    // Select WebM codec format VP9 + Opus
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(finalStream, {
      mimeType,
      videoBitsPerSecond: 3000000, // 3Mbps quality
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000); // chunk every second

    // Reset & start elapsed timer
    this.elapsedSeconds = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      this.elapsedSeconds++;
      if (this.onTimerTick) {
        this.onTimerTick(this.elapsedSeconds);
      }
    }, 1000);
  }

  public pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }
  }

  public resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.timerInterval = window.setInterval(() => {
        this.elapsedSeconds++;
        if (this.onTimerTick) {
          this.onTimerTick(this.elapsedSeconds);
        }
      }, 1000);
    }
  }

  public async stopRecording(): Promise<Blob> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.cleanup();
        resolve(blob);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.levelCheckInterval) {
      clearInterval(this.levelCheckInterval);
      this.levelCheckInterval = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    // Stop all media tracks
    [this.displayStream, this.cameraStream, this.micStream].forEach((stream) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });

    this.displayStream = null;
    this.cameraStream = null;
    this.micStream = null;

    if (this.screenVideoEl) {
      this.screenVideoEl.srcObject = null;
      this.screenVideoEl = null;
    }
    if (this.cameraVideoEl) {
      this.cameraVideoEl.srcObject = null;
      this.cameraVideoEl = null;
    }
  }
}
