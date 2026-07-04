import { Component, createEffect, onCleanup, createSignal } from 'solid-js';
import { renderDiagram } from '../services/diagramService';

interface DiagramPlaceholderProps {
  type: 'mermaid' | 'plantuml';
  code: string;
  theme: 'light' | 'dark';
  onRendered?: (svg: string) => void;
}

const DiagramPlaceholder: Component<DiagramPlaceholderProps> = (props) => {
  let elementRef: HTMLDivElement | undefined;
  const [renderedContent, setRenderedContent] = createSignal<string>('');
  const [isRendered, setIsRendered] = createSignal(false);
  const [isInView, setIsInView] = createSignal(false);

  let observer: IntersectionObserver | undefined;

  const setupObserver = () => {
    if (!elementRef) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '100px 0px' }
    );

    observer.observe(elementRef);
  };

  createEffect(() => {
    if (isInView() && !isRendered()) {
      renderDiagram(props.type, props.code, props.theme)
        .then((svg) => {
          setRenderedContent(svg);
          setIsRendered(true);
          props.onRendered?.(svg);
        })
        .catch((error) => {
          setRenderedContent(`<div class="diagram-error">${error.message}</div>`);
          setIsRendered(true);
        });
    }
  });

  createEffect(() => {
    setupObserver();
  });

  onCleanup(() => {
    observer?.disconnect();
  });

  return (
    <div
      ref={elementRef}
      class="diagram-placeholder"
      data-type={props.type}
      data-theme={props.theme}
    >
      {isRendered() ? (
        <div class="diagram-content" innerHTML={renderedContent()} />
      ) : (
        <div class="diagram-loading">Loading...</div>
      )}
    </div>
  );
};

export default DiagramPlaceholder;