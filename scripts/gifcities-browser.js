// In-module browser for the Internet Archive's GifCities collection.
// Search runs against a bundled index of content hashes (the module ships
// no images); thumbnails load straight off blob.gifcities.org and a click
// saves that gif into the user's own graphics folder.
import { importFromUrl } from './graphics-import.js';

export const blobUrl = hash => `https://blob.gifcities.org/gifcities/${hash}.gif`;
const PAGE = 40;

let _index = null;
export async function loadIndex() {
  if (_index) return _index;
  const res = await fetch('modules/media-maker-gifcities/data/gifcities-index.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  _index = await res.json();
  return _index;
}

export function findMatches(index, q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set();
  const hits = [];
  for (const [term, list] of Object.entries(index)) {
    if (!term.includes(q) && !q.includes(term)) continue;
    for (const e of list) {
      if (seen.has(e[0])) continue;
      seen.add(e[0]);
      hits.push(e);
    }
  }
  return hits;
}

// Resolves to the number of gifs saved, so the caller knows whether the
// library needs a refresh.
export async function openGifcitiesBrowser() {
  let index;
  try {
    index = await loadIndex();
  } catch (err) {
    console.error('Media Maker | gifcities index failed to load', err);
    ui.notifications.error('The GifCities index could not be loaded.');
    return 0;
  }
  let saved = 0;

  await foundry.applications.api.DialogV2.wait({
    window: { title: 'GifCities Search (Internet Archive)', icon: 'fas fa-globe' },
    position: { width: 660 },
    content: `
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
        <input type="search" class="mm-gc-q" list="mm-gc-terms" placeholder="Search the GeoCities gif archive..." style="flex:1;">
        <datalist id="mm-gc-terms">${Object.keys(index).sort().map(t => `<option value="${foundry.utils.escapeHTML(t)}">`).join('')}</datalist>
        <button type="button" class="mm-gc-open" title="Open gifcities.org in a browser tab" style="flex:0 0 auto;width:auto;"><i class="fas fa-external-link-alt"></i></button>
      </div>
      <div class="mm-gc-status" style="font-size:11px;opacity:0.7;margin-bottom:4px;">Click a gif to save it into your library. Previews load from blob.gifcities.org.</div>
      <div class="mm-gc-grid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:420px;overflow-y:auto;align-content:flex-start;background:#23232f;padding:6px;border-radius:4px;"></div>
      <div class="mm-gc-pager" style="display:none;justify-content:center;align-items:center;gap:12px;margin-top:6px;">
        <button type="button" class="mm-gc-prev" style="flex:0 0 auto;width:auto;"><i class="fas fa-chevron-left"></i></button>
        <span class="mm-gc-page" style="font-size:12px;opacity:0.8;min-width:80px;text-align:center;"></span>
        <button type="button" class="mm-gc-next" style="flex:0 0 auto;width:auto;"><i class="fas fa-chevron-right"></i></button>
      </div>`,
    buttons: [{ action: 'done', label: 'Done', icon: 'fas fa-check', default: true }],
    rejectClose: false,
    render: (event, dialog) => {
      const el = dialog instanceof HTMLElement ? dialog : dialog?.element;
      if (!el) return;
      (el.closest('.application') ?? el).classList.add('mm-gc-ontop');
      const input = el.querySelector('.mm-gc-q');
      const grid = el.querySelector('.mm-gc-grid');
      const status = el.querySelector('.mm-gc-status');
      const pager = el.querySelector('.mm-gc-pager');
      const pageLbl = el.querySelector('.mm-gc-page');
      const prev = el.querySelector('.mm-gc-prev');
      const next = el.querySelector('.mm-gc-next');
      let hits = [];
      let pageIdx = 0;

      const showPage = i => {
        const pages = Math.max(1, Math.ceil(hits.length / PAGE));
        pageIdx = Math.min(Math.max(0, i), pages - 1);
        grid.innerHTML = '';
        grid.scrollTop = 0;
        for (const [hash, w, h] of hits.slice(pageIdx * PAGE, pageIdx * PAGE + PAGE)) {
          const img = document.createElement('img');
          img.src = blobUrl(hash);
          img.loading = 'lazy';
          img.draggable = false;
          img.title = w && h ? `${w}x${h}` : 'gif';
          img.style.cssText = 'max-width:140px;max-height:64px;background:#e8e8e8;padding:2px;border-radius:2px;cursor:pointer;';
          // The blob server drops some requests under load; one quiet retry
          img.addEventListener('error', () => {
            if (img.dataset.retried) return;
            img.dataset.retried = '1';
            setTimeout(() => { img.src = blobUrl(hash) + '?retry=1'; }, 800 + Math.random() * 1200);
          });
          img.addEventListener('click', async () => {
            if (img.dataset.done) return;
            img.style.opacity = '0.4';
            try {
              await importFromUrl(blobUrl(hash));
              saved++;
              img.dataset.done = '1';
              img.style.opacity = '1';
              img.style.outline = '2px solid #39b54a';
              img.title = 'Saved to your library';
            } catch (err) {
              console.error('Media Maker | gifcities download failed', err);
              img.style.opacity = '1';
              ui.notifications.error(`Could not save that gif: ${err.message}`);
            }
          });
          grid.appendChild(img);
        }
        pager.style.display = pages > 1 ? 'flex' : 'none';
        pageLbl.textContent = `Page ${pageIdx + 1} / ${pages}`;
        prev.disabled = pageIdx === 0;
        next.disabled = pageIdx === pages - 1;
      };

      const search = () => {
        hits = findMatches(index, input.value);
        grid.innerHTML = '';
        pager.style.display = 'none';
        if (!input.value.trim()) {
          status.textContent = 'Click a gif to save it into your library. Previews load from blob.gifcities.org.';
          return;
        }
        if (!hits.length) {
          status.textContent = 'Nothing for that word in the built-in index. The arrow button opens the full site; save a gif there and drop it into media-maker-graphics in user data.';
          return;
        }
        status.textContent = `${hits.length} gifs. Click one to save it into your library.`;
        showPage(0);
      };

      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(search, 250);
      });
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        clearTimeout(timer);
        search();
      });
      prev.addEventListener('click', () => showPage(pageIdx - 1));
      next.addEventListener('click', () => showPage(pageIdx + 1));
      el.querySelector('.mm-gc-open').addEventListener('click', () => {
        const q = encodeURIComponent(input.value.trim());
        window.open(`https://gifcities.org/search?q=${q}&offset=0&page_size=200`, '_blank');
      });
      input.focus();
    }
  });
  return saved;
}
