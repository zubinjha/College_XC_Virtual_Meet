// preload.js
const { contextBridge } = require('electron')
// instead of require('path') + path.join(...), just pull in your scraper:
const { scrapeMeet } = require('./scraper/scrape')

contextBridge.exposeInMainWorld('electronAPI', {
  scrapeMeet
})
