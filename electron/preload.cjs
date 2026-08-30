const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('campus', {
  pickResume: () => ipcRenderer.invoke('resume:pick'),
  openResume: (filePath) => ipcRenderer.invoke('resume:open', filePath),
  extractResume: (filePath) => ipcRenderer.invoke('resume:extract', filePath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
