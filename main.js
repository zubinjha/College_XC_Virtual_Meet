// main.js
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { scrapeMeet } = require('./scraper/scrape.js')  // your scraper logic

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
  // win.webContents.openDevTools()
}

ipcMain.handle('scrape-url', async (_, url) => {
  try {
    const data = await scrapeMeet(url)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
