const XLSX = require('xlsx');

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

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { individuals = [], teams = [] } = req.body || {};
    if (!Array.isArray(individuals) || !Array.isArray(teams)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Sort individuals by parsed Time ascending
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

    // Bold header + freeze row + column widths
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="virtual-meet.xlsx"');
    return res.status(200).send(wbout);
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Export error' });
  }
};
