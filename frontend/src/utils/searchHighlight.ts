const SEARCH_MARK_ATTR = 'data-search-highlight';
const SEARCH_MATCH_CLASS = 'search-match';
const SEARCH_MATCH_CURRENT_CLASS = 'search-match-current';

const shouldSkipTextNode = (node: Text): boolean => {
  const parent = node.parentElement;
  if (!parent) return true;

  if (parent.closest(`mark[${SEARCH_MARK_ATTR}]`)) {
    return true;
  }

  return ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName);
};

export const clearSearchHighlights = (root: HTMLElement): void => {
  const marks = root.querySelectorAll(`mark[${SEARCH_MARK_ATTR}]`);

  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;

    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
};

export const highlightSearchMatches = (root: HTMLElement, query: string): HTMLElement[] => {
  clearSearchHighlights(root);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const textNode = node as Text;
      if (shouldSkipTextNode(textNode)) {
        return NodeFilter.FILTER_REJECT;
      }

      const value = textNode.nodeValue || '';
      if (!value.trim() || !value.toLocaleLowerCase().includes(normalizedQuery)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const matches: HTMLElement[] = [];

  textNodes.forEach((textNode) => {
    const value = textNode.nodeValue || '';
    const lowerValue = value.toLocaleLowerCase();
    let start = 0;
    let index = lowerValue.indexOf(normalizedQuery, start);

    if (index === -1) {
      return;
    }

    const fragment = document.createDocumentFragment();

    while (index !== -1) {
      if (index > start) {
        fragment.appendChild(document.createTextNode(value.slice(start, index)));
      }

      const mark = document.createElement('mark');
      mark.setAttribute(SEARCH_MARK_ATTR, 'true');
      mark.className = SEARCH_MATCH_CLASS;
      mark.textContent = value.slice(index, index + normalizedQuery.length);
      fragment.appendChild(mark);
      matches.push(mark);

      start = index + normalizedQuery.length;
      index = lowerValue.indexOf(normalizedQuery, start);
    }

    if (start < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(start)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  return matches;
};

export const setActiveSearchMatch = (
  matches: HTMLElement[],
  currentMatchIndex: number,
): void => {
  matches.forEach((match) => match.classList.remove(SEARCH_MATCH_CURRENT_CLASS));

  if (matches.length === 0 || currentMatchIndex < 1) {
    return;
  }

  const normalizedIndex = ((currentMatchIndex - 1) % matches.length + matches.length) % matches.length;
  const activeMatch = matches[normalizedIndex];

  activeMatch.classList.add(SEARCH_MATCH_CURRENT_CLASS);
  activeMatch.scrollIntoView?.({ block: 'center', inline: 'nearest' });
};
