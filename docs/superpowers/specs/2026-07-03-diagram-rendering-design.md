# Mermaid & PlantUML 图表渲染功能设计文档

## 功能概述

为 OpenMKView 添加 Mermaid 和 PlantUML 图表语言的客户端渲染支持，允许用户在 Markdown 文件中嵌入文字图形并实时预览。

### 支持的图表类型
- **Mermaid**: 流程图、时序图、甘特图、类图、状态图等
- **PlantUML**: 类图、序列图、用例图、活动图、组件图等

### 用户需求
1. 支持 Mermaid 和 PlantUML 两种主流图表语言
2. 使用客户端渲染（Mermaid 本地渲染，PlantUML 通过官方服务器）
3. 使用标准 Markdown 代码块语法（```mermaid 和 ```plantuml）
4. 懒加载渲染（仅当图表进入可视区域时渲染）
5. 渲染失败时显示详细错误信息
6. 图表主题跟随 Markdown 主题（light/dark）
7. 支持基础交互功能（点击、链接跳转）

---

## 技术方案

### 方案选择：独立渲染库

**实现方式：**
- **Mermaid**: 使用 `mermaid.js` 库（纯 JavaScript，完全客户端渲染）
- **PlantUML**: 使用 `plantuml-encoder` 编码后通过 PlantUML 官方服务器渲染为 SVG

**优势：**
- Mermaid 无需网络依赖，渲染速度快
- PlantUML 功能强大，官方服务器稳定免费
- 实现复杂度适中，易于维护
- 与现有 MarkdownView 架构无缝集成

**依赖库：**
- `mermaid`: `^11.0.0` - Mermaid 客户端渲染库
- `plantuml-encoder`: `^1.4.0` - PlantUML URL 编码器

---

## 架构设计

### 前端架构
```
MarkdownView.tsx
  ├── 检测图表代码块
  ├── 渲染普通 Markdown (现有逻辑)
  └── 渲染图表代码块 (新增)
       ├── Mermaid 渲染器
       └── PlantUML 渲染器

新增服务层：
services/
  ├── diagramService.ts (统一图表渲染接口)
  ├── mermaidService.ts (Mermaid 渲染逻辑)
  └── plantumlService.ts (PlantUML 渲染逻辑)
```

### 新增组件
- `DiagramPlaceholder.tsx`: 图表占位符组件，负责懒加载触发和渲染

### 渲染流程
1. **Markdown 解析阶段**: 识别 `mermaid` 和 `plantuml` 代码块
2. **占位符生成阶段**: 生成 `<div class="diagram-placeholder" data-type="mermaid">...</div>`
3. **懒加载触发阶段**: 使用 Intersection Observer 检测可视区域
4. **图表渲染阶段**: 根据类型调用相应渲染器
5. **内容替换阶段**: 将占位符替换为渲染后的 SVG 或错误信息
6. **主题切换**: 重新渲染所有图表以应用新主题

---

## 组件设计

### DiagramPlaceholder.tsx

**接口定义：**
```typescript
interface DiagramPlaceholderProps {
  type: 'mermaid' | 'plantuml';
  code: string;
  theme: 'light' | 'dark';
  onRendered?: (svg: string) => void;
}
```

**功能：**
- 图表占位符组件，负责懒加载触发和渲染
- 使用 Intersection Observer 检测是否进入可视区域
- 渲染成功后替换占位符内容为 SVG
- 渲染失败时显示错误信息

---

### diagramService.ts

**接口定义：**
```typescript
export interface DiagramRenderer {
  render(code: string, theme: 'light' | 'dark'): Promise<string>;
  getSupportedLanguages(): string[];
}

export async function renderDiagram(
  type: 'mermaid' | 'plantuml',
  code: string,
  theme: 'light' | 'dark'
): Promise<string>;
```

**功能：**
- 统一图表渲染服务接口
- 管理 Mermaid 和 PlantUML 渲染器实例
- 提供统一的错误处理机制

