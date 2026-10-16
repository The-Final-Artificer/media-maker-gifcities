// Saving outside graphics into the user's own library. Everything lands in
// media-maker-graphics in user data, so module updates never touch it and
// the module itself never bundles or redistributes any of it.
export const USER_ROOT = 'media-maker-graphics';
export const DOWNLOAD_DIR = 'downloaded';

// The filename a GifCities hash lands under, so callers can check for an
// existing copy before fetching anything
export const gifcitiesName = hash => `gifcities-${hash.slice(0, 8).toLowerCase()}.gif`;

export async function importFromUrl(url) {
  const FP = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
  let res;
  try {
    // reload, not cache: the preview <img> may have cached this URL without
    // CORS headers (the blob server only sends them when asked with Origin)
    res = await fetch(url, { cache: 'reload' });
  } catch (e) {
    throw new Error(`download blocked: ${e.message}`);
  }
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const extFromType = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type];
  if (!extFromType && !/\.(gif|png|jpe?g|webp)$/i.test(url.split('?')[0])) throw new Error('not an image link');
  let name = decodeURIComponent(url.split('?')[0].split('/').pop() || '').replace(/[^\w.\- ]/g, '_');
  if (!/\.\w+$/.test(name)) name = `${name || 'graphic'}.${extFromType ?? 'gif'}`;
  // Archive blobs are named by 32-char hashes; keep them short
  const hash = name.match(/^([0-9a-z]{20,})\.(\w+)$/i);
  if (hash) name = `gifcities-${hash[1].slice(0, 8).toLowerCase()}.${hash[2]}`;
  const dir = `${USER_ROOT}/${DOWNLOAD_DIR}`;
  for (const p of [USER_ROOT, dir]) {
    try { await FP.createDirectory('data', p); } catch { /* already there */ }
  }
  const up = await FP.upload('data', dir, new File([blob], name, { type: blob.type || 'image/gif' }), {}, { notify: false });
  if (!up?.path) throw new Error('Foundry refused the upload (check the console)');
  return up.path;
}
