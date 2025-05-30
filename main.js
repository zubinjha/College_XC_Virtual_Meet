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
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// parse a "M:SS.d" time into total seconds
function parseTime(str) {
  const [min, rest] = str.split(':');
  const [sec, dec]  = rest.split('.');
  return Number(min) * 60 + Number(sec) + Number(dec) / 10;
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
  // 1) sort by actual finish time
  individuals.forEach(r => {
    r._seconds = parseTime(r.Time);
  });
  individuals.sort((a, b) => a._seconds - b._seconds);

  // 2) prompt for file path
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save Virtual Meet as Excel',
    defaultPath: 'virtual-meet.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return { success: false, error: 'Save canceled' };

  try {
    // 3) build the rows
    const wb   = XLSX.utils.book_new();
    const rows = [];

    // header row
    rows.push([
      'Place','Name','Team','Time','Points',
      '','',
      'Place','Team','Score'
    ]);

    // data rows
    const maxRows = Math.max(individuals.length, teams.length);
    for (let i = 0; i < maxRows; i++) {
      const ind  = individuals[i] || {};
      const team = teams[i]       || {};

      rows.push([
        // place = row index +1
        i + 1,
        ind.Name   || '',
        ind.Team   || '',
        ind.Time   || '',
        ind.Points != null ? ind.Points : '',
        '', '',
        team.Place != null ? team.Place : '',
        team.Team   || '',
        team.Score  != null ? team.Score  : ''
      ]);
    }

    // 4) to worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 5) bold + freeze header
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
    }
    ws['!freeze'] = { xSplit: '1', ySplit: '1' };

    // 6) column widths
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

    // 7) append + write
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

// quit when all windows close
app.on('window-all-closed', () => {
  app.quit();
});

