import plantumlEncoder from 'plantuml-encoder';
import type { DiagramRenderer } from './diagramService';
import { escapeHtml } from '../utils/html';

const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg/';

export class PlantUMLRenderer implements DiagramRenderer {
  encodePlantUML(code: string): string {
    return plantumlEncoder.encode(code);
  }

  async render(code: string, _theme: 'light' | 'dark'): Promise<string> {
    if (!code || code.trim() === '') {
      return this.createErrorTemplate('PlantUML render failed', 'The diagram code is empty', code);
    }

    if (!code.includes('@startuml') || !code.includes('@enduml')) {
      return this.createErrorTemplate(
        'PlantUML syntax error',
        'Missing @startuml or @enduml marker',
        code
      );
    }

    try {
      const encoded = this.encodePlantUML(code);
      const url = `${PLANTUML_SERVER}${encoded}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return this.createNetworkErrorTemplate();
      }

      const svg = await response.text();

      if (svg.includes('SyntaxError?')) {
        const errorMessage = this.extractPlantUMLError(svg);
        return this.createErrorTemplate('PlantUML syntax error', errorMessage, code);
      }

      return svg;
    } catch (error) {
      // Check for network/fetch errors
      if (error instanceof TypeError) {
        return this.createNetworkErrorTemplate();
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorTemplate('PlantUML render failed', errorMessage, code);
    }
  }

  private extractPlantUMLError(svg: string): string {
    const errorMatch = svg.match(/SyntaxError\?(.*)/);
    return errorMatch ? errorMatch[1] : 'Syntax error';
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

  private createNetworkErrorTemplate(): string {
    return `
      <div class="diagram-error">
        <div class="error-title">Could not reach the PlantUML server</div>
        <div class="error-message">Check the network connection and try again</div>
        <div class="error-hint">
          Visit <a href="https://plantuml.com" target="_blank">plantuml.com</a> to check service availability
        </div>
      </div>
    `;
  }
}