---

### mermaidService.ts

**接口定义：**
```typescript
export class MermaidRenderer implements DiagramRenderer {
  async render(code: string, theme: 'light' | 'dark'): Promise<string>;
  initialize(config: MermaidConfig): void;
}
```

**功能：**
- Mermaid 渲染实现
- 初始化 Mermaid 配置（主题、安全性等）
- 处理渲染错误并返回友好错误信息
- 支持 light/dark 主题切换

**配置示例：**
```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: theme === 'dark' ? 'dark' : 'default',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: true },
  sequence: { useMaxWidth: true }
});
```

---

### plantumlService.ts

**接口定义：**
```typescript
export class PlantUMLRenderer implements DiagramRenderer {
  async render(code: string, theme: 'light' | 'dark'): Promise<string>;
  encodePlantUML(code: string): string;
}
```

**功能：**
- PlantUML 渲染实现
- 使用 plantuml-encoder 编码图表代码
- 调用 PlantUML 官方服务器获取 SVG
- 处理网络错误和语法错误

**PlantUML 服务器 URL：**
```typescript
const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml/svg/';
const encodedCode = plantumlEncoder.encode(code);
const url = `${PLANTUML_SERVER}${encodedCode}`;
```

---

### MarkdownView.tsx 修改

**修改点：**
1. 在 `marked.use()` 的 `code` renderer 中新增图表检测逻辑
2. 检测 `lang === 'mermaid' || lang === 'plantuml'`
3. 生成占位符 HTML 而不是普通代码块
4. 渲染完成后批量处理占位符组件
5. 添加 Intersection Observer 监听占位符元素

**代码修改示例：**
```typescript
marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid' || lang === 'plantuml') {
        const encodedCode = base64Encode(text);
        return `
          <div class="diagram-placeholder" 
               data-type="${lang}" 
               data-code="${encodedCode}"
               data-theme="${theme}">
            <div class="diagram-loading">Loading...</div>
          </div>
        `;
      }
      // 现有代码高亮逻辑...
    }
  }
});
```

---

## 数据流

### 图表渲染数据流

```
用户输入 Markdown 内容
    ↓
MarkdownView.renderMarkdown()
    ↓
marked.parse() 解析 Markdown
    ↓
检测 code block lang === 'mermaid' || 'plantuml'
    ↓
生成占位符 HTML:
<div class="diagram-placeholder" 
     data-type="mermaid" 
     data-code="encoded-code"
     data-theme="dark">
  <div class="diagram-loading">Loading...</div>
</div>
    ↓
DOMPurify.sanitize() 清理 HTML
    ↓
setRenderedHtml() 更新 DOM
    ↓
Intersection Observer 监听占位符
    ↓
占位符进入可视区域（提前 100px）
    ↓
diagramService.renderDiagram(type, code, theme)
    ↓
MermaidRenderer / PlantUMLRenderer
    ↓
返回 SVG 或错误信息
    ↓
替换占位符内容:
成功 → <div class="diagram-content">{SVG}</div>
失败 → <div class="diagram-error">{error message}</div>
    ↓
触发 onRendered callback (可选)
```

---

### 主题切换数据流

```
用户切换主题 (light ↔ dark)
    ↓
MarkdownView.props.theme 变化
    ↓
createEffect 触发重新渲染
    ↓
renderMarkdown() 再次执行
    ↓
重新生成所有图表占位符（新主题）
    ↓
Intersection Observer 再次触发渲染
    ↓
图表以新主题重新渲染
```

---

### 懒加载触发条件

- 占位符元素进入可视区域上方 100px（提前渲染）
- 或者占位符已在可视区域内（首次渲染时）
- 渲染完成后移除 Observer 监听，避免重复渲染

**Intersection Observer 配置：**
```typescript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        renderDiagramPlaceholder(entry.target);
        observer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: '100px 0px' } // 提前 100px 触发
);
```

