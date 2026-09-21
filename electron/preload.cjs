const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('campus', {
  openDataDirectory: () => ipcRenderer.invoke('data:open-directory'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  pickResume: () => ipcRenderer.invoke('resume:pick'),
  readResume: (filePath) => ipcRenderer.invoke('resume:read', filePath),
  extractResume: (filePath) => ipcRenderer.invoke('resume:extract', filePath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});

// CAMPUS_FLOW_CLOUD_STEP_1
contextBridge.exposeInMainWorld('campusSync', {
  open: uid => ipcRenderer.sendSync('sync:open', uid),
  save: (token, data) => ipcRenderer.sendSync('sync:save', token, data),
  legacySummary: token => ipcRenderer.sendSync('sync:legacy-summary', token),
  claimLegacy: token => ipcRenderer.sendSync('sync:legacy-claim', token),
});
