// Media Maker: GifCities. Hangs the GifCities search off Media Maker's
// extension hooks: a button in the graphics library, a Variety option and
// gifcities: token resolution in the AI CSV import, and the extra guide
// section for the copied AI instructions.
import { openGifcitiesBrowser } from './scripts/gifcities-browser.js';
import { resolveGifcitiesRefs } from './scripts/csv-resolve.js';
import { DOWNLOAD_DIR } from './scripts/graphics-import.js';

Hooks.on('mediaMakerGraphicsPicker', (el, { refresh }) => {
  if (!game.user.can('FILES_UPLOAD')) return;
  if (el.querySelector('.mm-gc-launch')) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
  row.innerHTML = '<button type="button" class="mm-gc-launch" style="flex:0 0 auto;width:auto;" title="Search the Internet Archive\'s GifCities collection"><i class="fas fa-globe"></i> GifCities</button>';
  el.querySelector('.mm-gfx-grid')?.before(row);
  row.querySelector('.mm-gc-launch').addEventListener('click', async () => {
    const saved = await openGifcitiesBrowser();
    if (saved) await refresh(DOWNLOAD_DIR);
  });
});

Hooks.on('mediaMakerCsvDialog', el => {
  if (el.querySelector('.mm-gc-variety')) return;
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:12px;';
  label.title = 'gifcities graphics written without a number pick a random match instead of always the first; ones you already have are reused, new ones download';
  label.innerHTML = '<input type="checkbox" class="mm-gc-variety" data-mm-import-opt="gifcitiesVariety" style="flex:0 0 auto;margin:0;"> Variety: pick random GifCities gifs instead of always the same one';
  el.querySelector('.mm-csv-text')?.before(label);
});

Hooks.on('mediaMakerCsvImportResolve', (res, opts, jobs) => {
  jobs.push(resolveGifcitiesRefs(res, { variety: !!opts.gifcitiesVariety }));
});

let _guideSection = null;
Hooks.on('mediaMakerAiGuideExtras', parts => {
  _guideSection ??= fetch('modules/media-maker-gifcities/AI-GUIDE-SECTION.md')
    .then(r => r.ok ? r.text() : '')
    .catch(() => '');
  parts.push(_guideSection);
});
