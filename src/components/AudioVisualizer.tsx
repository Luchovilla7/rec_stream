import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { AudioLevels, AudioSourceConfig } from '../types';

interface AudioVisualizerProps {
  audioLevels: AudioLevels;
  audioConfig: AudioSourceConfig;
  onToggleMicAudio?: () => void;
  onToggleSystemAudio?: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioLevels,
  audioConfig,
  onToggleMicAudio,
  onToggleSystemAudio,
}) => {
  const { micLevel, systemLevel, micActive, systemActive } = audioLevels;
  const { micEnabled, systemEnabled } = audioConfig;

  // Generate bar heights based on current audio level
  const getBarHeights = (level: number, count: number, isEnabled: boolean) => {
    return Array.from({ length: count }).map((_, i) => {
      if (level === 0 || !isEnabled) return 15;
      const factor = (i % 3 === 0 ? 1.2 : i % 2 === 0 ? 0.8 : 1.0);
      const h = Math.min(100, Math.max(10, level * factor + Math.sin(i) * 15));
      return Math.round(h);
    });
  };

  const micBars = getBarHeights(micLevel, 8, micEnabled);

  const getOverallStatusText = () => {
    if (systemEnabled && micEnabled) return 'MEZCLA COMPLETA';
    if (systemEnabled) return 'SÓLO SISTEMA';
    if (micEnabled) return 'SÓLO MICRÓFONO';
    return 'SIN SONIDO';
  };

  const getOverallStatusStyle = () => {
    if (systemEnabled && micEnabled) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (systemEnabled) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    if (micEnabled) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-zinc-300 font-mono">
            Fuentes de Audio
          </span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getOverallStatusStyle()}`}>
          {getOverallStatusText()}
        </span>
      </div>

      {/* Mic Audio Section */}
      <div className="space-y-1.5 my-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {micEnabled ? (
              <Mic className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <span className="text-xs font-mono font-medium text-zinc-300">Micrófono (Voz)</span>
          </div>

          {onToggleMicAudio && (
            <button
              onClick={onToggleMicAudio}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                micEnabled
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {micEnabled ? 'MIC ON' : 'MIC OFF'}
            </button>
          )}
        </div>

        {/* Mic Audio Spectrum Bars */}
        <div className="flex items-end gap-1.5 h-10 px-1 relative bg-zinc-950/60 rounded-lg p-1.5 border border-zinc-800/80">
          {!micEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/85 rounded-lg backdrop-blur-[1px] text-[10px] text-zinc-500 font-mono">
              Micrófono Desactivado
            </div>
          )}
          {micBars.map((h, idx) => (
            <div
              key={idx}
              className={`flex-1 rounded-sm transition-all duration-75 ${
                micEnabled && h > 20 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-zinc-800'
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* System Audio Loopback meter */}
      <div className="space-y-2 mt-2 pt-2 border-t border-zinc-800/80">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-zinc-300 flex items-center gap-1.5">
            {systemEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
            Audio del Sistema (PC)
          </span>

          {onToggleSystemAudio && (
            <button
              onClick={onToggleSystemAudio}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                systemEnabled
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {systemEnabled ? 'SISTEMA ON' : 'SISTEMA OFF'}
            </button>
          )}
        </div>

        <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800 relative">
          {!systemEnabled ? (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[8px] font-mono text-zinc-600">
              Desactivado
            </div>
          ) : (
            <div
              className="h-full bg-cyan-400 transition-all duration-100 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.4)]"
              style={{ width: `${systemActive ? Math.max(5, systemLevel) : 0}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
