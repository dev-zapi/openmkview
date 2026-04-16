import type { PathCandidate, RecentProject } from '../../../types/openProject';

export interface ListableItem {
  path: string;
  name: string;
  icon: string;
  relativePath?: string;
  type: 'recent' | 'quickAccess' | 'searchResult';
}

export const buildListItems = (
  query: string,
  recentProjects: RecentProject[],
  searchResults: PathCandidate[]
): ListableItem[] => {
  const items: ListableItem[] = [];

  if (!query) {
    return recentProjects.slice(0, 3).map((project) => ({
      path: project.path,
      name: project.name,
      icon: '📁',
      type: 'recent',
    }));
  }

  const lowerQuery = query.toLowerCase();
  const filteredRecent = recentProjects
    .filter((project) =>
      project.name.toLowerCase().includes(lowerQuery) ||
      project.path.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 3);

  for (const project of filteredRecent) {
    items.push({
      path: project.path,
      name: project.name,
      icon: '📁',
      type: 'recent',
    });
  }

  for (const result of searchResults) {
    items.push({
      path: result.path,
      name: result.name,
      icon: '📁',
      relativePath: result.relative_path,
      type: 'searchResult',
    });
  }

  return items;
};
