/* Browser bridge to the backend API (replaces Electron preload window.api) */
window.api = {
  scrapeMeet: async (url) => {
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      return await res.json(); // { success, data } on success
    } catch (err) {
      console.error('scrapeMeet failed:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  saveMeet: async ({ individuals, teams }) => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ individuals, teams })
      });

      if (!res.ok) {
        // Attempt to read JSON error
        try {
          const j = await res.json();
          return { success: false, error: j.error || `HTTP ${res.status}` };
        } catch {
          return { success: false, error: `HTTP ${res.status}` };
        }
      }

      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      let filename = 'virtual-meet.xlsx';
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
      if (match && match[1]) {
        try {
          filename = decodeURIComponent(match[1].replace(/\"/g, ''));
        } catch {
          filename = match[1].replace(/\"/g, '');
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (err) {
      console.error('saveMeet failed:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  }
};
