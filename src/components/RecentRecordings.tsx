import React from 'react';
import { Film, Eye, Link2, Trash2, Play, Download, Check } from 'lucide-react';
import { Recording } from '../types';

interface RecentRecordingsProps {
  recordings: Recording[];
  onSelectRecording: (recording: Recording) => void;
  onDeleteRecording: (recording: Recording) => void;
  onDownloadRecording: (recording: Recording) => void;
  onCopyShareLink: (slug: string) => void;
  copiedSlug: string | null;
}

export const RecentRecordings: React.FC<RecentRecordingsProps> = ({
  recordings,
  onSelectRecording,
  onDeleteRecording,
  onDownloadRecording,
  onCopyShareLink,
  copiedSlug,
}) => {
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="col-span-12 lg:col-span-8 row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase text-zinc-400 font-mono flex items-center gap-2">
            <Film className="w-4 h-4 text-orange-500" />
            Últimas Grabaciones ({recordings.length})
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            Descargar • Enlace corto • Vistas
          </span>
        </div>

        {recordings.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
            <Film className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-zinc-400 font-mono">No hay grabaciones aún</p>
            <p className="text-[11px] text-zinc-600 mt-1">Graba tu pantalla para generar enlaces para compartir y descargar</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-all gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSelectRecording(rec)}
                    className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-all shrink-0"
                    title="Reproducir video"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 truncate font-sans">
                      {rec.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {formatDuration(rec.duration_sec)} • {rec.file_size_mb} MB • {new Date(rec.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/60">
                  <div className="flex items-center gap-1 text-zinc-400 font-mono text-[11px] mr-1">
                    <Eye className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{rec.view_count}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDownloadRecording(rec)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg transition-all font-mono text-[11px]"
                      title="Descargar archivo de video"
                    >
                      <Download className="w-3 h-3 text-orange-400" />
                      <span>Descargar</span>
                    </button>

                    <button
                      onClick={() => onCopyShareLink(rec.share_slug)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition-all font-mono text-[11px]"
                      title="Copiar enlace corto"
                    >
                      {copiedSlug === rec.share_slug ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onDeleteRecording(rec)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Borrar grabación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
