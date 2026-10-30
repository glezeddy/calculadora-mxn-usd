import { icon, decorateIcons } from './icons.js';
export function setupUI() {
  decorateIcons();
  for (const id of ['quote', 'summary']) {
    const button = document.getElementById(`${id}-toggle`);
    const panel = document.getElementById(`${id}-panel`);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
    });
  }
}
export function presentState({ ready, short, record, manual }) {
  const change = document.getElementById('change').parentElement;
  change.classList.toggle('neutral', !ready);
  document.getElementById('result-state').textContent = !ready ? 'Por completar' : short ? 'Pago insuficiente' : 'Pago completo';
  document.getElementById('result-icon').innerHTML = icon(!ready ? 'info' : short ? 'warning' : 'check');
  document.getElementById('rate-reference').textContent = manual ? 'Tasa del negocio · Sin fecha de referencia de mercado' : record ? `Fecha de referencia: ${record.date}` : 'Sin fecha de referencia disponible';
}
