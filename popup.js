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
  const COPY_BUTTON_TEXT = 'Copy command';
  const COPIED_BUTTON_TEXT = 'Copied';
  const CLOSE_DELAY_MS = 1000;
  const CLOSE_ANIMATION_MS = 160;

  const tracks = await getTracks();
  const container = document.getElementById('tracks');
  const tokenInput = document.getElementById('yandexToken');
  const noIdInput = document.getElementById('noId');
  const useCookiesInput = document.getElementById('useCookies');
  const copyButton = document.getElementById('copySelected');
  let closeTimer = null;
  const {
    yandexMusicToken = '',
    removeTrackId = false,
    useFirefoxCookies = false
  } = await chrome.storage.session.get([
    'yandexMusicToken',
    'removeTrackId',
    'useFirefoxCookies'
  ]);

  chrome.storage.local.remove('yandexMusicToken');

  tokenInput.value = yandexMusicToken;
  noIdInput.checked = removeTrackId;
  useCookiesInput.checked = useFirefoxCookies;

  function clearCloseTimer() {
    if (closeTimer === null) return;

    clearTimeout(closeTimer);
    closeTimer = null;
  }

  function resetCopyState() {
    clearCloseTimer();
    document.body.classList.remove('closing');
    copyButton.textContent = COPY_BUTTON_TEXT;
  }

  function saveOptions() {
    chrome.storage.session.set({
      yandexMusicToken: tokenInput.value.trim(),
      removeTrackId: noIdInput.checked,
      useFirefoxCookies: useCookiesInput.checked
    });
  }

  function handleFormChange() {
    resetCopyState();
    saveOptions();
  }

  tokenInput.addEventListener('input', handleFormChange);
  noIdInput.addEventListener('change', handleFormChange);
  useCookiesInput.addEventListener('change', handleFormChange);

  tracks.forEach(({ url, title }) => {
    const div = document.createElement('div');
    div.className = 'track';
    div.innerHTML = `
      <input type="checkbox" checked data-url="${url}">
      <span>${title}</span>
    `;
    div.querySelector('input').addEventListener('change', resetCopyState);
    container.appendChild(div);
  });

  document.getElementById('selectAll').onclick = () => {
    document.querySelectorAll('#tracks input[type=checkbox]')
      .forEach(cb => cb.checked = true);
    resetCopyState();
  };

  document.getElementById('unselectAll').onclick = () => {
    document.querySelectorAll('#tracks input[type=checkbox]')
      .forEach(cb => cb.checked = false);
    resetCopyState();
  };

  copyButton.onclick = async () => {
    const urls = [...document.querySelectorAll('#tracks input:checked')]
      .map(cb => cb.dataset.url);

    if (urls.length === 0) return;

    const options = {
      removeId: noIdInput.checked,
      useCookies: useCookiesInput.checked,
      yandexToken: tokenInput.value.trim()
    };

    await navigator.clipboard.writeText(
      buildCommand(urls, options)
    );

    copyButton.textContent = COPIED_BUTTON_TEXT;
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      document.body.classList.add('closing');
      closeTimer = setTimeout(() => {
        window.close();
      }, CLOSE_ANIMATION_MS);
    }, CLOSE_DELAY_MS);
  };
})();
