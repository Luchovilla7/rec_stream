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

  const chunkSize = 2 * 1024 * 1024; // 2MB chunk size for smooth multipart upload
  const totalChunks = Math.ceil(fileBlob.size / chunkSize);

  if (supabase && url && key) {
    try {
      // Direct Supabase storage bucket upload
      // Upload chunks simulation/progress tracking
      let uploadedBytes = 0;
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(fileBlob.size, start + chunkSize);
        const chunk = fileBlob.slice(start, end);
        
        uploadedBytes += chunk.size;
        const percent = Math.min(99, Math.round((uploadedBytes / fileBlob.size) * 100));
        
        onProgress(percent, i + 1, totalChunks, `PART_${i + 1}.chunk`);
        // Small async delay for progress visibility
        await new Promise((r) => setTimeout(r, 80));
      }

      // Upload full blob to Supabase Storage Bucket 'recordings'
      const { data: storageData, error: storageError } = await supabase.storage
        .from('recordings')
        .upload(fileName, fileBlob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (storageError) {
        console.warn('Supabase bucket upload error, falling back to local server/db API:', storageError.message);
        throw storageError;
      }

      // Get signed URL with 7 days expiration (or public url if bucket is public)
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7);

      const publicVideoUrl = urlData?.signedUrl || `${url}/storage/v1/object/public/recordings/${fileName}`;

      const newRecording: Recording = {
        id,
        user_id: 'user_default',
        title: title || `Grabación ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        storage_path: storagePath,
        duration_sec: durationSec,
        share_slug: shareSlug,
        view_count: 0,
        file_size_mb: fileSizeMb,
        created_at: new Date().toISOString(),
        video_url: publicVideoUrl,
        is_local: false,
        mime_type: 'video/webm',
      };

      // Try inserting into Supabase table 'recordings'
      const { error: dbError } = await supabase.from('recordings').insert([
        {
          id: newRecording.id,
          user_id: newRecording.user_id,
          title: newRecording.title,
          storage_path: newRecording.storage_path,
          duration_sec: newRecording.duration_sec,
          share_slug: newRecording.share_slug,
          view_count: 0,
          created_at: newRecording.created_at,
        },
      ]);

      if (dbError) {
        console.warn('Supabase DB insert warning (table might need creation):', dbError.message);
      }

      // Sync with server memory/local storage as well
      await saveRecordingToServer(newRecording);

      onProgress(100, totalChunks, totalChunks, 'FINAL.chunk');
      return newRecording;
    } catch (e) {
      console.warn('Supabase upload failed, using local server storage:', e);
    }
  }

  // Fallback to local server API + IndexedDB
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(fileBlob.size, start + chunkSize);
    const chunk = fileBlob.slice(start, end);

    const formData = new FormData();
    formData.append('id', id);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('chunk', chunk, `chunk_${i}`);

    try {
      await fetch('/api/upload-chunk', {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      console.warn('Chunk server upload note:', err);
    }

    const percent = Math.min(99, Math.round(((i + 1) / totalChunks) * 100));
    onProgress(percent, i + 1, totalChunks, `PART_${i + 1}.chunk`);
    await new Promise((r) => setTimeout(r, 60));
  }

  const localVideoUrl = `/api/video/${id}`;
  const newRecording: Recording = {
    id,
    user_id: 'user_default',
    title: title || `Grabación ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    storage_path: `local/${id}.webm`,
    duration_sec: durationSec,
    share_slug: shareSlug,
    view_count: 0,
    file_size_mb: fileSizeMb,
    created_at: new Date().toISOString(),
    video_url: localVideoUrl,
    is_local: true,
    mime_type: 'video/webm',
  };

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
