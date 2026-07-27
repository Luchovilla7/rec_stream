import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { RecordingViewport } from './components/RecordingViewport';
import { ControlPanel } from './components/ControlPanel';
import { AudioVisualizer } from './components/AudioVisualizer';
import { RecentRecordings } from './components/RecentRecordings';
import { UploadProgress } from './components/UploadProgress';
import { BrowserNotice } from './components/BrowserNotice';
import { PublicPlayer } from './components/PublicPlayer';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';

import {
  AudioLevels,
  CameraConfig,
  Recording,
  RecordingState,
  SupabaseConfig,
  UploadProgressInfo,
} from './types';
import { RecorderEngine } from './lib/recorder';
import {
  getStoredSupabaseConfig,
  fetchAllRecordings,
  uploadRecordingInChunks,
  deleteRecording,
} from './lib/supabase';

export default function App() {
  // Navigation / Route state
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Check initial URL params for share link (e.g. ?v=rec-8f3a9)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vParam = params.get('v') || params.get('share');
    if (vParam) {
      setActiveSlug(vParam);
    }
  }, []);

  // Supabase & App State
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    const { url, key } = getStoredSupabaseConfig();
    return {
      url,
      anonKey: key,
      bucketName: 'recordings',
      isConnected: !!(url && key),
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Recorder State
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    enabled: true,
    position: 'bottom-left',
    shape: 'circle',
    size: 160,
  });

  const [audioLevels, setAudioLevels] = useState<AudioLevels>({
    micLevel: 0,
    systemLevel: 0,
    micActive: false,
    systemActive: false,
  });

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);

  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo>({
    totalChunks: 0,
    currentChunk: 0,
    progressPercent: 0,
    currentChunkName: 'Esperando...',
    bytesUploaded: 0,
    totalBytes: 0,
    status: 'idle',
  });

  // Recordings list
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Engine ref
  const engineRef = useRef<RecorderEngine | null>(null);

  // Load recordings list on mount
  useEffect(() => {
    async function load() {
      const list = await fetchAllRecordings();
      setRecordings(list);
    }
    load();
  }, []);

  // Compute total used storage MB
  const totalUsedMb = recordings.reduce((acc, r) => acc + (r.file_size_mb || 0), 0);

  // Handle camera config change dynamically
  const handleToggleCamera = () => {
    const next = !cameraConfig.enabled;
    const newConfig = { ...cameraConfig, enabled: next };
    setCameraConfig(newConfig);
    if (engineRef.current) {
      engineRef.current.updateCameraConfig(newConfig);
    }
  };

  const handleChangeCameraPos = (pos: CameraConfig['position']) => {
    const newConfig = { ...cameraConfig, position: pos };
    setCameraConfig(newConfig);
    if (engineRef.current) {
      engineRef.current.updateCameraConfig(newConfig);
    }
  };

  const handleChangeCameraShape = (shape: CameraConfig['shape']) => {
    const newConfig = { ...cameraConfig, shape };
    setCameraConfig(newConfig);
    if (engineRef.current) {
      engineRef.current.updateCameraConfig(newConfig);
    }
  };

  // Recording controls
  const handleStartCapture = async () => {
    setCaptureError(null);
    try {
      engineRef.current = new RecorderEngine({
        cameraConfig,
        onAudioLevels: (levels) => setAudioLevels(levels),
        onTimerTick: (secs) => setElapsedSeconds(secs),
      });

      await engineRef.current.startPreviewStreams();
      setCanvasElement(engineRef.current.getCanvasElement());

      await engineRef.current.startRecording();
      setRecordingState('recording');
    } catch (err: any) {
      console.error('Error starting capture:', err);
      const msg = err.message || 'Error al iniciar la grabación de pantalla';
      setCaptureError(msg);
      setRecordingState('idle');
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pauseRecording();
      setRecordingState('paused');
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resumeRecording();
      setRecordingState('recording');
    }
  };

  const handleStopAndSave = async () => {
    if (!engineRef.current) return;

    setRecordingState('uploading');
    const blob = await engineRef.current.stopRecording();
    const duration = engineRef.current.getElapsedSeconds();

    setPreviewBlob(blob);
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    // Trigger chunked upload
    setUploadProgress({
      totalChunks: 1,
      currentChunk: 0,
      progressPercent: 5,
      currentChunkName: 'PREPARANDO_PARTES.chunk',
      bytesUploaded: 0,
      totalBytes: blob.size,
      status: 'uploading',
    });

    try {
      const newRec = await uploadRecordingInChunks(
        blob,
        recordingTitle || 'Grabación de pantalla',
        duration,
        (percent, chunk, total, chunkName) => {
          setUploadProgress({
            totalChunks: total,
            currentChunk: chunk,
            progressPercent: percent,
            currentChunkName: chunkName,
            bytesUploaded: Math.round((blob.size * percent) / 100),
            totalBytes: blob.size,
            status: percent === 100 ? 'completed' : 'uploading',
          });
        }
      );

      setRecordings((prev) => [newRec, ...prev]);
      setRecordingState('completed');

      setTimeout(() => {
        setRecordingState('preview');
      }, 1200);
    } catch (err: any) {
      setUploadProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Falló la subida',
      }));
    }
  };

  const handleDiscardPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewBlob(null);
    setPreviewUrl(null);
    setCanvasElement(null);
    setRecordingState('idle');
    setElapsedSeconds(0);
    setRecordingTitle('');
    setUploadProgress((prev) => ({ ...prev, status: 'idle', progressPercent: 0 }));
  };

  const handleCopyShareLink = (slug: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleDeleteRecording = async (rec: Recording) => {
    if (confirm(`¿Eliminar "${rec.title}"?`)) {
      await deleteRecording(rec.id, rec.share_slug);
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    }
  };

  // If user opened a public share link, render PublicPlayer view
  if (activeSlug) {
    return (
      <PublicPlayer
        slug={activeSlug}
        onBackToStudio={() => {
          window.history.pushState({}, '', window.location.pathname);
          setActiveSlug(null);
        }}
      />
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col p-4 sm:p-6 lg:p-8 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      {/* Header Bar */}
      <Header
        supabaseConfig={supabaseConfig}
        totalUsedMb={totalUsedMb}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-4 flex-grow my-2">
        {/* Viewport Card */}
        <RecordingViewport
          recordingState={recordingState}
          cameraConfig={cameraConfig}
          previewUrl={previewUrl}
          canvasElement={canvasElement}
          captureError={captureError}
          onToggleCamera={handleToggleCamera}
          onChangeCameraPos={handleChangeCameraPos}
          onChangeCameraShape={handleChangeCameraShape}
          onDiscardPreview={handleDiscardPreview}
          onStartRecord={handleStartCapture}
          onClearError={() => setCaptureError(null)}
        />

        {/* Control Panel Card */}
        <ControlPanel
          recordingState={recordingState}
          elapsedSeconds={elapsedSeconds}
          recordingTitle={recordingTitle}
          onTitleChange={setRecordingTitle}
          onStart={handleStartCapture}
          onPause={handlePause}
          onResume={handleResume}
          onStopAndSave={handleStopAndSave}
        />

        {/* Audio Visualizer Card */}
        <AudioVisualizer audioLevels={audioLevels} />

        {/* Multipart Upload Card */}
        <UploadProgress
          progressInfo={uploadProgress}
          supabaseConnected={supabaseConfig.isConnected}
        />

        {/* Recent Recordings Bento Card */}
        <RecentRecordings
          recordings={recordings}
          onSelectRecording={(rec) => setActiveSlug(rec.share_slug)}
          onDeleteRecording={handleDeleteRecording}
          onCopyShareLink={handleCopyShareLink}
          copiedSlug={copiedSlug}
        />

        {/* Chromium Browser Notice Bar */}
        <BrowserNotice />
      </div>

      {/* Footer */}
      <footer className="mt-6 pt-4 border-t border-zinc-800/60 flex flex-col sm:flex-row justify-between items-center text-[10px] text-zinc-500 font-mono gap-2">
        <div>REC_STREAM v2.0 • WebM (VP9 + Opus) AudioContext Mixer</div>
        <div className="flex items-center gap-4">
          <span>SUPABASE STORAGE: {supabaseConfig.isConnected ? 'CONECTADO' : 'MODO LOCAL'}</span>
          <span>Chrome / Edge Native APIs</span>
        </div>
      </footer>

      {/* Supabase Settings Modal */}
      <SupabaseSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          const { url, key } = getStoredSupabaseConfig();
          setSupabaseConfig({
            url,
            anonKey: key,
            bucketName: 'recordings',
            isConnected: !!(url && key),
          });
        }}
      />
    </div>
  );
}
