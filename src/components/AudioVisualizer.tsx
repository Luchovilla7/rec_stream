import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { AudioLevels } from '../types';

interface AudioVisualizerProps {
  audioLevels: AudioLevels;
  audioEnabled?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioLevels, audioEnabled = true }) => {
  const { micLevel, systemLevel, micActive, systemActive } = audioLevels;

  // Generate bar heights based on current audio level with random variation
  const getBarHeights = (level: number, count: number) => {
    return Array.from({ length: count }).map((_, i) => {
      if (level === 0 || !audioEnabled) return 15;
      const factor = (i % 3 === 0 ? 1.2 : i % 2 === 0 ? 0.8 : 1.0);
      const h = Math.min(100, Math.max(10, level * factor + Math.sin(i) * 15));
      return Math.round(h);
    });
  };

  const micBars = getBarHeights(micLevel, 8);

  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {!audioEnabled ? (
            <VolumeX className="w-3.5 h-3.5 text-red-400" />
          ) : micActive ? (
            <Mic className="w-3.5 h-3.5 text-orange-500" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-zinc-500" />
          )}
          <span className="text-xs font-bold uppercase text-zinc-400 font-mono">
            Entrada de Audio
          </span>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            !audioEnabled
              ? 'text-red-400 bg-red-500/10 border border-red-500/20'
              : micActive
              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-zinc-500 bg-zinc-800'
          }`}
        >
          {!audioEnabled ? 'SONIDO DESHABILITADO' : micActive ? 'MIC ACTIVO' : 'NO MIC'}
        </span>
      </div>

      {/* Mic Audio Spectrum Bars */}
      <div className="flex items-end gap-1.5 h-14 my-2 px-1 relative">
        {!audioEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 rounded-lg backdrop-blur-[1px] border border-zinc-800 text-[10px] text-zinc-400 font-mono">
            Grabación en Silencio (Audio Omitido)
          </div>
        )}
        {micBars.map((h, idx) => (
          <div
            key={idx}
            className={`flex-1 rounded-sm transition-all duration-75 ${
              audioEnabled && h > 20 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-zinc-800'
            }`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      {/* System Audio Loopback meter */}
      <div className="space-y-2 mt-2 pt-2 border-t border-zinc-800/80">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            {audioEnabled ? <Volume2 className="w-3 h-3 text-orange-400" /> : <VolumeX className="w-3 h-3 text-zinc-500" />}
            Audio del Sistema
          </span>
          <span className="text-zinc-500 text-[10px]">
            {!audioEnabled ? 'Omitido' : systemActive ? 'Mezcla activa' : 'Captura directa'}
          </span>
        </div>
        <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
          <div
            className={`h-full transition-all duration-100 rounded-full ${audioEnabled ? 'bg-orange-500' : 'bg-zinc-800'}`}
            style={{ width: `${audioEnabled ? Math.max(5, systemLevel) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};
