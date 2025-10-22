//scraper/scrape.js
const axios = require('axios');
const cheerio = require('cheerio');

// Build realistic browser-like headers to avoid basic scraper blocks
function buildRequestHeaders(targetUrl) {
  let referer = targetUrl;
  try {
    const u = new URL(targetUrl);
    // Many sites just check that the referer is same-origin
    referer = u.origin;
  } catch (_) {
    // If URL parsing fails, just send the full URL as referer
  }

  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': referer,
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1'
  };
}

// Convert "mm:ss.s" to float minutes
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const upper = timeStr.toUpperCase();
  if (upper === 'DNF' || upper === 'DNS') return null;

  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;

  const minutes = parseInt(parts[0]);
  const seconds = parseFloat(parts[1]);

  if (isNaN(minutes) || isNaN(seconds)) return null;

  return +(minutes + seconds / 60).toFixed(3);
}

async function scrapeMeet(url) {
  try {
    const response = await axios.get(url, {
      headers: buildRequestHeaders(url),
      timeout: 30000
    });
    const html = response.data;
    const $ = cheerio.load(html);

    const siteTables = $('table');
    const tables = {};

    // Get meet name
    let meetName = $('title').text() || 'Unknown Meet';
    meetName = meetName
      .replace(/- Meet Results/, '')
      .replace(/TFRRS \|/, '')
      .replace(/\//g, '-')
      .trim();

    // Get meet date
    let meetDate = 'Unknown Date';
    const dateContainer = $('.panel-second-title .panel-heading-normal-text');
    if (dateContainer.length > 0) {
      const dateText = dateContainer.text().trim();
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate)) {
        meetDate = `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;
      }
    }

    siteTables.each((i, table) => {
      const prev = $(table).prev();
      let tableName = prev.text().trim() || `Unknown Table ${i}`;

      tableName = tableName
        .replace(/\s+/g, ' ')
        .replace(/\//g, '-')
        .replace('Top↑', '')
        .trim();

      const garbageWords = ['START', 'CONDITIONS', 'WIND', 'WEATHER'];
      for (const word of garbageWords) {
        const index = tableName.indexOf(word);
        if (index !== -1) {
          tableName = tableName.substring(0, index).trim();
          break;
        }
      }

      if (!/individual/i.test(tableName)) return;

      const headers = [];
      const rows = [];

      $(table).find('tr').each((rowIndex, row) => {
        const cells = $(row).find(rowIndex === 0 ? 'th' : 'td');
        const rowData = {};

        cells.each((i, cell) => {
          const text = $(cell).text().trim();
          if (rowIndex === 0) {
            headers.push(text);
          } else {
            const header = headers[i] || `COL${i}`;
            const headerKey = header.toUpperCase();

            if (headerKey === 'NAME') {
              rowData.NAME = text;
            } else if (headerKey === 'TEAM') {
              rowData.TEAM = text;
            } else if (headerKey === 'PL') {
              const place = parseInt(text);
              if (!isNaN(place)) rowData.PLACE = place;
            } else if (headerKey === 'TIME') {
              const parsed = parseTimeToMinutes(text);
              if (parsed !== null) rowData.TIME = parsed;
            }
          }
        });

        if (
          rowIndex !== 0 &&
          rowData.NAME &&
          rowData.TEAM &&
          Number.isInteger(rowData.PLACE) &&
          typeof rowData.TIME === 'number' &&
          !isNaN(rowData.TIME)
        ) {
          rows.push(rowData);
        }
      });

      if (rows.length > 0) {
        tables[tableName] = rows;
      }
    });

    return {
      name: meetName,
      date: meetDate,
      tables: tables
    };
  } catch (err) {
    console.error(`Error scraping meet: ${err}`);
    return null;
  }
}

module.exports = {
  scrapeMeet
};
