import React from 'react';
import { AlertTriangle, Chrome, ShieldAlert } from 'lucide-react';

export const BrowserNotice: React.FC = () => {
  return (
    <div className="col-span-12 row-span-1 bg-amber-950/20 border border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 shadow-lg">
      <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0 text-amber-500">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="text-xs text-amber-200/90 leading-snug">
        <strong className="block text-amber-400 uppercase font-bold tracking-wider font-mono mb-0.5">
          Optimizado para Chromium (Chrome / Edge / Brave)
        </strong>
        La mezcla en tiempo real con AudioContext y getDisplayMedia funciona mejor en Google Chrome y Microsoft Edge. En Safari de Apple el soporte es parcial debido a restricciones de capturas de audio del sistema.
      </div>
    </div>
  );
};
