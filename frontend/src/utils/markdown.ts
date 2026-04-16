export const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .split('')
    .filter((c) => /[\p{L}\p{N}\s-]/u.test(c))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const resolveImagePath = (currentFilePath: string, imageHref: string): string => {
  const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
  const normalizedHref = imageHref.replace(/^\.\//, '');

  if (normalizedHref.startsWith('../')) {
    const parts = currentDir.split('/');
    const hrefParts = normalizedHref.split('/');

    for (const part of hrefParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  return currentDir ? `${currentDir}/${normalizedHref}` : normalizedHref;
};
