import { Component, Show } from 'solid-js';
import { offlineStore } from '../stores/offlineStore';
import './OfflineIndicator.css';

export const OfflineIndicator: Component = () => (
  <Show when={!offlineStore.online()}>
    <div class="offline-indicator" role="status">
      Offline
    </div>
  </Show>
);

export default OfflineIndicator;
