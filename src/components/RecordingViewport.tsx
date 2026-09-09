import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Monitor, RefreshCw, Layers, CheckCircle2, ShieldCheck, Play, Trash2, ExternalLink, AlertTriangle, Video, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { CameraConfig, RecordingState } from '../types';

interface RecordingViewportProps {
  recordingState: RecordingState;
  cameraConfig: CameraConfig;
  audioEnabled: boolean;
  videoDevices?: MediaDeviceInfo[];
  previewUrl: string | null;
  canvasElement: HTMLCanvasElement | null;
  captureError?: string | null;
  onToggleCamera: () => void;
  onToggleAudio: () => void;
  onChangeCameraPos: (pos: CameraConfig['position']) => void;
  onChangeCameraShape: (shape: CameraConfig['shape']) => void;
  onChangeCameraDevice?: (deviceId: string) => void;
  onRefreshDevices?: () => void;
  onDiscardPreview: () => void;
  onStartRecord: () => void;
  onClearError?: () => void;
}

const LiveCameraPreviewBubble: React.FC<{ cameraConfig: CameraConfig }> = ({ cameraConfig }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    async function initCamera() {
      if (!cameraConfig.enabled) return;
      setStreamError(null);

      try {
        const constraints: MediaTrackConstraints = {
          width: { ideal: 640 },
          height: { ideal: 480 },
        };
        if (cameraConfig.deviceId) {
          constraints.deviceId = { exact: cameraConfig.deviceId };
        } else {
          constraints.facingMode = 'user';
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Preview camera stream error:', err);
          setStreamError('Cámara no disponible');
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraConfig.enabled, cameraConfig.deviceId]);

  if (!cameraConfig.enabled) return null;

  const posClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-14 left-4',
    'top-right': 'top-14 right-4',
  }[cameraConfig.position];

  const shapeClasses = cameraConfig.shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div
      className={`absolute ${posClasses} z-10 pointer-events-none transition-all duration-300 ease-out`}
    >
      <div
        className={`relative w-28 h-28 sm:w-36 sm:h-36 ${shapeClasses} border-4 border-orange-500 bg-zinc-950 shadow-2xl shadow-orange-500/30 overflow-hidden flex items-center justify-center`}
      >
        {streamError ? (
          <div className="text-center p-2 text-zinc-500 text-[10px] font-mono">
            <Video className="w-5 h-5 mx-auto mb-1 text-zinc-600" />
            Sin Cámara
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        )}
        <div className="absolute top-1 right-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-mono text-orange-400 font-bold tracking-wider">
          LIVE
        </div>
      </div>
    </div>
  );
};

