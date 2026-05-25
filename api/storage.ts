/**
 * Layer di astrazione per Supabase Storage.
 *
 * Convenzione bucket "spot-photos":
 *   - path: <user_id>/<timestamp>-<random>.<ext>
 *   - public read, write solo dal proprietario (vedi 0002_storage.sql)
 */

import { supabase } from '@/lib/supabase';

const BUCKET = 'spot-photos';

export async function uploadSpotPhoto(params: {
  userId: string;
  fileUri: string;
  contentType?: string;
}): Promise<string> {
  const contentType = params.contentType ?? 'image/jpeg';
  const extension = inferExtension(contentType, params.fileUri);
  const path = `${params.userId}/${Date.now()}-${randomToken()}.${extension}`;

  // In React Native non possiamo passare un Blob direttamente a supabase-js,
  // ma fetch(uri).arrayBuffer() funziona per file:// e content://.
  const response = await fetch(params.fileUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`upload_failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

function inferExtension(contentType: string, fileUri: string): string {
  const fromMime = contentType.split('/')[1];
  if (fromMime && fromMime !== 'octet-stream') return fromMime;
  const fromUri = fileUri.split('.').pop()?.toLowerCase();
  if (fromUri && fromUri.length <= 5) return fromUri;
  return 'jpg';
}
