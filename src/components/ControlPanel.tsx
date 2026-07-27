import React from 'react';
import { Play, Pause, Square, Circle, Save } from 'lucide-react';
import { RecordingState } from '../types';

interface ControlPanelProps {
  recordingState: RecordingState;
  elapsedSeconds: number;
  recordingTitle: string;
  onTitleChange: (title: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopAndSave: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  recordingState,
  elapsedSeconds,
  recordingTitle,
  onTitleChange,
  onStart,
  onPause,
  onResume,
  onStopAndSave,
}) => {
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(s)}` : `${pad(mins)}:${pad(s)}`;
  };

  return (
    <div className="col-span-12 lg:col-span-4 row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
      <div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">
              Tiempo Transcurrido
            </p>
            <p className="text-4xl lg:text-5xl font-mono font-bold text-orange-500 tracking-tight my-1">
              {formatTime(elapsedSeconds)}
            </p>
          </div>
          <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center border border-orange-500/20">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                recordingState === 'recording'
                  ? 'bg-red-500 animate-ping shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                  : recordingState === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]'
              }`}
            />
          </div>
        </div>

        {/* Title Input Field */}
        <div className="mt-3">
          <label className="text-[10px] text-zinc-400 font-mono uppercase mb-1 block">
            Título de la Grabación
          </label>
          <input
            type="text"
            value={recordingTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ej. Demo de producto UI"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 font-sans"
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-4 space-y-2">
        {recordingState === 'idle' && (
          <button
            onClick={onStart}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-sm"
          >
            <Circle className="w-4 h-4 fill-current text-white" />
            INICIAR GRABACIÓN
          </button>
        )}

        {recordingState === 'recording' && (
          <div className="flex gap-2">
            <button
              onClick={onPause}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-3 rounded-xl transition-all border border-zinc-700 text-xs flex items-center justify-center gap-1.5"
            >
              <Pause className="w-4 h-4" />
              PAUSAR
            </button>
            <button
              onClick={onStopAndSave}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-600/30 text-xs flex items-center justify-center gap-1.5"
            >
              <Square className="w-4 h-4 fill-current" />
              DETENER & SUBIR
            </button>
          </div>
        )}

        {recordingState === 'paused' && (
          <div className="flex gap-2">
            <button
              onClick={onResume}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current" />
              REANUDAR
            </button>
            <button
              onClick={onStopAndSave}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
            >
              <Square className="w-4 h-4 fill-current" />
              FINALIZAR
            </button>
          </div>
        )}

        {recordingState === 'preview' && (
          <button
            onClick={onStopAndSave}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            SUBIR Y GENERAR ENLACE
          </button>
        )}
      </div>
    </div>
  );
};
