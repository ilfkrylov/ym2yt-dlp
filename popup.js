async function getTracks() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const re = /^\/album\/\d+\/track\/\d+$/;
      const tracks = [];

      const main = document.querySelector('main');
      if (main) {
        main.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (!re.test(href)) return;

          const span = a.querySelector('span');
          const title = span ? span.textContent.trim() : href;

          tracks.push({
            url: new URL(href, location.origin).href,
            title
          });
        });
      }

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

function quoteArg(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function buildCommand(urls, options) {
  const parts = ['yt-dlp'];

  if (options.yandexToken) {
    parts.push('--extractor-args', quoteArg(`yandexmusic:token=${options.yandexToken}`));
  }

  if (options.useCookies) {
    parts.push('--cookies-from-browser firefox');
  }

  if (options.removeId) {
    parts.push('-o', quoteArg('%(artist)s - %(track)s.%(ext)s'));
  }

  return parts
    .concat(urls.map(quoteArg))
    .join(' ');
}

(async () => {
  const tracks = await getTracks();
  const container = document.getElementById('tracks');
  const tokenInput = document.getElementById('yandexToken');
  const { yandexMusicToken = '' } = await chrome.storage.session.get('yandexMusicToken');

  chrome.storage.local.remove('yandexMusicToken');

  tokenInput.value = yandexMusicToken;
  tokenInput.addEventListener('input', () => {
    chrome.storage.session.set({
      yandexMusicToken: tokenInput.value.trim()
    });
  });

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
    const urls = [...document.querySelectorAll('#tracks input:checked')]
      .map(cb => cb.dataset.url);

    if (urls.length === 0) return;

    const options = {
      removeId: document.getElementById('noId').checked,
      useCookies: document.getElementById('useCookies').checked,
      yandexToken: tokenInput.value.trim()
    };

    navigator.clipboard.writeText(
      buildCommand(urls, options)
    );
  };
})();
