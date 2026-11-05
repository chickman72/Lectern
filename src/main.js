const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { normalize, dockBounds, blocks } = require('./model');
const { createUpdateController } = require('./updater');
let editor, prompter, settings, updater, saveTimer, isPlaying = false, shortcutFailures = [];
const smoke = process.argv.includes('--smoke-test');
const dataFile = () => path.join(app.getPath('userData'), 'lecture.json');
function persist() {
  clearTimeout(saveTimer);
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile() + '.tmp', JSON.stringify(settings, null, 2));
  fs.renameSync(dataFile() + '.tmp', dataFile());
}
function laterSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400); }
function send(channel, value) {
  for (const win of [editor, prompter]) if (win && !win.isDestroyed()) win.webContents.send(channel, value);
}
function displays() { return screen.getAllDisplays().map(d => ({ id: d.id, label: d.label || `Display ${d.id}`, width: d.bounds.width, height: d.bounds.height })); }
function snapshot() { return { settings, displays: displays(), update: updater.getState(), shortcutFailures, version: app.getVersion() }; }
function currentDisplay() { return screen.getAllDisplays().find(d => d.id === settings.displayId) || screen.getPrimaryDisplay(); }
function positionPrompter() {
  if (!prompter || prompter.isDestroyed()) return;
  if (settings.docked) prompter.setBounds(dockBounds(settings, currentDisplay()));
  prompter.setContentProtection(settings.protected);
}
function command(value) { if (prompter?.isVisible()) prompter.webContents.send('command', value); }
function safeWindow(options, file) {
  const win = new BrowserWindow({ icon: path.join(__dirname, '..', 'assets', 'lectern.ico'), ...options, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', file));
  return win;
}
function createPrompter() {
  prompter = safeWindow({ width: settings.width, height: settings.height, minWidth: 340, minHeight: 180, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, show: false, resizable: true }, 'prompter.html');
  prompter.setAlwaysOnTop(true, 'screen-saver');
  positionPrompter();
  if (!settings.docked && settings.floatingBounds) {
    const b = settings.floatingBounds;
    const visible = screen.getAllDisplays().some(d => b.x < d.workArea.x + d.workArea.width && b.x + b.width > d.workArea.x && b.y < d.workArea.y + d.workArea.height && b.y + b.height > d.workArea.y);
    if (visible) prompter.setBounds(b);
    else prompter.setBounds(dockBounds(settings, currentDisplay()));
  }
  const moved = () => {
    if (!settings.docked) { settings.floatingBounds = prompter.getBounds(); laterSave(); }
  };
  prompter.on('moved', moved);
  prompter.on('resized', moved);
  prompter.on('close', event => { if (!app.isQuitting) { event.preventDefault(); command('pause'); prompter.hide(); } });
}
function registerIpc() {
  // Only the two bundled windows may invoke privileged operations.
  const handle = (name, callback) => ipcMain.handle(name, (event, ...args) => {
    if (![editor?.webContents, prompter?.webContents].includes(event.sender)) throw new Error('Untrusted window');
    return callback(...args);
  });
  handle('state:get', snapshot);
  handle('app:close', () => { persist(); app.isQuitting = true; app.quit(); });
  handle('script:parse', script => blocks(String(script).slice(0, 2000000)));
  handle('state:save', patch => {
    settings = normalize({ ...settings, ...patch }); laterSave(); positionPrompter(); send('state', snapshot()); return settings;
  });
  handle('prompter:show', () => { prompter.show(); });
  handle('prompter:hide', () => { command('pause'); prompter.hide(); });
  handle('prompter:command', value => { if (['toggle','pause','restart','back','forward','faster','slower'].includes(value) || (value && Number.isInteger(value.section) && value.section >= 0)) command(value); });
  handle('prompter:progress', value => {
    settings.position = normalize({ position: value.position }).position;
    isPlaying = value.playing === true;
    laterSave(); send('playback', { ...value, position: settings.position });
  });
  handle('file:open', async () => {
    const result = await dialog.showOpenDialog(editor, { filters: [{ name: 'Lecture scripts', extensions: ['md','txt'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if (fs.statSync(file).size > 2000000) throw new Error('Please choose a script smaller than 2 MB.');
    const script = fs.readFileSync(file, 'utf8');
    settings = normalize({ ...settings, title: path.basename(file, path.extname(file)), script, position: 0 });
    persist(); send('state', snapshot()); command('restart'); return settings;
  });
  handle('file:export', async () => {
    persist();
    const result = await dialog.showSaveDialog(editor, { defaultPath: settings.title.replace(/[<>:"/\\|?*]/g, '-') + '.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (!result.canceled) fs.writeFileSync(result.filePath, settings.script, 'utf8');
    return !result.canceled;
  });
  handle('updates:check', () => updater.check());
  handle('updates:download', () => updater.download());
  handle('updates:install', () => {
    if (isPlaying) throw new Error('Pause the prompter before installing an update.');
    persist(); return updater.install();
  });
}
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'lectern-smoke-' + process.pid));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => { editor?.restore(); editor?.show(); editor?.focus(); });
  app.whenReady().then(async () => {
    try { settings = normalize(JSON.parse(fs.readFileSync(dataFile(), 'utf8'))); } catch { settings = normalize(); }
    Menu.setApplicationMenu(null);
    updater = createUpdateController({ updater: require('electron-updater').autoUpdater, isPackaged: () => app.isPackaged, getVersion: () => app.getVersion(), broadcast: value => send('update-status', value), beforeInstall: () => { app.isQuitting = true; } });
    editor = safeWindow({ width: 1220, height: 860, minWidth: 960, minHeight: 680, backgroundColor: '#101815', title: 'Lectern' }, 'index.html');
    createPrompter(); registerIpc();
    const bindings = { 'CommandOrControl+Alt+Space': 'toggle', 'CommandOrControl+Alt+Left': 'back', 'CommandOrControl+Alt+Right': 'forward', 'CommandOrControl+Alt+Up': 'faster', 'CommandOrControl+Alt+Down': 'slower', 'CommandOrControl+Alt+Home': 'restart' };
    for (const [key, value] of Object.entries(bindings)) if (!globalShortcut.register(key, () => command(value))) shortcutFailures.push(key);
    screen.on('display-removed', () => { positionPrompter(); send('state', snapshot()); });
    screen.on('display-added', () => send('state', snapshot()));
    screen.on('display-metrics-changed', () => { positionPrompter(); send('state', snapshot()); });
    editor.on('close', event => {
      if (!app.isQuitting) { event.preventDefault(); editor.webContents.send('closing'); }
    });
    editor.on('closed', () => app.quit());
    if (app.isPackaged && !smoke) { const timer = setTimeout(() => updater.check(), 15000); timer.unref(); }
    if (smoke) require('./smoke').run({ app, editor, prompter, settings, snapshot, command });
  }).catch(error => { console.error(error); app.exit(1); });
}
app.on('before-quit', () => { app.isQuitting = true; if (settings) persist(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
