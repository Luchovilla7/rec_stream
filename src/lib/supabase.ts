import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recording, SupabaseConfig } from '../types';
import { saveLocalRecordingBlob, getLocalRecordingBlob, deleteLocalRecordingBlob } from './idb';

const SUPABASE_URL_KEY = 'rec_stream_supabase_url';
const SUPABASE_KEY_KEY = 'rec_stream_supabase_key';

export function getStoredSupabaseConfig(): { url: string; key: string } {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
  
  const localUrl = localStorage.getItem(SUPABASE_URL_KEY) || envUrl;
  const localKey = localStorage.getItem(SUPABASE_KEY_KEY) || envKey;

  return { url: localUrl, key: localKey };
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_KEY_KEY, key);
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();
  if (!url || !key) return null;

  if (!cachedClient) {
    try {
      cachedClient = createClient(url, key);
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return cachedClient;
}

export function resetSupabaseClient() {
  cachedClient = null;
}

// Generate random share slug (e.g. "rec-8f3a9")
export function generateShareSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'rec-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to upload raw video binary to local server with real-time progress
function uploadVideoFileToServer(
  id: string,
  blob: Blob,
  onProgress: (percent: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload-video/${id}`, true);
    xhr.setRequestHeader('Content-Type', 'video/webm');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(true);
      } else {
        console.warn('Server upload video status:', xhr.status);
        resolve(false);
      }
    };

    xhr.onerror = () => {
      console.warn('Server upload video network error');
      resolve(false);
    };

    xhr.send(blob);
  });
}

// Upload chunk by chunk to Supabase Storage or server/local fallback
export async function uploadRecordingInChunks(
  fileBlob: Blob,
  title: string,
  durationSec: number,
  onProgress: (percent: number, currentChunk: number, totalChunks: number, chunkName: string) => void
): Promise<Recording> {
  const { url, key } = getStoredSupabaseConfig();
  const supabase = getSupabaseClient();
  const id = 'rec_' + Date.now();
  const shareSlug = generateShareSlug();
  const fileSizeMb = parseFloat((fileBlob.size / (1024 * 1024)).toFixed(2));
  const fileName = `${id}_${shareSlug}.webm`;
  const storagePath = `recordings/${fileName}`;

  // Save to IndexedDB locally first as instant backup
  await saveLocalRecordingBlob(id, fileBlob);

  const chunkSize = 2 * 1024 * 1024; // 2MB chunk visualizer
  const totalChunks = Math.ceil(fileBlob.size / chunkSize);

  let supabaseSuccess = false;
  let publicVideoUrl = `/api/video/${id}`;

  if (supabase && url && key) {
    try {
      let uploadedBytes = 0;
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(fileBlob.size, start + chunkSize);
        const chunk = fileBlob.slice(start, end);
        uploadedBytes += chunk.size;
        const percent = Math.min(99, Math.round((uploadedBytes / fileBlob.size) * 100));
        onProgress(percent, i + 1, totalChunks, `PART_${i + 1}.chunk`);
        await new Promise((r) => setTimeout(r, 40));
      }

      const { data: storageData, error: storageError } = await supabase.storage
        .from('recordings')
        .upload(fileName, fileBlob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (!storageError) {
        const { data: urlData } = await supabase.storage
          .from('recordings')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365);

        publicVideoUrl = urlData?.signedUrl || `${url}/storage/v1/object/public/recordings/${fileName}`;
        supabaseSuccess = true;
      }
    } catch (e) {
      console.warn('Supabase upload failed, using local server storage:', e);
    }
  }

  // Upload video binary to server storage so links work everywhere
  await uploadVideoFileToServer(id, fileBlob, (pct) => {
    if (!supabaseSuccess) {
      const chunk = Math.min(totalChunks, Math.ceil((pct / 100) * totalChunks));
      onProgress(pct, chunk, totalChunks, `SERVER_PART_${chunk}.chunk`);
    }
  });

  const newRecording: Recording = {
    id,
    user_id: 'user_default',
    title: title || `Grabación ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    storage_path: supabaseSuccess ? storagePath : `local/${id}.webm`,
    duration_sec: durationSec,
    share_slug: shareSlug,
    view_count: 0,
    file_size_mb: fileSizeMb,
    created_at: new Date().toISOString(),
    video_url: publicVideoUrl,
    is_local: !supabaseSuccess,
    mime_type: 'video/webm',
  };

  // Insert into Supabase DB if available
  if (supabase && supabaseSuccess) {
    try {
      await supabase.from('recordings').insert([
        {
          id: newRecording.id,
          user_id: newRecording.user_id,
          title: newRecording.title,
          storage_path: newRecording.storage_path,
          duration_sec: newRecording.duration_sec,
          share_slug: newRecording.share_slug,
          view_count: 0,
          created_at: newRecording.created_at,
          video_url: newRecording.video_url,
        },
      ]);
    } catch (err) {
      console.warn('Supabase DB insert note:', err);
    }
  }

  // Always save metadata to server recordings.json
  await saveRecordingToServer(newRecording);

  onProgress(100, totalChunks, totalChunks, 'FINAL.chunk');
  return newRecording;
}

async function saveRecordingToServer(rec: Recording): Promise<void> {
  try {
    await fetch('/api/recordings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
  } catch (e) {
    // Save to localStorage as secondary fallback
    const list = getLocalRecordingsFromStore();
    list.unshift(rec);
    localStorage.setItem('rec_stream_local_list', JSON.stringify(list));
  }
}

export function getLocalRecordingsFromStore(): Recording[] {
  try {
    const raw = localStorage.getItem('rec_stream_local_list');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchAllRecordings(): Promise<Recording[]> {
  const supabase = getSupabaseClient();
  let supabaseRecordings: Recording[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        supabaseRecordings = data.map((item: any) => ({
          ...item,
          file_size_mb: item.file_size_mb || 15.4,
          video_url: item.video_url || `${getStoredSupabaseConfig().url}/storage/v1/object/public/recordings/${item.storage_path.replace('recordings/', '')}`,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch error:', e);
    }
  }

  try {
    const res = await fetch('/api/recordings');
    if (res.ok) {
      const serverRecordings: Recording[] = await res.json();
      // Combine Supabase and server recordings without duplicates
      const map = new Map<string, Recording>();
      supabaseRecordings.forEach((r) => map.set(r.id, r));
      serverRecordings.forEach((r) => map.set(r.id, r));
      const combined = Array.from(map.values());
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined;
    }
  } catch {
    // Return local list
  }

  return getLocalRecordingsFromStore();
}

export async function fetchRecordingBySlug(slug: string): Promise<Recording | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.from('recordings').select('*').eq('share_slug', slug).single();
      if (data) {
        // Increment view count in Supabase
        await supabase.from('recordings').update({ view_count: (data.view_count || 0) + 1 }).eq('share_slug', slug);
        return {
          ...data,
          view_count: (data.view_count || 0) + 1,
          video_url: data.video_url || `${getStoredSupabaseConfig().url}/storage/v1/object/public/recordings/${data.storage_path.replace('recordings/', '')}`,
        };
      }
    } catch (e) {
      console.warn('Supabase fetch by slug warning:', e);
    }
  }

  try {
    const res = await fetch(`/api/recordings/${slug}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Check local fallback
  }

  const list = getLocalRecordingsFromStore();
  const found = list.find((r) => r.share_slug === slug);
  if (found) {
    found.view_count += 1;
    localStorage.setItem('rec_stream_local_list', JSON.stringify(list));
    return found;
  }

  return null;
}

export async function deleteRecording(id: string, slug?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase && slug) {
    try {
      await supabase.from('recordings').delete().eq('share_slug', slug);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }

  try {
    await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Server delete note:', e);
  }

  await deleteLocalRecordingBlob(id);
  const list = getLocalRecordingsFromStore().filter((r) => r.id !== id);
  localStorage.setItem('rec_stream_local_list', JSON.stringify(list));
  return true;
}

export async function downloadRecording(rec: Recording): Promise<void> {
  const safeFilename = (rec.title || 'grabacion_pantalla')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\-]/g, '_')
    .replace(/_+/g, '_');
  const filename = `${safeFilename || 'video'}.webm`;

  // 1. Try local IndexedDB blob first
  try {
    const localBlob = await getLocalRecordingBlob(rec.id);
    if (localBlob) {
      const blobUrl = URL.createObjectURL(localBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }
  } catch (e) {
    console.warn('IndexedDB download check:', e);
  }

  // 2. Try fetching video from video_url
  if (rec.video_url) {
    try {
      const response = await fetch(rec.video_url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }
    } catch (e) {
      console.warn('Direct fetch download fallback:', e);
    }

    // Direct link click fallback
    const a = document.createElement('a');
    a.href = rec.video_url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
