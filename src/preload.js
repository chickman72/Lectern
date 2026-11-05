const { contextBridge, ipcRenderer } = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('lectern', {
  get: invoke('state:get'), save: invoke('state:save'), open: invoke('file:open'), export: invoke('file:export'),
  show: invoke('prompter:show'), hide: invoke('prompter:hide'), command: invoke('prompter:command'),
  check: invoke('updates:check'), download: invoke('updates:download'), install: invoke('updates:install'), close: invoke('app:close'),
  on: (channel, callback) => {
    if (!['state', 'command', 'update-status', 'playback', 'closing'].includes(channel)) return;
    const handler = (_event, value) => callback(value);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  progress: invoke('prompter:progress'), parse: invoke('script:parse')
});
