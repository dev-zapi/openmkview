import { createSignal } from 'solid-js';

const [online, setOnline] = createSignal<boolean>(navigator.onLine);

window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

export const offlineStore = {
  online,
};

export default offlineStore;
