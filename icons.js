const paths = {
  plus:'M12 5v14M5 12h14', trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  keyboard:'M3 5h18v14H3zM7 9h.01M11 9h.01M15 9h.01M18 9h.01M7 12h.01M11 12h.01M15 12h.01M18 12h.01M7 16h10',
  refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
  copy:'M9 9h12v12H9zM5 15H3V3h12v2',clear:'M9 4h11v16H9l-7-8zM12 9l5 6M17 9l-5 6',
  check:'M5 12l4 4L19 6',warning:'M12 3L2 21h20zM12 9v5M12 18h.01',info:'M12 8h.01M12 12v5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  chevron:'M6 9l6 6 6-6',reset:'M3 4v6h6M3 10a9 9 0 1 1 2 8',receipt:'M5 3h14v18l-4-2-3 2-3-2-4 2zM9 8h6M9 12h6'
};
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[name] || paths.info}"/></svg>`;
}
export function decorateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}
