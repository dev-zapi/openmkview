import plantumlEncoder from 'plantuml-encoder';
import type { DiagramRenderer } from './diagramService';
import { escapeHtml } from '../utils/html';

const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg/';

export class PlantUMLRenderer implements DiagramRenderer {
  encodePlantUML(code: string): string {
    return plantumlEncoder.encode(code);
  }

  async render(code: string, theme: 'light' | 'dark'): Promise<string> {
    if (!code || code.trim() === '') {
      return this.createErrorTemplate('PlantUML 渲染失败', '图表代码为空', code);
    }

    if (!code.includes('@startuml') || !code.includes('@enduml')) {
      return this.createErrorTemplate(
        'PlantUML 语法错误',
        '缺少 @startuml 或 @enduml 标记',
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
        return this.createErrorTemplate('PlantUML 语法错误', errorMessage, code);
      }

      return svg;
    } catch (error) {
      // Check for network/fetch errors
      if (error instanceof TypeError) {
        return this.createNetworkErrorTemplate();
      }
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return this.createErrorTemplate('PlantUML 渲染失败', errorMessage, code);
    }
  }

  private extractPlantUMLError(svg: string): string {
    const errorMatch = svg.match(/SyntaxError\?(.*)/);
    return errorMatch ? errorMatch[1] : '语法错误';
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
        <div class="error-title">PlantUML 服务器连接失败</div>
        <div class="error-message">请检查网络连接或稍后重试</div>
        <div class="error-hint">
          你可以访问 <a href="https://plantuml.com" target="_blank">plantuml.com</a> 确认服务可用性
        </div>
      </div>
    `;
  }
}