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
  // Sort individuals by place
  individuals.sort((a, b) => {
    // ensure numeric comparison (empty or missing Place means Infinity/assume bad)
    const pa = typeof a.Place === 'number' ? a.Place : Infinity;
    const pb = typeof b.Place === 'number' ? b.Place : Infinity;
    return pa - pb;
  });

  // 1) Prompt for save location, with a default path
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
      const ind = individuals[i] || {};
      const team = teams[i] || {};
      rows.push([
        ind.Place != null ? ind.Place : '',
        ind.Name  || '',
        ind.Team  || '',
        ind.Time  || '',
        ind.Points != null ? ind.Points : '',
        '', '',
        team.Place != null ? team.Place : '',
        team.Team  || '',
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

    // 5) Set column widths: A=7.5, B=20, C=15, D=10, E=7.5, F,G untouched, H=7.5, I=15, J=7.5
    ws['!cols'] = [
      { wch: 7.5 },   // A
      { wch: 20   },  // B
      { wch: 15   },  // C
      { wch: 10   },  // D
      { wch: 7.5  },  // E
      {},             // F
      { wch: 7.5  },  // G (spacer)
      { wch: 7.5  },  // H (team Place)
      { wch: 15   },  // I (team Name)
      { wch: 7.5  }   // J (team Score)
    ];

    // 6) Append, write, and save
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
