import React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { UploadProgressInfo } from '../types';

interface UploadProgressProps {
  progressInfo: UploadProgressInfo;
  supabaseConnected: boolean;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  progressInfo,
  supabaseConnected,
}) => {
  const { currentChunkName, progressPercent, status, errorMessage } = progressInfo;

  return (
    <div className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase text-zinc-400 font-mono flex items-center gap-1.5">
            <UploadCloud className="w-3.5 h-3.5 text-orange-500" />
            Subida Multipart
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {status === 'uploading' ? 'PROCESANDO' : status === 'completed' ? 'COMPLETADO' : 'EN ESPERA'}
          </span>
        </div>

        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-mono font-semibold text-zinc-200">
            {status === 'uploading' ? currentChunkName : status === 'completed' ? 'REGISTRO_FINAL.webm' : 'Esperando video'}
          </span>
          <span className="text-sm font-mono font-bold text-orange-500">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-950 h-3 rounded-full mb-4 border border-zinc-800 overflow-hidden">
          <div
            className="bg-orange-500 h-full rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* System Note Box */}
      <div className="mt-auto">
        <div
          className={`border rounded-xl p-3 text-[11px] leading-relaxed font-sans ${
            status === 'completed'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : status === 'error'
              ? 'bg-red-500/10 text-red-300 border-red-500/20'
              : 'bg-orange-500/10 text-orange-200/90 border-orange-500/20'
          }`}
        >
          {status === 'completed' ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Video subido con éxito:</strong> Enlace corto listo para compartir públicamente.
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Error de subida:</strong> {errorMessage || 'Falló la conexión con el almacenamiento.'}
              </div>
            </div>
          ) : (
            <div>
              <strong className="block text-orange-400 mb-0.5">Nota del sistema:</strong>
              {supabaseConnected
                ? 'Subiendo por partes al Bucket privado de Supabase Storage. No cierres la pestaña.'
                : 'Subiendo por partes al almacenamiento local del servidor. No cierres la pestaña.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
