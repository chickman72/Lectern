const $ = id => document.getElementById(id);
let settings, lastScript, playing = false, countdownEnd = 0, elapsed = 0, previous = 0, lastReport = 0, renderGeneration = 0;
const viewport = $('viewport');
function report() { return lectern.progress({ position: viewport.scrollTop, playing: playing || !!countdownEnd, elapsed }); }
function pause() { playing = false; countdownEnd = 0; $('count').hidden = true; controls(); report(); }
function controls() { document.body.classList.toggle('paused', !playing); $('toggle').textContent = playing || countdownEnd ? 'Ⅱ Pause' : '▶ Play'; }
async function render(data) {
  settings = data.settings;
  $('panel').style.backgroundColor = `rgba(13,20,16,${settings.opacity / 100})`;
  $('text').style.fontSize = settings.fontSize + 'px';
  $('pace').textContent = settings.speed + ' px/s';
  $('mode').textContent = settings.docked ? '· DOCKED' : '· FLOATING';
  $('dock').textContent = settings.docked ? 'Undock' : 'Dock';
  if (lastScript !== settings.script) {
    const wasLoaded = lastScript !== undefined;
    const generation = ++renderGeneration;
    lastScript = settings.script;
    const parsed = await lectern.parse(settings.script);
    if (generation !== renderGeneration) return;
    if (wasLoaded) pause();
    $('text').replaceChildren(...parsed.map((block, index) => { const p = document.createElement('p'); p.textContent = block.text; p.dataset.index = index; if (block.heading) p.className = 'heading'; else if (!block.text.trim()) p.className = 'blank'; return p; }));
    viewport.scrollTop = settings.position;
  }
  controls();
}
function command(value) {
  if (!settings) return;
  if (value === 'pause') return pause();
  if (value === 'toggle') {
    if (playing || countdownEnd) return pause();
    if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2) viewport.scrollTop = 0;
    if (settings.countdown > 0) countdownEnd = performance.now() + settings.countdown * 1000;
    else playing = true;
    controls(); report();
  }
  if (value === 'restart') { pause(); viewport.scrollTop = 0; elapsed = 0; report(); }
  if (value === 'back' || value === 'forward') { pause(); viewport.scrollTop += (value === 'back' ? -1 : 1) * settings.fontSize * 1.55 * 3; report(); }
  if (value === 'faster' || value === 'slower') lectern.save({ speed: Math.min(150, Math.max(5, settings.speed + (value === 'faster' ? 5 : -5))) });
  if (Number.isInteger(value?.section)) { pause(); const p = $('text').querySelector(`[data-index="${value.section}"]`); if (p) viewport.scrollTop += p.getBoundingClientRect().top - viewport.getBoundingClientRect().top; report(); }
}
let fractional = 0;
function frame(now) {
  const dt = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now;
  if (countdownEnd) {
    const remaining = Math.ceil((countdownEnd - now) / 1000);
    $('count').hidden = remaining <= 0; $('count').textContent = remaining;
    if (remaining <= 0) { countdownEnd = 0; playing = true; controls(); }
  }
  if (playing && settings) {
    fractional += settings.speed * dt;
    if (fractional >= 1) { const pixels = Math.floor(fractional); viewport.scrollTop += pixels; fractional -= pixels; }
    elapsed += dt;
    if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1) pause();
  }
  $('time').textContent = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  if (now - lastReport > 1000 && (playing || countdownEnd)) { report(); lastReport = now; }
  requestAnimationFrame(frame);
}
for (const id of ['toggle','restart','back','forward']) $(id).onclick = () => command(id);
$('close').onclick = () => { pause(); lectern.hide(); };
$('dock').onclick = () => lectern.save({ docked: !settings.docked });
viewport.addEventListener('wheel', () => pause(), { passive: true });
viewport.addEventListener('scroll', () => { if (!playing && !countdownEnd) report(); }, { passive: true });
document.addEventListener('keydown', event => { if (event.ctrlKey || event.altKey || event.metaKey || event.target.tagName === 'BUTTON') return; const key = { ' ': 'toggle', ArrowLeft: 'back', ArrowRight: 'forward', Escape: 'pause' }[event.key]; if (key) { event.preventDefault(); command(key); } });
lectern.on('state', render); lectern.on('command', command);
lectern.get().then(render); controls(); requestAnimationFrame(frame);