---

## 错误处理

### Mermaid 渲染错误

```typescript
try {
  const svg = await mermaid.render(code, theme);
  return svg;
} catch (error) {
  return `
    <div class="diagram-error">
      <div class="error-title">Mermaid 渲染失败</div>
      <div class="error-message">${error.message}</div>
      <pre class="error-code">${escapeHtml(code)}</pre>
    </div>
  `;
}
```

---

### PlantUML 渲染错误

**1. 编码错误（极少发生）：**
```typescript
try {
  const encoded = plantumlEncoder.encode(code);
} catch (error) {
  return errorTemplate('PlantUML 编码失败', error.message, code);
}
```

**2. 网络请求错误：**
```typescript
try {
  const response = await fetch(plantumlUrl);
  if (!response.ok) throw new NetworkError('PlantUML 服务器连接失败');
  const svg = await response.text();
} catch (error) {
  if (error instanceof NetworkError) {
    return `
      <div class="diagram-error">
        <div class="error-title">PlantUML 服务器连接失败</div>
        <div class="error-message">请检查网络连接或稍后重试</div>
        <div class="error-hint">
          你可以访问 <a href="https://plantuml.com">plantuml.com</a> 确认服务可用性
        </div>
      </div>
    `;
  }
}
```

**3. PlantUML 语法错误：**
```typescript
if (svg.includes('SyntaxError?')) {
  const errorMessage = extractPlantUMLError(svg);
  return errorTemplate('PlantUML 语法错误', errorMessage, code);
}
```

---

### 错误显示样式

- 使用统一的错误模板组件
- 错误信息使用红色背景 + 白色文字
- 显示原始代码供用户检查和调试
- PlantUML 网络错误提供重试提示和服务状态链接
- 错误信息通过 DOMPurify 清理（防止 XSS）

---

### 错误边界

- 单个图表渲染失败不影响其他图表渲染
- 不影响普通 Markdown 内容渲染
- 错误信息包裹在 `<div class="diagram-error">` 中，样式统一
- 所有错误信息通过 `escapeHtml()` 处理，避免 XSS

---

## 测试策略

### 单元测试

#### diagramService.test.ts
- 测试 `renderDiagram()` 正确识别图表类型
- 测试 Mermaid 和 PlantUML 渲染器调用
- 测试错误处理和返回格式
- 测试空代码和无效输入处理

#### mermaidService.test.ts
- 测试简单流程图渲染成功
- 测试复杂时序图渲染成功
- 测试语法错误处理
- 测试主题切换（light/dark）
- 测试空代码和无效输入
- 测试 Mermaid 初始化配置

#### plantumlService.test.ts
- 测试 `plantumlEncoder.encode()` 正确编码
- 测试 PlantUML 服务器 URL 生成
- 测试网络错误模拟（使用 mock fetch）
- 测试 PlantUML 语法错误解析
- 测试主题参数传递
- 测试服务器返回错误页面的处理

#### DiagramPlaceholder.test.tsx
- 测试占位符初始状态渲染
- 测试 Intersection Observer 触发时机
- 测试成功渲染后内容替换
- 测试错误渲染后显示错误信息
- 测试主题切换触发重新渲染
- 测试 `onRendered` callback 触发

---

### 集成测试

#### MarkdownView 图表渲染测试
- 测试 Markdown 中包含单个 Mermaid 图表
- 测试 Markdown 中包含多个不同类型图表
- 测试图表与普通代码块混合
- 测试懒加载触发时机（滚动到图表位置）
- 测试主题切换后图表重新渲染
- 测试图表语法错误的显示

---

### E2E 测试

