const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waveAPI', {
  generateCSV: (csvData) => ipcRenderer.invoke('generate-csv', csvData),
  savePreset: (presetData) => ipcRenderer.invoke('save-preset', presetData),
  loadPresets: () => ipcRenderer.invoke('load-presets')
});
