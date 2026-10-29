import { createSignal } from 'solid-js';
import { loadShowHidden, saveShowHidden } from '../utils/settings';

const [showHidden, setShowHiddenSignal] = createSignal<boolean>(loadShowHidden());

export const fileTreeVisibilityStore = {
  showHidden,

  setShowHidden(visible: boolean) {
    setShowHiddenSignal(visible);
    saveShowHidden(visible);
  },

  toggleShowHidden() {
    this.setShowHidden(!showHidden());
  },
};

export default fileTreeVisibilityStore;