#### app.spec.ts 新增场景
- 用户打开包含 Mermaid 图表的 Markdown 文件
- 滚动到图表位置，验证图表正确渲染为 SVG
- 切换主题，验证图表颜色变化
- 编辑 Markdown 修改图表代码，验证实时更新
- 测试图表语法错误的显示和提示信息
- 测试 PlantUML 图表渲染（验证网络请求）

---

### 测试数据准备

**Mermaid 示例：**
- 流程图：简单流程、复杂分支流程
- 时序图：简单交互、复杂时序
- 甘特图：项目进度示例
- 类图：简单类关系
- 错误语法示例：缺少关键字、格式错误

**PlantUML 示例：**
- 类图：UML 类关系图
- 序列图：对象交互时序图
- 用例图：系统功能用例
- 活动图：业务流程活动
- 错误语法示例：缺少 @startuml/@enduml、语法错误

---

## 实现要点

### 关键实现点

1. **Intersection Observer 懒加载**
   - 使用 `rootMargin: '100px 0px'` 提前触发渲染
   - 渲染完成后立即 `unobserve()` 避免重复渲染
   - 处理占位符已销毁的情况

2. **主题切换处理**
   - Mermaid: 使用 `mermaid.initialize({ theme: 'dark' | 'default' })`
   - PlantUML: 通过 URL 参数传递主题（如果支持）
   - 重新渲染时需要清除旧的 Mermaid 实例

3. **PlantUML 编码**
   - 使用 `plantuml-encoder` 的 `encode()` 方法
   - PlantUML 服务器 URL 格式：`https://www.plantuml.com/plantuml/svg/{encoded}`
   - 处理 Deflate + Base64 编码失败的情况

4. **DOMPurify 安全性**
   - 允许 SVG 标签和属性（`ADD_TAGS: ['svg', 'path', 'g', 'rect', 'text']`）
   - 允许图表交互相关属性（`ADD_ATTR: ['onclick', 'href', 'target']`）
   - 清理错误信息中的用户输入代码

5. **性能优化**
   - 懒加载减少初始渲染负担
   - Intersection Observer 避免不必要的渲染
   - 使用缓存避免重复渲染相同图表（可选）

---

### 潜在问题与解决方案

**问题 1：PlantUML 服务器不可用**
- 解决方案：显示友好的网络错误提示，提供服务状态链接
- 未来优化：考虑自建 PlantUML 服务器或使用本地渲染

**问题 2：多个图表同时渲染性能**
- 解决方案：懒加载已经解决这个问题，只有进入可视区域才渲染
- 未来优化：如果图表数量很多，可以考虑渲染队列和优先级

**问题 3：Mermaid 初始化冲突**
- 解决方案：确保每次渲染前正确初始化 Mermaid 配置
- 使用 `mermaid.initialize()` 在每次主题切换时重新配置

**问题 4：图表交互事件丢失**
- 解决方案：保留 SVG 中的 onclick 等交互属性
- 使用 `securityLevel: 'loose'` 允许 Mermaid 交互

---

## 未来扩展

### 可选增强功能（不在当前范围）

1. **增强交互功能**
   - 图表缩放、平移控制
   - 下载图表为 PNG/SVG 文件
   - 图表节点点击高亮

2. **自建 PlantUML 服务器**
   - 避免外部服务依赖
   - 提供更快的渲染速度
   - 支持私有网络环境

3. **更多图表类型支持**
   - Graphviz/DOT 网络图
   - Chart.js 数据图表
   - 其他文字图形语言

4. **Web Worker 渲染**
   - 将渲染逻辑移至 Web Worker
   - 避免阻塞主线程
   - 提供更好的用户体验

---

## 总结

本设计文档详细描述了 Mermaid 和 PlantUML 图表渲染功能的实现方案，包括：
- 使用独立渲染库的架构选择
- 懒加载渲染机制
- 主题跟随和错误处理
- 完整的测试策略

实现完成后，用户可以在 OpenMKView 中无缝使用 Mermaid 和 PlantUML 图表语言，享受实时预览和主题适配的体验。