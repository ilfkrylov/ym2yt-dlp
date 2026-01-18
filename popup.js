async function getTracks() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const re = /^\/album\/\d+\/track\/\d+$/;
      const tracks = [];

      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!re.test(href)) return;

        const span = a.querySelector('span');
        const title = span ? span.textContent.trim() : href;

        tracks.push({
          url: new URL(href, location.origin).href,
          title
        });
      });

      // одиночный трек
      if (tracks.length === 0 && location.pathname.includes('/track/')) {
        const title =
          document.querySelector('h1 span')?.textContent.trim()
          || location.href;

        tracks.push({
          url: location.href,
          title
        });
      }

      return tracks;
    }
  });

  return result;
}

function buildCommand(urls, removeId) {
  const outputOpt = removeId
    ? '-o "%(artist)s - %(track)s.%(ext)s" '
    : '';

  return (
    `yt-dlp --cookies-from-browser firefox ${outputOpt}\\\n` +
    urls.map(u => `"${u}"`).join(' \\\n')
  );
}

(async () => {
  const tracks = await getTracks();
  const container = document.getElementById('tracks');

  tracks.forEach(({ url, title }) => {
    const div = document.createElement('div');
    div.className = 'track';
    div.innerHTML = `
      <input type="checkbox" checked data-url="${url}">
      <span>${title}</span>
    `;
    container.appendChild(div);
  });

  document.getElementById('selectAll').onclick = () => {
    document.querySelectorAll('#tracks input[type=checkbox]')
      .forEach(cb => cb.checked = true);
  };

  document.getElementById('unselectAll').onclick = () => {
    document.querySelectorAll('#tracks input[type=checkbox]')
      .forEach(cb => cb.checked = false);
  };

  document.getElementById('copySelected').onclick = () => {
    const removeId = document.getElementById('noId').checked;

    const urls = [...document.querySelectorAll('#tracks input:checked')]
      .map(cb => cb.dataset.url);

    if (urls.length === 0) return;

    navigator.clipboard.writeText(
      buildCommand(urls, removeId)
    );
  };
})();