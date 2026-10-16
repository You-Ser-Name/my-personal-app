/* QA-only adapter. The production app and its storage are unchanged. */
function qaScopedStorage(storage, prefix) {
  const ownKeys = () => Array.from({length: storage.length}, (_, i) => storage.key(i))
    .filter(key => key !== null && key.startsWith(prefix));
  return {
    get length() { return ownKeys().length; },
    key(index) { return ownKeys()[index]?.slice(prefix.length) ?? null; },
    getItem(key) { return storage.getItem(prefix + String(key)); },
    setItem(key, value) { storage.setItem(prefix + String(key), String(value)); },
    removeItem(key) { storage.removeItem(prefix + String(key)); },
    clear() { ownKeys().forEach(key => storage.removeItem(key)); }
  };
}

function qaPrepareHtml(html, campaignCode) {
  if (!/^KANTO-QA-[A-Za-z0-9-]+$/.test(campaignCode)) throw new Error('Enter a test campaign code beginning KANTO-QA-.');
  const campaign = 'const CLOUD_JOIN_CODE = "KANTO-001";';
  const rescue = /<script>\s*\/\*\s*RESCUE MODE:[\s\S]*?<\/script>/;
  if (html.split(campaign).length !== 2 || !rescue.test(html)) {
    throw new Error('The app structure changed. The QA adapter must be reviewed before testing.');
  }
  html = html.replace(campaign, 'const CLOUD_JOIN_CODE = ' + JSON.stringify(campaignCode) + ';')
    .replaceAll('Campaign KANTO-001 was not found', 'QA campaign was not found')
    .replace(rescue, '')
    .replace(/<link\s+rel="manifest"[^>]*>/, '')
    .replace('<head>', '<head><base href="../"><meta name="robots" content="noindex,nofollow">')
    .replace('<title>Pokémon Campaign Manager</title>', '<title>Pokémon Campaign — QA Sandbox</title>')
    .replace('<body>', '<body><div style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#713f12;color:white;padding:5px;text-align:center;font:12px Arial;pointer-events:none">QA TEST CAMPAIGN · disposable data · separate browser storage</div>');
  const footer = '<script>refreshAppFromGitHub = function(){ window.location.reload(); }; window.addEventListener("load", function(){ if(typeof preloadAllAppImages === "function") preloadAllAppImages(false).catch(console.warn); });</script>';
  return html.replace('</body>', footer + '</body>');
}

async function qaLaunch(campaignCode) {
  try {
    const response = await fetch('../index.html', {cache: 'no-store'});
    if (!response.ok) throw new Error('Could not load app source: HTTP ' + response.status);
    const html = qaPrepareHtml(await response.text(), campaignCode);
    // Install adapters before replacing the document. If this fails, the app
    // never starts and therefore cannot fall back to production storage.
    for (const name of ['localStorage', 'sessionStorage']) {
      const adapter = qaScopedStorage(window[name], 'pokemon-qa:' + campaignCode + ':');
      Object.defineProperty(window, name, {configurable: true, value: adapter});
      if (window[name] !== adapter) throw new Error('Could not isolate ' + name);
    }
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    const target = document.getElementById('qaLoading') || document.body;
    target.textContent = 'QA startup stopped: ' + error.message;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.getElementById('qaForm').addEventListener('submit', function(event) {
    event.preventDefault();
    qaLaunch(document.getElementById('qaCampaignCode').value.trim());
  });
}
