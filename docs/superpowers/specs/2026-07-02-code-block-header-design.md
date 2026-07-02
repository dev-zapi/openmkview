# Code Block Header Design

## Overview

为 Markdown 渲染的代码块添加语言标签和复制按钮功能，提升代码阅读和交互体验。

## Requirements

### 功能需求

1. **语言标签显示**：在代码块右上角显示代码语言类型（如 "rust", "javascript"）
2. **复制按钮**：提供一键复制代码功能
3. **主题适配**：支持浅色和深色主题，样式保持一致
4. **响应式设计**：标签和按钮尺寸适配不同屏幕

### 非功能需求

1. **性能**：渲染后处理不应影响页面性能
2. **兼容性**：支持主流浏览器剪贴板 API
3. **可维护性**：组件职责清晰，易于扩展

## Design

### Architecture

采用 CSS + DOM 后处理方案，在 Markdown 渲染完成后动态添加代码块头部。

**新增组件：**
- `CodeBlockHeader.tsx` - 代码块头部组件，包含语言标签和复制按钮

**修改文件：**
- `MarkdownView.tsx` - 渲染后处理逻辑
- `global.css` - 样式定义

### Component Design

#### CodeBlockHeader Component

**职责：**
- 渲染语言标签和复制按钮
- 处理复制逻辑
- 主题样式切换

**Props：**
```typescript
interface CodeBlockHeaderProps {
  lang: string;          // 代码语言类型
  theme: 'light' | 'dark'; // 当前主题
  codeRef: HTMLElement;   // 代码块引用，用于复制
}
```

**实现：**
```tsx
const CodeBlockHeader: Component<CodeBlockHeaderProps> = (props) => {
  const [copyStatus, setCopyStatus] = createSignal<'idle' | 'copied' | 'failed'>('idle');
  
  const handleCopy = async () => {
    try {
      const code = props.codeRef.textContent || '';
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };
  
  return (
    <div class={`code-block-header ${props.theme}`}>
      <span class="code-lang-tag">{props.lang}</span>
      <button class="copy-button" onClick={handleCopy}>
        {copyStatus() === 'copied' ? '已复制' : 
         copyStatus() === 'failed' ? '复制失败' : '📋 复制'}
      </button>
    </div>
  );
};
```

### Data Flow

1. **Markdown 解析**：Marked 解析生成带有 `data-lang` 属性的 `<pre>` 元素
2. **代码高亮**：Shiki 高亮后替换原始 HTML
3. **DOM 处理**：渲染完成后，遍历所有 `<pre>` 元素
4. **头部添加**：为每个 `<pre>` 元素创建并插入头部容器

### Implementation Logic

#### MarkdownView Rendering Flow

在 `MarkdownView.tsx` 的 `renderMarkdown` 函数中，`setRenderedHtml(html)` 后添加处理逻辑：

```typescript
// 在 setTimeout 中处理 DOM（确保 DOM 已更新）
setTimeout(() => {
  if (!containerRef) return;
  
  const preElements = containerRef.querySelectorAll('pre');
  preElements.forEach((pre) => {
    // 防止重复添加
    if (pre.querySelector('.code-block-header')) return;
    
    // 获取语言类型
    const lang = pre.getAttribute('data-lang') || 'text';
    
    // 创建头部容器
    const header = document.createElement('div');
    header.className = `code-block-header ${props.theme}`;
    
    // 创建语言标签
    const langTag = document.createElement('span');
    langTag.className = 'code-lang-tag';
    langTag.textContent = lang;
    
    // 创建复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-button';
    copyBtn.textContent = '📋 复制';
    copyBtn.onclick = async () => {
      const code = pre.querySelector('code')?.textContent || '';
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(code);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        copyBtn.textContent = '已复制';
        setTimeout(() => copyBtn.textContent = '📋 复制', 2000);
      } catch {
        copyBtn.textContent = '复制失败';
        setTimeout(() => copyBtn.textContent = '📋 复制', 2000);
      }
    };
    
    header.appendChild(langTag);
    header.appendChild(copyBtn);
    pre.appendChild(header);
    
    // 设置 pre 为相对定位
    pre.style.position = 'relative';
  });
  
  // 提取 headings（已有逻辑）
  if (props.onHeadingsExtracted) {
    const headings = extractHeadingsFromHtml();
    props.onHeadingsExtracted?.(headings);
  }
}, 0);
```

### Styling

#### Light Theme

```css
.code-block-header.light {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.code-lang-tag {
  font-size: 12px;
  color: #24292f;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 6px;
  border-radius: 3px;
}

.copy-button {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #d0d7de;
  color: #24292f;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}

.copy-button:hover {
  background: rgba(255, 255, 255, 1);
}
```

#### Dark Theme

```css
.code-block-header.dark {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.code-block-header.dark .code-lang-tag {
  color: #c9d1d9;
  background: rgba(110, 118, 129, 0.4);
}

.code-block-header.dark .copy-button {
  background: rgba(110, 118, 129, 0.4);
  border: 1px solid #30363d;
  color: #c9d1d9;
}

.code-block-header.dark .copy-button:hover {
  background: rgba(110, 118, 129, 0.6);
}
```

### Error Handling

1. **剪贴板 API 兼容性**：
   - 优先使用 `navigator.clipboard.writeText()`
   - Fallback 到 `document.execCommand('copy')`
   - 失败时显示错误提示

2. **语言标签默认值**：
   - `data-lang` 为空时显示 "text"

3. **DOM 安全**：
   - 检查 `<pre>` 元素存在性
   - 防止重复添加头部

4. **复制状态反馈**：
   - 成功：按钮文字临时变为 "已复制"（2秒后恢复）
   - 失败：按钮文字临时变为 "复制失败"（2秒后恢复）

### Testing Strategy

#### Unit Tests

**CodeBlockHeader Component：**
- 渲染测试：验证语言标签和复制按钮正确显示
- 复制功能测试：模拟点击，验证剪贴板写入
- 主题切换测试：验证浅色/深色样式类名正确

#### Integration Tests

**MarkdownView：**
- 代码块头部添加测试：验证渲染后所有代码块包含头部
- 多语言测试：验证不同语言标签正确显示
- 主题切换测试：验证深色模式下样式正确

#### Manual Tests

- 不同代码语言（rust, javascript, python, etc.）
- 深色/浅色主题切换
- 复制按钮功能验证
- 无语言标记的代码块（应显示 "text"）

## Implementation Plan

### Phase 1: Core Implementation

1. 添加 CSS 样式到 `global.css`
2. 在 `MarkdownView.tsx` 中添加 DOM 处理逻辑
3. 实现复制按钮功能

### Phase 2: Refinement

1. 优化主题切换逻辑
2. 添加复制状态反馈动画
3. 性能优化（避免重复处理）

### Phase 3: Testing

1. 编写单元测试
2. 编写集成测试
3. 手动测试验证

## Success Criteria

1. 所有代码块显示语言标签和复制按钮
2. 复制功能在主流浏览器正常工作
3. 浅色/深色主题样式正确
4. 不影响现有 Markdown 渲染性能
5. 代码符合项目规范（SolidJS + TypeScript）

## Notes

- 语言名称显示为小写（如 "rust", "javascript"）
- 复制按钮使用 emoji 图标 "📋" 保持简洁
- 头部定位使用 `position: absolute`，父元素 `<pre>` 使用 `position: relative`
- 遵循项目现有的组件结构和样式规范