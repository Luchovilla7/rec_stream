import React from 'react';
import { Database, ShieldAlert, Sparkles, HardDrive, Settings, ExternalLink } from 'lucide-react';
import { SupabaseConfig } from '../types';

interface HeaderProps {
  supabaseConfig: SupabaseConfig;
  totalUsedMb: number;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  supabaseConfig,
  totalUsedMb,
  onOpenSettings,
}) => {
  const maxStorageMb = 5000; // 5 GB free plan
  const storageGb = (totalUsedMb / 1024).toFixed(1);
  const percentUsed = Math.min(100, Math.round((totalUsedMb / maxStorageMb) * 100));

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-zinc-800/60">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-500/30 shadow-lg shadow-orange-600/20 bg-zinc-900 flex items-center justify-center relative group">
          <img
            src="../assets/images/rec_stream_favicon_1785165492980.jpg"
            alt="REC_STREAM Logo"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
              REC_STREAM
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
              v2.0
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Grabador de pantalla Bento con mezcla WebM y Supabase
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Open in new tab button */}
        <button
          onClick={handleOpenNewTab}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30 rounded-full text-xs font-mono font-semibold transition-all shadow-sm"
          title="Abrir en una ventana independiente para grabación directa sin restricciones de iframe"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir en Nueva Pestaña</span>
        </button>

        {/* Storage status pill */}
        <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-full text-xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                percentUsed > 85 ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
              }`}
            />
            <span className="font-mono text-zinc-300 font-medium uppercase tracking-wider text-[11px]">
              Almacenamiento: {storageGb} GB / 5.0 GB
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percentUsed > 85 ? 'bg-red-500' : 'bg-orange-500'
              }`}
              style={{ width: `${Math.max(5, percentUsed)}%` }}
            />
          </div>
        </div>

        {/* Supabase status & settings trigger */}
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
            supabaseConfig.isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-orange-500" />
          <span className="font-mono">
            {supabaseConfig.isConnected ? 'SUPABASE ACTIVE' : 'CONFIG SUPABASE'}
          </span>
          <Settings className="w-3.5 h-3.5 ml-1 opacity-70" />
        </button>
      </div>
    </header>
  );
};
