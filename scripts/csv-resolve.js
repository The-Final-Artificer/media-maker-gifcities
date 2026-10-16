// AI CSV support: any field whose whole value is "gifcities:term" (or
// gifcities:term:N for the Nth result) gets searched in the bundled index,
// downloaded into the GM's library and replaced with the local path. The
// CSV never carries the image, just the wish.
import { importFromUrl, gifcitiesName, USER_ROOT, DOWNLOAD_DIR } from './graphics-import.js';
import { loadIndex, findMatches, blobUrl } from './gifcities-browser.js';

const GIFCITIES_RE = /^gifcities:([^:]+?)(?::(\d+))?$/i;

export async function resolveGifcitiesRefs(res, { variety = false } = {}) {
  const refs = [];
  const visit = obj => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && GIFCITIES_RE.test(v.trim())) refs.push({ obj, k, token: v.trim() });
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(res.sites);
  visit(res.papers);
  if (!refs.length) return;

  const bar = ui.notifications.info(`Fetching ${refs.length} gif${refs.length === 1 ? '' : 's'} from GifCities...`, { progress: true });

  let index;
  try {
    index = await loadIndex();
  } catch {
    res.warnings.push('GifCities index could not be loaded; gifcities: graphics skipped.');
    for (const ref of refs) ref.obj[ref.k] = '';
    bar.update({ pct: 1, message: 'GifCities index could not be loaded.' });
    return;
  }

  // What's already on disk; a gif we have is reused, never fetched again
  const FP = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
  const have = new Map();
  try {
    const dir = await FP.browse('data', `${USER_ROOT}/${DOWNLOAD_DIR}`);
    for (const f of dir?.files ?? []) have.set(decodeURIComponent(f.split('/').pop()), f);
  } catch { /* nothing downloaded yet */ }

  const byHash = new Map();
  const hashPath = async (hash, term) => {
    if (byHash.has(hash)) return byHash.get(hash);
    let p = have.get(gifcitiesName(hash));
    if (!p) {
      try {
        p = await importFromUrl(blobUrl(hash));
      } catch (err) {
        res.warnings.push(`GifCities download failed for "${term}": ${err.message}`);
        p = '';
      }
    }
    byHash.set(hash, p);
    return p;
  };

  const matches = new Map();
  let done = 0;
  for (const ref of refs) {
    const m = ref.token.match(GIFCITIES_RE);
    const term = m[1].trim().toLowerCase();
    let hits = matches.get(term);
    if (!hits) {
      hits = findMatches(index, term);
      matches.set(term, hits);
    }
    if (!hits.length) {
      res.warnings.push(`No GifCities results for "${term}", graphic skipped.`);
      ref.obj[ref.k] = '';
    } else {
      // A numbered token is a deliberate choice and stays exact; bare terms
      // take the first result, or any of them when variety is on
      let pick;
      if (m[2]) pick = hits[(Math.max(1, parseInt(m[2], 10) || 1) - 1) % hits.length];
      else if (variety) pick = hits[Math.floor(Math.random() * hits.length)];
      else pick = hits[0];
      ref.obj[ref.k] = await hashPath(pick[0], term);
    }
    done++;
    bar.update({ pct: done / refs.length, message: `Downloading gifs and building the site... ${done}/${refs.length}` });
  }
}
