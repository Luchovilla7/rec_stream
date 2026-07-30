import React, { useEffect, useState } from 'react';
import { Play, Eye, Clock, Download, Share2, Trash2, ArrowLeft, Check, Film, ShieldCheck } from 'lucide-react';
import { Recording } from '../types';
import { fetchRecordingBySlug, deleteRecording, downloadRecording } from '../lib/supabase';
import { getLocalRecordingBlob } from '../lib/idb';

interface PublicPlayerProps {
  slug: string;
  onBackToStudio: () => void;
}

export const PublicPlayer: React.FC<PublicPlayerProps> = ({ slug, onBackToStudio }) => {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rec = await fetchRecordingBySlug(slug);
        if (isMounted) {
          if (rec) {
            setRecording(rec);
            // Check if local IndexedDB has the blob
            const localBlob = await getLocalRecordingBlob(rec.id);
            if (localBlob) {
              const objUrl = URL.createObjectURL(localBlob);
              setResolvedVideoUrl(objUrl);
            } else {
              setResolvedVideoUrl(rec.video_url);
            }
          } else {
            setError('Grabación no encontrada o ha sido eliminada.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Error al cargar la grabación.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleCopyLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (recording) {
      await downloadRecording(recording);
    }
  };

  const handleDelete = async () => {
    if (!recording) return;
    if (confirm('¿Estás seguro de que deseas eliminar permanentemente esta grabación?')) {
      setDeleting(true);
      await deleteRecording(recording.id, recording.share_slug);
      alert('Grabación eliminada correctamente.');
      onBackToStudio();
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono text-zinc-400">Cargando reproductor de video...</p>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-4">
          <Film className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-mono mb-2">Video No Encontrado</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">{error || 'El enlace provisto es inválido o el video fue borrado.'}</p>
        <button
          onClick={onBackToStudio}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all font-mono text-xs flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Ir a REC_STREAM Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 sm:p-6 lg:p-8 font-sans max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToStudio}
          className="flex items-center gap-2 text-xs font-mono font-semibold px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 text-zinc-300 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-orange-500" />
          REC_STREAM STUDIO
        </button>

        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-zinc-400">Enlace seguro</span>
        </div>
      </div>

      {/* Main Video Player Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6">
        <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-inner mb-6">
          {resolvedVideoUrl ? (
            <video
              src={resolvedVideoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
              Cargando stream de video...
            </div>
          )}
        </div>

        {/* Video Info Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-zinc-100 mb-2">
              {recording.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                {formatDuration(recording.duration_sec)}
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                {recording.view_count} vistas
              </span>
              <span>{recording.file_size_mb} MB</span>
              <span>{new Date(recording.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-600/20 text-xs font-mono"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" /> ¡Copiado!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" /> Copiar Enlace
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl transition-all border border-zinc-700 text-xs font-mono"
            >
              <Download className="w-4 h-4 text-orange-400" /> Descargar
            </button>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2.5 bg-zinc-950 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 rounded-xl transition-all"
              title="Borrar esta grabación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Share Slug box */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block text-[10px] uppercase mb-0.5">Enlace corto de reproducción:</span>
            <span className="text-orange-400 font-bold tracking-wider">{window.location.href}</span>
          </div>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            SLUG: {recording.share_slug}
          </span>
        </div>
      </div>
    </div>
  );
};
