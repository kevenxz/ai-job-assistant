import { createRoot } from 'react-dom/client';
import { rememberClickedJobCard } from './boss';
import { Panel } from './panel';
import { PANEL_CSS } from './styles';

const HOST_ID = 'aijob-panel-host';

function mount(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);
  createRoot(container).render(<Panel />);
}

document.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>(
      '.job-card-wrapper, .job-card-box, .job-card, li, article',
    );
    if (card) {
      rememberClickedJobCard(card);
      window.dispatchEvent(new CustomEvent('aijob:job-card-clicked'));
    }
  },
  true,
);

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'TOGGLE_PANEL') {
    window.dispatchEvent(new Event('aijob:toggle-panel'));
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
