// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  scrapeMeet: url => ipcRenderer.invoke('scrape-url', url),
  saveMeet: data => ipcRenderer.invoke('save-meet', data)
})
