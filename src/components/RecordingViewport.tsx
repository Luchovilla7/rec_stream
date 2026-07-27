import React, { useEffect, useRef } from 'react';
import { Camera, CameraOff, Monitor, RefreshCw, Layers, CheckCircle2, ShieldCheck, Play, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import { CameraConfig, RecordingState } from '../types';

interface RecordingViewportProps {
  recordingState: RecordingState;
  cameraConfig: CameraConfig;
  previewUrl: string | null;
  canvasElement: HTMLCanvasElement | null;
  captureError?: string | null;
  onToggleCamera: () => void;
  onChangeCameraPos: (pos: CameraConfig['position']) => void;
  onChangeCameraShape: (shape: CameraConfig['shape']) => void;
  onDiscardPreview: () => void;
  onStartRecord: () => void;
  onClearError?: () => void;
}

export const RecordingViewport: React.FC<RecordingViewportProps> = ({
  recordingState,
  cameraConfig,
  previewUrl,
  canvasElement,
  captureError,
  onToggleCamera,
  onChangeCameraPos,
  onChangeCameraShape,
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
          <span className="bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] font-mono text-white/80 tracking-widest border border-white/10">
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
          <div ref={containerRef} className="w-full h-full flex items-center justify-center">
            {/* Idle Placeholder when stream not started yet */}
            {recordingState === 'idle' && !canvasElement && (
              <div className="text-center p-8 max-w-md">
                <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-orange-500 shadow-inner">
                  <Monitor className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 mb-2 font-mono">
                  Compartir Pantalla & Cámara
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                  Mezcla video de pantalla, micrófono y cámara web circular en un solo stream WebM de alta fidelidad.
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

      {/* Camera Bubble Controls Bar */}
      <div className="bg-zinc-950/90 border-t border-zinc-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
        <div className="flex items-center gap-2">
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
