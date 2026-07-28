import { Component, Show } from 'solid-js';
import { offlineStore } from '../stores/offlineStore';
import './OfflineIndicator.css';

export const OfflineIndicator: Component = () => (
  <Show when={!offlineStore.online()}>
    <div class="offline-indicator" role="status">
      离线模式
    </div>
  </Show>
);

export default OfflineIndicator;
