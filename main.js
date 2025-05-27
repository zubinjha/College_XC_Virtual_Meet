// At the top of main.js (if not already):
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { scrapeMeet } = require('./scraper/scrape.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('scrape-url', async (_, url) => {
  try {
    const data = await scrapeMeet(url);
    return { success: true, data };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

// ← Add this block for saving Excel
ipcMain.handle('save-meet', async (_, { individuals, teams }) => {
  // Prompt user for save location
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save Virtual Meet as Excel',
    defaultPath: 'virtual-meet.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) {
    return { success: false, error: 'Save canceled' };
  }

  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert JSON arrays to sheets
    const wsIndividuals = XLSX.utils.json_to_sheet(individuals);
    const wsTeams       = XLSX.utils.json_to_sheet(teams);

    // Append sheets
    XLSX.utils.book_append_sheet(wb, wsIndividuals, 'Individuals');
    XLSX.utils.book_append_sheet(wb, wsTeams,       'Teams');

    // Write workbook to a Buffer
    const wbout = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Save Buffer to disk
    fs.writeFileSync(filePath, wbout);

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
