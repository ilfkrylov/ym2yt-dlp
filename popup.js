async function getTracks() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const links = Array.from(document.querySelectorAll('a[href*="/track/"]'));
      const re = /^\/album\/\d+\/track\/\d+$/;

      const urls = new Set();
      for (const a of links) {
        const href = a.getAttribute('href');
        if (re.test(href)) {
          urls.add(new URL(href, location.origin).href);
        }
      }

      // если это одиночный трек
      if (urls.size === 0 && location.pathname.includes('/track/')) {
        urls.add(location.href);
      }

      return Array.from(urls);
    }
  });

  return result;
}

function buildCommand(urls) {
  return (
    'yt-dlp --cookies-from-browser firefox \\\n' +
    urls.map(u => `"${u}"`).join(' \\\n')
  );
}

(async () => {
  const tracks = await getTracks();
  const container = document.getElementById('tracks');

  tracks.forEach((url, i) => {
    const div = document.createElement('div');
    div.className = 'track';
    div.innerHTML = `
      <input type="checkbox" checked data-url="${url}">
      <span>${url}</span>
    `;
    container.appendChild(div);
  });

  document.getElementById('copySelected').onclick = () => {
    const urls = [...document.querySelectorAll('input:checked')]
      .map(i => i.dataset.url);
    navigator.clipboard.writeText(buildCommand(urls));
  };

  document.getElementById('copyAll').onclick = () => {
    navigator.clipboard.writeText(buildCommand(tracks));
  };
})();