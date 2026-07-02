export type FileTypeCategory = 'markdown' | 'html' | 'other';

/**
 * Determines file type category based on file extension.
 * Used for outline state management by file type.
 * @param fileName - The file name to check
 * @returns The file type category
 */
export function getFileTypeCategory(fileName: string): FileTypeCategory {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
    return 'markdown';
  }
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return 'html';
  }
  return 'other';
}