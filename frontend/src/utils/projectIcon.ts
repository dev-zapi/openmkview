import { api } from '../services/api';
import type { Project } from '../types';

export const FAVICON_PREFIX = 'favicon:';

export const isFaviconIcon = (icon: string | null | undefined): boolean => {
  return icon?.startsWith(FAVICON_PREFIX) ?? false;
};

export const getFaviconPath = (icon: string): string => {
  return icon.replace(FAVICON_PREFIX, '');
};

export const getProjectDisplayName = (project: Project): string => {
  return project.icon ? project.icon : project.name.charAt(0).toUpperCase();
};

export const getProjectIconContent = (project: Project) => {
  if (isFaviconIcon(project.icon)) {
    const faviconPath = getFaviconPath(project.icon!);
    return {
      type: 'image' as const,
      src: api.getFileRawUrl(faviconPath, project.id),
    };
  }

  return {
    type: 'text' as const,
    text: getProjectDisplayName(project),
  };
};

export const getProjectFaviconUrl = (faviconPath: string, projectId: number): string => {
  return api.getFileRawUrl(faviconPath, projectId);
};
