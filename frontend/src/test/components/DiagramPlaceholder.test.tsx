import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import DiagramPlaceholder from '../../components/DiagramPlaceholder';

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver as any;

// Mock diagramService
vi.mock('../../services/diagramService', () => ({
  renderDiagram: vi.fn().mockResolvedValue('<svg>test</svg>'),
}));

describe('DiagramPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading placeholder initially', () => {
    const { container } = render(() => (
      <DiagramPlaceholder type="mermaid" code="graph TD\nA-->B" theme="light" />
    ));
    
    expect(container.querySelector('.diagram-placeholder')).toBeTruthy();
    expect(container.querySelector('.diagram-loading')).toBeTruthy();
  });

  it('should render with correct data attributes', () => {
    const { container } = render(() => (
      <DiagramPlaceholder type="plantuml" code="@startuml\nA -> B\n@enduml" theme="dark" />
    ));
    
    const placeholder = container.querySelector('.diagram-placeholder');
    expect(placeholder?.getAttribute('data-type')).toBe('plantuml');
    expect(placeholder?.getAttribute('data-theme')).toBe('dark');
  });
});