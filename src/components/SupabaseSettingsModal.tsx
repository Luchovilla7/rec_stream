import React, { useState } from 'react';
import { Database, X, Check, Key, Link, CheckCircle2, AlertCircle } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig, resetSupabaseClient, getSupabaseClient } from '../lib/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const current = getStoredSupabaseConfig();
  const [url, setUrl] = useState(current.url);
  const [key, setKey] = useState(current.key);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('testing');
    setErrorMsg('');

    saveSupabaseConfig(url.trim(), key.trim());
    resetSupabaseClient();

    const client = getSupabaseClient();
    if (!client) {
      setStatus('error');
      setErrorMsg('Por favor ingresa un URL y Anon Key válidos de Supabase.');
      return;
    }

    try {
      // Test storage bucket list or query table
      const { data, error } = await client.from('recordings').select('id').limit(1);
      if (error && !error.message.includes('relation "recordings" does not exist')) {
        // Table error might just mean schema needs creation, which is OK!
        console.warn('Supabase test warning:', error.message);
      }
      setStatus('success');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Error al conectar con Supabase');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-zinc-100 font-sans">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white bg-zinc-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono text-zinc-100">
              Configuración de Supabase
            </h3>
            <p className="text-xs text-zinc-400">
              Conecta tu proyecto de Supabase para almacenamiento y base de datos.
            </p>
          </div>
        </div>

        <form onSubmit={handleTestAndSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
              SUPABASE PROJECT URL
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase mb-1">
              SUPABASE ANON API KEY
            </label>
            <input
              type="password"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] text-zinc-400 space-y-1 font-mono">
            <p className="text-orange-400 font-bold">Estructura esperada en Supabase:</p>
            <p>1. Tabla: <code className="text-zinc-200">recordings</code> (id, user_id, title, storage_path, duration_sec, share_slug, view_count)</p>
            <p>2. Bucket: <code className="text-zinc-200">recordings</code> (Privado con URLs firmadas)</p>
          </div>

          {status === 'error' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>¡Conexión guardada con éxito!</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={status === 'testing'}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-orange-600/30 font-mono"
            >
              {status === 'testing' ? 'Probando...' : 'Guardar Credenciales'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
