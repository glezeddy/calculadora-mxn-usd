const status = document.getElementById('pwa-status');
const install = document.getElementById('install');
let promptEvent = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; install.hidden = false; });
install.addEventListener('click', async () => {
  if (!promptEvent) return;
  try { await promptEvent.prompt(); await promptEvent.userChoice; }
  finally { promptEvent = null; install.hidden = true; }
});
window.addEventListener('appinstalled', () => { install.hidden = true; promptEvent = null; });
if ('serviceWorker' in navigator) {
  let applying = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(registration => {
    const showUpdate = () => { document.getElementById('pwa-update').hidden = !(navigator.serviceWorker.controller && registration.waiting); };
    navigator.serviceWorker.addEventListener('controllerchange', showUpdate);
    showUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          showUpdate();
          if (!navigator.serviceWorker.controller) status.textContent = 'Aplicación lista para usar sin conexión.';
        }
      });
    });
    document.getElementById('apply-update').addEventListener('click', () => {
      if (!registration.waiting) return;
      applying = true;
      registration.waiting.postMessage({ type: 'APPLY_UPDATE' });
    });
    navigator.serviceWorker.ready.then(() => { status.textContent = 'Aplicación lista para usar sin conexión.'; });
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    if (navigator.onLine) check();
  }).catch(() => { status.textContent = 'No se pudo preparar el uso sin conexión. La calculadora sigue disponible mientras tengas conexión.'; });
} else status.textContent = 'Este navegador no permite preparar la aplicación sin conexión.';
