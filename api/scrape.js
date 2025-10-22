const { scrapeMeet } = require('../scraper/scrape');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, error: 'Missing url' });
    }

    const data = await scrapeMeet(url);
    if (!data) {
      return res.status(500).json({ success: false, error: 'Scrape failed' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Scrape error' });
  }
};
