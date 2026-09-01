const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('campus', {
  loadData: () => ipcRenderer.invoke('data:load'),
  recoverData: () => ipcRenderer.invoke('data:recover'),
  saveData: (patch) => ipcRenderer.invoke('data:save', patch),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  pickResume: () => ipcRenderer.invoke('resume:pick'),
  openResume: (filePath) => ipcRenderer.invoke('resume:open', filePath),
  extractResume: (filePath) => ipcRenderer.invoke('resume:extract', filePath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
