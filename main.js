// main.js

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

ipcMain.handle('save-meet', async (_, { individuals, teams }) => {
  // First, sort individuals by their original Place (ascending)
  individuals.sort((a, b) => {
    const pa = typeof a.Place === 'number' ? a.Place : Infinity;
    const pb = typeof b.Place === 'number' ? b.Place : Infinity;
    return pa - pb;
  });

  // 1) Prompt for save location
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save Virtual Meet as Excel',
    defaultPath: 'virtual-meet.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) {
    return { success: false, error: 'Save canceled' };
  }

  try {
    // 2) Build a single sheet with BOTH tables side by side
    const wb = XLSX.utils.book_new();
    const rows = [];

    // 2a) Header row: A–E = individuals, F–G blank, H–J = teams
    rows.push([
      'Place', 'Name', 'Team', 'Time', 'Points',
      '', '',
      'Place', 'Team', 'Score'
    ]);

    // 2b) Data rows: up to the longer of the two lists
    const maxRows = Math.max(individuals.length, teams.length);
    for (let i = 0; i < maxRows; i++) {
      const ind  = individuals[i] || {};
      const team = teams[i]       || {};

      rows.push([
        // <-- force Place to be row index + 1, ignoring ind.Place
        i + 1,
        ind.Name   || '',
        ind.Team   || '',
        ind.Time   || '',
        ind.Points != null ? ind.Points : '',
        '', '',
        team.Place != null ? team.Place : '',
        team.Team   || '',
        team.Score != null ? team.Score : ''
      ]);
    }

    // 3) Convert rows to a worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 4) Bold the top row and freeze it
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = { font: { bold: true } };
    }
    ws['!freeze'] = { xSplit: '1', ySplit: '1' };

    // 5) Set column widths
    ws['!cols'] = [
      { wch: 7.5 },   // A
      { wch: 20   },  // B
      { wch: 15   },  // C
      { wch: 10   },  // D
      { wch: 7.5  },  // E
      {},             // F
      { wch: 7.5  },  // G
      { wch: 7.5  },  // H
      { wch: 15   },  // I
      { wch: 7.5  }   // J
    ];

    // 6) Append sheet and save
    XLSX.utils.book_append_sheet(wb, ws, 'Virtual Meet');
    const wbout = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, wbout);

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

// Always quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});
