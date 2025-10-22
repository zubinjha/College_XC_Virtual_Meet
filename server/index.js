const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const { scrapeMeet } = require('../scraper/scrape');

// Helper: parse "m:ss.t" into total seconds (number)
function parseTime(str) {
  if (!str || typeof str !== 'string') return Number.POSITIVE_INFINITY;
  const parts = str.split(':');
  if (parts.length !== 2) return Number.POSITIVE_INFINITY;
  const [minStr, rest] = parts;
  const [secStr, decStr = '0'] = rest.split('.');
  const min = Number(minStr);
  const sec = Number(secStr);
  const dec = Number(decStr);
  if (Number.isNaN(min) || Number.isNaN(sec) || Number.isNaN(dec)) {
    return Number.POSITIVE_INFINITY;
  }
  return min * 60 + sec + dec / 10;
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// API: Scrape a TFRRS meet URL and return structured tables
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, error: 'Missing url' });
    }
    const data = await scrapeMeet(url);
    if (!data) {
      return res.status(500).json({ success: false, error: 'Scrape failed' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Scrape error' });
  }
});

// API: Export current meet snapshot to XLSX and return as a download
app.post('/api/export', async (req, res) => {
  try {
    const { individuals = [], teams = [] } = req.body || {};
    if (!Array.isArray(individuals) || !Array.isArray(teams)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Sort individuals by parsed Time ascending (like Electron flow)
    const sortedIndividuals = individuals
      .map(r => ({ ...r, _seconds: parseTime(r.Time) }))
      .sort((a, b) => a._seconds - b._seconds);

    // Build rows
    const wb = XLSX.utils.book_new();
    const rows = [];

    // Header row
    rows.push([
      'Place', 'Name', 'Team', 'Time', 'Points',
      '', '',
      'Place', 'Team', 'Score'
    ]);

    // Data rows
    const maxRows = Math.max(sortedIndividuals.length, teams.length);
    for (let i = 0; i < maxRows; i++) {
      const ind = sortedIndividuals[i] || {};
      const team = teams[i] || {};
      rows.push([
        i + 1,
        ind.Name ?? '',
        ind.Team ?? '',
        ind.Time ?? '',
        ind.Points != null ? ind.Points : '',
        '', '',
        team.Place != null ? team.Place : '',
        team.Team ?? '',
        team.Score != null ? team.Score : ''
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Freeze header row and set column widths (styles are best-effort with SheetJS)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
    }
    ws['!freeze'] = { xSplit: '1', ySplit: '1' };
    ws['!cols'] = [
      { wch: 7.5 }, // A
      { wch: 20 },  // B
      { wch: 15 },  // C
      { wch: 10 },  // D
      { wch: 7.5 }, // E
      {},           // F
      { wch: 7.5 }, // G
      { wch: 7.5 }, // H
      { wch: 15 },  // I
      { wch: 7.5 }  // J
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Virtual Meet');

    const wbout = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="virtual-meet.xlsx"');
    return res.send(wbout);
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Export error' });
  }
});

// Static hosting for the frontend (renderer directory)
const staticDir = path.join(__dirname, '..', 'renderer');
app.use(express.static(staticDir));

/**
 * Fallback to index.html for any non-API request (Express 5 compatible)
 * Use a regex instead of '*' since path-to-regexp v6 rejects bare '*'
 */
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
});
