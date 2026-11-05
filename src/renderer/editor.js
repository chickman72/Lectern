const $ = id => document.getElementById(id);
let state, saveTimer, editing = false, sectionGeneration = 0, updateStatus;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; setTimeout(() => $('toast').hidden = true, 5000); }
async function attempt(action) { try { return await action(); } catch (error) { toast(error.message); } }
function metrics() {
  const count = $('script').value.trim().split(/\s+/).filter(Boolean).length;
  $('words').textContent = `${count.toLocaleString()} words · about ${Math.max(1, Math.round(count / 130))} min speaking`;
}
async function sections() {
  const generation = ++sectionGeneration;
  const parsed = await lectern.parse($('script').value);
  if (generation !== sectionGeneration) return;
  $('sections').replaceChildren();
  parsed.forEach((block, index) => {
    if (!block.heading) return;
    const button = document.createElement('button'); button.textContent = block.text;
    button.onclick = () => attempt(async () => { await lectern.show(); await lectern.command({ section: index }); });
    $('sections').append(button);
  });
  if (!$('sections').children.length) $('sections').textContent = 'Add # headings to jump between topics.';
}
function updates(value) {
  updateStatus = value.status;
  $('update-message').textContent = value.message + (value.status === 'downloading' ? ` ${Math.round(value.percent)}%` : '');
  $('check').disabled = ['checking','downloading','downloaded'].includes(value.status);
  $('update-action').hidden = !['available','downloaded'].includes(value.status);
  $('update-action').textContent = value.status === 'downloaded' ? 'Install & restart' : 'Download update';
}
function render(data) {
  state = data;
  const s = data.settings;
  if (!editing) { $('title').value = s.title; $('script').value = s.script; metrics(); sections(); }
  for (const key of ['speed','fontSize','width','height','opacity','countdown','offset']) {
    if (document.activeElement !== $(key)) $(key).value = s[key];
    if ($(key + '-value')) $(key + '-value').textContent = s[key] + ({ speed: ' px/s', fontSize: ' px', opacity: '%', offset: ' px' }[key] || '');
  }
  for (const key of ['docked','protected']) $(key).checked = s[key];
  $('displayId').replaceChildren(...data.displays.map(d => { const option = document.createElement('option'); option.value = d.id; option.textContent = `${d.label} · ${d.width} × ${d.height}`; return option; }));
  $('displayId').value = s.displayId || data.displays[0]?.id;
  $('version').textContent = 'v' + data.version;
  $('shortcut-warning').textContent = data.shortcutFailures.length ? 'Unavailable shortcuts: ' + data.shortcutFailures.join(', ') : '';
  updates(data.update);
}
async function flush() {
  clearTimeout(saveTimer);
  if (!editing) return;
  const patch = { title: $('title').value, script: $('script').value };
  await lectern.save(patch); editing = false; $('saved').textContent = 'Saved on this computer';
}
for (const id of ['title','script']) $(id).addEventListener('input', () => {
  editing = true; $('saved').textContent = 'Saving…'; metrics(); clearTimeout(saveTimer);
  saveTimer = setTimeout(() => attempt(async () => { await flush(); await sections(); }), 450);
});
for (const id of ['speed','fontSize','width','height','opacity','countdown','offset','displayId','docked','protected']) $(id).addEventListener('change', () => attempt(async () => {
  await flush(); await lectern.save({ [id]: $(id).type === 'checkbox' ? $(id).checked : Number($(id).value) });
}));
for (const id of ['toggle','back','restart']) $(id).onclick = () => attempt(async () => { await flush(); await lectern.show(); await lectern.command(id); });
$('show').onclick = () => attempt(async () => { await flush(); await lectern.show(); });
$('hide').onclick = () => attempt(() => lectern.hide());
$('open').onclick = () => attempt(async () => { await flush(); await lectern.open(); });
$('export').onclick = () => attempt(async () => { await flush(); if (await lectern.export()) toast('Script exported.'); });
$('check').onclick = () => attempt(() => lectern.check());
$('update-action').onclick = () => attempt(async () => { await flush(); return updateStatus === 'downloaded' ? lectern.install() : lectern.download(); });
lectern.on('state', render);
lectern.on('closing', () => attempt(async () => { await flush(); await lectern.close(); }));
lectern.on('update-status', updates);
lectern.on('playback', value => { $('playback').textContent = `${value.playing ? 'Reading' : 'Paused'} · ${Math.floor(value.elapsed / 60)}:${String(Math.floor(value.elapsed % 60)).padStart(2,'0')}`; });
window.addEventListener('beforeunload', () => { if (editing) lectern.save({ title: $('title').value, script: $('script').value }); });
attempt(async () => render(await lectern.get()));
