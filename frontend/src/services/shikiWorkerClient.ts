import type { HighlightOptions, HighlightResult } from './shikiService';
import { settingsStore } from '../stores/settingsStore';

type WorkerMessage = {
  id: number;
  type: 'highlight';
  code: string;
  lang: string;
  theme: 'light' | 'dark';
  codeTheme: string;
};

type WorkerResponse = {
  id: number;
  type: 'highlight-result';
  html: string;
  error?: string;
};

interface PendingRequest {
  resolve: (result: HighlightResult) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, PendingRequest>();
let isInitialized = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/shikiWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      if (response.type === 'highlight-result') {
        const pending = pendingRequests.get(response.id);
        if (pending) {
          pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve({ html: response.html });
          }
        }
      } else if (response.type === 'initialized') {
        isInitialized = true;
      }
    };

    worker.onerror = (error) => {
      console.error('Shiki worker error:', error);
    };
  }

  return worker;
}

export async function highlightCodeWorker(options: HighlightOptions): Promise<HighlightResult> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pendingRequests.set(id, { resolve, reject });

    // Determine which theme setting to use based on mode
    const effectiveThemeType = options.theme || settingsStore.effectiveTheme;
    const codeTheme = effectiveThemeType === 'dark' 
      ? settingsStore.settings().codeBlockThemeDark 
      : settingsStore.settings().codeBlockThemeLight;

    const w = getWorker();
    w.postMessage({
      id,
      type: 'highlight',
      code: options.code,
      lang: options.lang,
      theme: effectiveThemeType,
      codeTheme,
    } as WorkerMessage);

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Highlight request timeout'));
      }
    }, 10000);
  });
}

export function initWorker(): Promise<void> {
  return new Promise((resolve) => {
    if (isInitialized) {
      resolve();
      return;
    }
    
    const w = getWorker();
    
    const checkInitialized = (event: MessageEvent) => {
      if (event.data.type === 'initialized') {
        isInitialized = true;
        w.removeEventListener('message', checkInitialized);
        resolve();
      }
    };
    
    w.addEventListener('message', checkInitialized);
    
    setTimeout(() => {
      if (!isInitialized) {
        resolve();
      }
    }, 5000);
  });
}

export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    isInitialized = false;
    pendingRequests.clear();
  }
}