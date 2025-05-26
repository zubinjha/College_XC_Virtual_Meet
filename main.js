// main.js
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { scrapeMeet } = require('./scraper/scrape.js')

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

ipcMain.handle('scrape-url', async (_, url) => {
  try {
    const data = await scrapeMeet(url)
    return { success: true, data }
  } catch (err) {
    console.error(err)
    return { success: false, error: err.message }
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
