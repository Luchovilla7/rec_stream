export interface Recording {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  duration_sec: number;
  share_slug: string;
  view_count: number;
  file_size_mb: number;
  created_at: string;
  video_url: string;
  is_local?: boolean;
  mime_type?: string;
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'preview' | 'uploading' | 'completed';

export interface CameraConfig {
  enabled: boolean;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  shape: 'circle' | 'rect';
  size: number; // radius or square size in px
}

export interface AudioLevels {
  micLevel: number; // 0 to 100
  systemLevel: number; // 0 to 100
  micActive: boolean;
  systemActive: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName: string;
  isConnected: boolean;
}

export interface UploadProgressInfo {
  totalChunks: number;
  currentChunk: number;
  progressPercent: number;
  currentChunkName: string;
  bytesUploaded: number;
  totalBytes: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}
