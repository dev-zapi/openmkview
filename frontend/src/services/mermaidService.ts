import mermaid from 'mermaid';
import type { DiagramRenderer } from './diagramService';
import { escapeHtml } from '../utils/html';

export class MermaidRenderer implements DiagramRenderer {
  private initialized = false;

  private initialize(theme: 'light' | 'dark'): void {
    if (!this.initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
        sequence: {
          useMaxWidth: true,
        },
      });
      this.initialized = true;
    }
  }

  async render(code: string, theme: 'light' | 'dark'): Promise<string> {
    if (!code || code.trim() === '') {
      return this.createErrorTemplate('Mermaid 渲染失败', '图表代码为空', code);
    }

    try {
      this.initialize(theme);
      
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, code);
      
      return svg;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return this.createErrorTemplate('Mermaid 渲染失败', errorMessage, code);
    }
  }

  private createErrorTemplate(title: string, message: string, code: string): string {
    return `
      <div class="diagram-error">
        <div class="error-title">${title}</div>
        <div class="error-message">${escapeHtml(message)}</div>
        <pre class="error-code">${escapeHtml(code)}</pre>
      </div>
    `;
  }
}