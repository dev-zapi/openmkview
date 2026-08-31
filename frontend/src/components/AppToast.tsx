import { Component, Show } from 'solid-js';
import type { AppToastMessage } from '../hooks/useProjectGit';
import './AppToast.css';

interface AppToastProps {
  toast: AppToastMessage | null;
}

export const AppToast: Component<AppToastProps> = (props) => (
  <Show when={props.toast}>
    {(toast) => (
      <div
        class={`app-toast app-toast-${toast().type}`}
        role={toast().type === 'success' ? 'status' : 'alert'}
        aria-live={toast().type === 'success' ? 'polite' : 'assertive'}
      >
        {toast().message}
      </div>
    )}
  </Show>
);

export default AppToast;