export const RecordingViewport: React.FC<RecordingViewportProps> = ({
  recordingState,
  cameraConfig,
  audioEnabled,
  videoDevices = [],
  previewUrl,
  canvasElement,
  captureError,
  onToggleCamera,
  onToggleAudio,
  onChangeCameraPos,
  onChangeCameraShape,
  onChangeCameraDevice,
  onRefreshDevices,
  onDiscardPreview,
  onStartRecord,
  onClearError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && canvasElement && recordingState !== 'preview') {
      containerRef.current.innerHTML = '';
      canvasElement.className = 'w-full h-full object-contain bg-zinc-950 rounded-xl';
      containerRef.current.appendChild(canvasElement);
    }
  }, [canvasElement, recordingState]);

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="col-span-12 lg:col-span-8 row-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col min-h-[380px] lg:min-h-[460px]">
      {/* Viewport Top Bar / Overlay badges */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium text-zinc-300 tracking-wider border border-white/10 flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-orange-500" />
            {recordingState === 'recording' ? (
              <span className="text-red-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                GRABANDO
              </span>
            ) : recordingState === 'preparing' ? (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                ABRIENDO SELECTOR...
              </span>
            ) : recordingState === 'paused' ? (
              <span className="text-amber-400 font-bold">PAUSADO</span>
            ) : recordingState === 'preview' ? (
              <span className="text-blue-400 font-bold">VISTA PREVIA</span>
            ) : (
              <span>LISTO PARA GRABAR</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`bg-black/70 backdrop-blur px-2.5 py-1.5 rounded-lg text-[10px] font-mono tracking-wider border flex items-center gap-1.5 ${
            audioEnabled
              ? 'text-emerald-400 border-emerald-500/30'
              : 'text-amber-400 border-amber-500/30'
          }`}>
            {audioEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-amber-400" />}
            {audioEnabled ? 'SONIDO: ACTIVO' : 'SONIDO: OMITIDO'}
          </span>
          <span className="bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] font-mono text-white/80 tracking-widest border border-white/10 hidden sm:inline-block">
            WEBM / VP9 + OPUS
          </span>
        </div>
      </div>

      {/* Main Screen Content View */}
      <div className="relative flex-1 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-2 overflow-hidden">
        {captureError ? (
          <div className="p-6 max-w-lg text-center bg-zinc-900/95 border border-orange-500/30 rounded-2xl shadow-2xl backdrop-blur">
            <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-zinc-100 font-mono mb-2">
              Restricción de Permisos de Pantalla
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed mb-5">
              Los navegadores bloquean la API <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-orange-400 font-mono">getDisplayMedia</code> cuando la app se ejecuta dentro de un marco iFrame incrustado.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleOpenNewTab}
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-xs font-mono"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en Nueva Pestaña para Grabar
              </button>
              {onClearError && (
                <button
                  onClick={onClearError}
                  className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2.5 rounded-xl transition-all text-xs"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        ) : recordingState === 'preview' && previewUrl ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-h-[380px] w-full rounded-xl object-contain border border-zinc-800 shadow-xl"
            />
          </div>
        ) : (
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Live Camera Bubble Overlay in Idle state */}
            {recordingState === 'idle' && cameraConfig.enabled && !canvasElement && (
              <LiveCameraPreviewBubble cameraConfig={cameraConfig} />
            )}

            {/* Canvas Container when recording */}
            <div ref={containerRef} className="w-full h-full flex items-center justify-center" />

            {/* Idle Placeholder or Preparing indicator */}
            {recordingState === 'preparing' && (
              <div className="text-center p-8 max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur">
                <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-lg">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-zinc-100 mb-1 font-mono">
                  Solicitando Captura de Pantalla
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                  Elige la pantalla, ventana o pestaña que deseas grabar en el cuadro emergente del navegador.
                </p>
              </div>
            )}

            {recordingState === 'idle' && !canvasElement && (
              <div className="text-center p-8 max-w-md z-10 bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-xl">
                <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-inner">
                  <Monitor className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 mb-1.5 font-mono">
                  {cameraConfig.enabled ? 'Cámara Activada - Vista Previa' : 'Compartir Pantalla & Cámara'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                  {cameraConfig.enabled
                    ? 'Comprueba cómo te ves en el recuadro naranja. Ajusta la posición o tu cámara USB abajo antes de iniciar.'
                    : 'Graba video de pantalla, micrófono y cámara web circular en un solo archivo WebM de alta fidelidad.'}
                </p>
                <button
                  onClick={onStartRecord}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 mx-auto text-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar Captura de Pantalla
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera & Audio Controls Bar */}
      <div className="bg-zinc-950/90 border-t border-zinc-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'Omitir o deshabilitar captura de audio' : 'Habilitar captura de audio (micrófono y sistema)'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all border ${
              audioEnabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" /> AUDIO ON
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" /> AUDIO OFF (SIN SONIDO)
              </>
            )}
          </button>

          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px] transition-all border ${
              cameraConfig.enabled
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            {cameraConfig.enabled ? (
              <>
                <Camera className="w-3.5 h-3.5" /> CÁMARA ON
              </>
            ) : (
              <>
                <CameraOff className="w-3.5 h-3.5" /> CÁMARA OFF
              </>
            )}
          </button>

          {cameraConfig.enabled && (
            <>
              {/* Camera Device Selector Dropdown */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-300">
                <select
                  value={cameraConfig.deviceId || (videoDevices && videoDevices[0]?.deviceId) || ''}
                  onChange={(e) => onChangeCameraDevice?.(e.target.value)}
                  className="bg-transparent text-zinc-200 outline-none cursor-pointer max-w-[140px] sm:max-w-[210px] truncate"
                >
                  {videoDevices && videoDevices.length > 0 ? (
                    videoDevices.map((dev, idx) => {
                      const label = dev.label || `Cámara ${idx + 1}`;
                      const isUsb = label.toLowerCase().includes('usb') || label.toLowerCase().includes('external') || label.toLowerCase().includes('cam');
                      return (
                        <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-zinc-900 text-zinc-200">
                          {isUsb ? '📹 USB: ' : '🎥 '}{label}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" className="bg-zinc-900 text-zinc-400">
                      Cámara por defecto
                    </option>
                  )}
                </select>
                {onRefreshDevices && (
                  <button
                    onClick={onRefreshDevices}
                    title="Actualizar / Buscar cámaras USB"
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all ml-0.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="h-4 w-px bg-zinc-800" />
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-[10px] font-mono">
                <span className="text-zinc-500 px-1">POS:</span>
                <button
                  onClick={() => onChangeCameraPos('bottom-left')}
                  className={`px-1.5 py-0.5 rounded ${
                    cameraConfig.position === 'bottom-left' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ↙
                </button>
                <button
                  onClick={() => onChangeCameraPos('bottom-right')}
                  className={`px-1.5 py-0.5 rounded ${
                    cameraConfig.position === 'bottom-right' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ↘
                </button>
                <button
                  onClick={() => onChangeCameraPos('top-left')}
                  className={`px-1.5 py-0.5 rounded ${
                    cameraConfig.position === 'top-left' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ↖
                </button>
                <button
                  onClick={() => onChangeCameraPos('top-right')}
                  className={`px-1.5 py-0.5 rounded ${
                    cameraConfig.position === 'top-right' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ↗
                </button>
              </div>

              <button
                onClick={() => onChangeCameraShape(cameraConfig.shape === 'circle' ? 'rect' : 'circle')}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-[10px] font-mono text-zinc-300"
              >
                FORMA: {cameraConfig.shape.toUpperCase()}
              </button>
            </>
          )}
        </div>

        {recordingState === 'preview' && (
          <button
            onClick={onDiscardPreview}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 rounded-lg text-xs font-semibold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Descartar Vista Previa
          </button>
        )}
      </div>
    </div>
  );
};
