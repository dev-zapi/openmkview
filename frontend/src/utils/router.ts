export interface RouteState {
  projectId: number | null;
  filePath: string | null;
}

export function encodeFilePath(path: string): string {
  return encodeURIComponent(path);
}

export function decodeFilePath(encoded: string): string {
  return decodeURIComponent(encoded);
}

export function getCurrentRoute(): RouteState {
  const path = window.location.pathname;
  
  if (path === '/' || path === '') {
    return { projectId: null, filePath: null };
  }
  
  const projectMatch = path.match(/^\/project\/(\d+)$/);
  if (projectMatch) {
    return {
      projectId: parseInt(projectMatch[1], 10),
      filePath: null,
    };
  }
  
  const fileMatch = path.match(/^\/project\/(\d+)\/files\/(.+)$/);
  if (fileMatch) {
    return {
      projectId: parseInt(fileMatch[1], 10),
      filePath: decodeFilePath(fileMatch[2]),
    };
  }
  
  return { projectId: null, filePath: null };
}

export function navigateToProject(projectId: number): void {
  const url = `/project/${projectId}`;
  window.history.pushState({ projectId }, '', url);
}

export function navigateToFile(projectId: number, filePath: string): void {
  const url = `/project/${projectId}/files/${encodeFilePath(filePath)}`;
  window.history.pushState({ projectId, filePath }, '', url);
}

export function navigateToHome(): void {
  window.history.pushState(null, '', '/');
}

export function replaceToProject(projectId: number): void {
  const url = `/project/${projectId}`;
  window.history.replaceState({ projectId }, '', url);
}

export function replaceToFile(projectId: number, filePath: string): void {
  const url = `/project/${projectId}/files/${encodeFilePath(filePath)}`;
  window.history.replaceState({ projectId, filePath }, '', url);
}

export function onPopState(callback: (state: RouteState) => void): () => void {
  const handler = () => {
    callback(getCurrentRoute());
  };
  
  window.addEventListener('popstate', handler);
  
  return () => {
    window.removeEventListener('popstate', handler);
  };
}