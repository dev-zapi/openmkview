export interface DiagramRenderer {
  render(code: string, theme: 'light' | 'dark'): Promise<string>;
}

export const SUPPORTED_DIAGRAM_TYPES = ['mermaid', 'plantuml'] as const;
export type DiagramType = typeof SUPPORTED_DIAGRAM_TYPES[number];

export function isDiagramLanguage(lang: string): boolean {
  return SUPPORTED_DIAGRAM_TYPES.includes(lang as DiagramType);
}

export async function renderDiagram(
  type: DiagramType,
  code: string,
  theme: 'light' | 'dark'
): Promise<string> {
  if (!isDiagramLanguage(type)) {
    throw new Error(`Unsupported diagram type: ${type}`);
  }
  
  return '';
}