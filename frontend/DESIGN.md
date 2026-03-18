# Markdown 渲染区域头部/工具栏重设计文档

## 📋 当前问题分析

### 现有实现概览
当前 `main-header` 结构：
```
┌─────────────────────────────────────────────────────────────┐
│ [Preview] [Diff] [Source]          file.md  [📋]            │
└─────────────────────────────────────────────────────────────┘
```

### 现存问题
1. **视觉层次弱** - 文件名太小，没有文件路径上下文
2. **功能单一** - 仅提供 Tab 切换和大纲按钮
3. **空间利用率低** - 中间大片空白区域浪费
4. **缺乏文档操作** - 无复制、导出、搜索等常用功能
5. **Tab 设计简陋** - 无图标，视觉反馈弱
6. **面包屑缺失** - 无法快速了解文件在项目中的位置

---

## 🎯 新设计方案

### 设计原则
- **信息密度适中** - 提供更多有用信息但不拥挤
- **操作触手可及** - 常用功能一键可达
- **视觉层次分明** - 通过间距、字体大小、颜色区分层次
- **现代简洁风格** - 符合 VS Code / Notion 等现代工具审美

---

## 📐 布局结构

### 新版头部结构（三层设计）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🔙 Project Name  /  docs  /  guide  /  README.md              ⭐ [⋯]       │  ← 面包屑栏
├──────────────────────────────────────────────────────────────────────────────┤
│  📄 README.md                              [Preview] [Source] [History]      │  ← 标题+Tab栏
│  Last modified: 2 hours ago • 12.5 KB                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  [🔍 Search] [📋 Outline] [📋 Copy] [⬇️ Export] [⚙️ View]    🔲 Fullscreen  │  ← 工具栏
└──────────────────────────────────────────────────────────────────────────────┘
```

### 详细布局说明

#### Layer 1: 面包屑导航栏 (Breadcrumb Bar)
**高度**: 36px  
**背景**: `var(--color-bg-subtle)` (略深于主背景)  
**边框**: 底部 1px `var(--color-border)`

| 元素 | 位置 | 说明 |
|------|------|------|
| 返回按钮 | 左侧 | 返回项目根目录 |
| 项目名 | 左侧 | 当前项目名称，可点击跳转 |
| 路径分隔 | 中间 | `/` 分隔符，灰色 |
| 文件路径 | 中间 | 可点击的文件夹路径 |
| 收藏按钮 | 右侧 | ⭐ 收藏当前文件 |
| 更多菜单 | 右侧 | ⋯ 更多操作菜单 |

#### Layer 2: 文档标题栏 (Document Title Bar)
**高度**: 52px  
**背景**: `var(--color-bg)` (主背景色)

| 元素 | 位置 | 说明 |
|------|------|------|
| 文件图标 | 左侧 | 根据扩展名显示不同图标 (.md, .mdx 等) |
| 文件名 | 左侧 | 大字体 (18px)，粗体 |
| 元信息 | 左下 | 修改时间、文件大小 |
| Tab 组 | 右侧 | Preview / Source / History / Diff |

#### Layer 3: 功能工具栏 (Action Toolbar)
**高度**: 44px  
**背景**: `var(--color-bg)` (主背景色)  
**边框**: 底部 1px `var(--color-border)`

| 元素 | 位置 | 说明 |
|------|------|------|
| 搜索 | 左侧 | 🔍 文档内搜索 |
| 大纲 | 左侧 | 📋 展开/收起大纲 |
| 分隔线 | 中间 | 竖线分隔 |
| 复制 | 中间 | 📋 复制全文 |
| 导出 | 中间 | ⬇️ 导出为 PDF/HTML |
| 视图设置 | 中间 | ⚙️ 字体、宽度设置 |
| 全屏 | 右侧 | 🔲 全屏模式 |

---

## 🎨 样式建议

### 色彩方案
```css
/* 头部背景层级 */
--header-bg-primary: var(--color-bg);           /* 主背景 */
--header-bg-secondary: var(--color-bg-subtle);  /* 次要背景（面包屑栏） */

/* 文字层级 */
--header-text-primary: var(--color-text-h);     /* 文件名、按钮文字 */
--header-text-secondary: var(--color-text);     /* 路径、元信息 */
--header-text-muted: var(--color-text);         /* 禁用状态（透明度 0.5） */

/* 交互状态 */
--header-hover-bg: var(--color-code-bg);        /* 悬停背景 */
--header-active-bg: var(--color-accent-bg);     /* 激活背景 */
--header-border: var(--color-border);           /* 边框 */
```

### 字体规范
```css
/* 文件名 */
.header-filename {
  font-size: 18px;
  font-weight: 600;
  color: var(--header-text-primary);
}

/* 面包屑路径 */
.breadcrumb-item {
  font-size: 13px;
  color: var(--header-text-secondary);
}

.breadcrumb-item.active {
  color: var(--header-text-primary);
  font-weight: 500;
}

/* 元信息 */
.header-meta {
  font-size: 12px;
  color: var(--header-text-secondary);
  opacity: 0.8;
}

/* Tab 文字 */
.tab-item {
  font-size: 13px;
  font-weight: 500;
}
```

### 间距规范
```css
/* 容器内边距 */
.header-container {
  padding: 0 20px;
}

/* 元素间距 */
.header-group {
  gap: 8px;
}

/* 按钮内边距 */
.toolbar-btn {
  padding: 6px 12px;
  gap: 6px;
}
```

### 圆角与阴影
```css
/* 按钮圆角 */
.toolbar-btn, .tab-item {
  border-radius: 6px;
}

/* 下拉菜单阴影 */
.dropdown-menu {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}
```

---

## ⚡ 交互逻辑

### 1. 面包屑导航
```typescript
interface BreadcrumbProps {
  projectName: string;
  path: string;           // "docs/guide/README.md"
  onNavigate: (path: string) => void;
}

// 交互行为
- 点击项目名: 跳转到项目根目录
- 点击文件夹: 在文件树中展开该文件夹
- 点击文件名: 无操作（当前位置）
- 路径过长: 中间折叠显示 "..."
```

### 2. Tab 切换
```typescript
type ViewTab = 'preview' | 'source' | 'history' | 'diff';

// 交互行为
- 当前 Tab: 下划线指示器 + 高亮文字
- 悬停: 背景色变化
- 切换: 平滑过渡动画 (150ms)
- Diff Tab: 仅在 diffStore.isDiffMode 时高亮显示
```

### 3. 工具栏按钮

#### 搜索按钮
```typescript
// 点击展开搜索框
- 展开内联搜索输入框
- 支持 ⌘+F 快捷键触发
- ESC 关闭搜索
```

#### 大纲按钮
```typescript
// 切换大纲面板
- 点击: toggle outlineOpen
- 激活状态: 背景色高亮
- 徽章: 显示标题数量（如 H3 有 12 个标题）
```

#### 复制按钮
```typescript
// 复制全文到剪贴板
- 点击: 复制 currentFile.content
- 成功: Toast 提示 "已复制到剪贴板"
- 失败: Toast 提示 "复制失败"
```

#### 导出按钮
```typescript
// 下拉菜单
- PDF: 调用浏览器打印为 PDF
- HTML: 下载为 HTML 文件
- Markdown: 下载原始 .md 文件
```

#### 视图设置
```typescript
// 下拉菜单
- 字体大小: 小/中/大
- 行高: 紧凑/舒适/宽松
- 页面宽度: 自适应/固定 800px/固定 900px
```

#### 全屏按钮
```typescript
// 切换全屏模式
- 点击: toggle fullscreen
- 图标变化: 🔲 / 🔳
- 退出: ESC 或再次点击
```

---

## 📝 代码实现思路

### 组件拆分

```typescript
// 新组件结构
src/components/
├── markdown-header/
│   ├── MarkdownHeader.tsx       # 主组件（组合所有子组件）
│   ├── BreadcrumbBar.tsx        # 面包屑栏
│   ├── DocumentTitleBar.tsx     # 文档标题栏
│   ├── ActionToolbar.tsx        # 功能工具栏
│   ├── ViewTabs.tsx             # Tab 切换器
│   ├── SearchBox.tsx            # 内联搜索框
│   └── DropdownMenu.tsx         # 通用下拉菜单
```

### 主组件接口

```typescript
// MarkdownHeader.tsx
interface MarkdownHeaderProps {
  // 文件信息
  fileName: string;
  filePath: string;
  projectName: string;
  lastModified?: Date;
  fileSize?: number;
  
  // 当前状态
  activeTab: 'preview' | 'source' | 'history' | 'diff';
  isOutlineOpen: boolean;
  isFullscreen: boolean;
  
  // 事件回调
  onTabChange: (tab: string) => void;
  onOutlineToggle: () => void;
  onFullscreenToggle: () => void;
  onSearch: (query: string) => void;
  onCopy: () => void;
  onExport: (format: 'pdf' | 'html' | 'md') => void;
  onNavigate: (path: string) => void;
}
```

### 与现有代码集成

```typescript
// App.tsx 中的使用方式
<main class="main">
  <MarkdownHeader
    fileName={currentFile()?.fileName || ''}
    filePath={currentFile()?.path || ''}
    projectName={activeProject()?.name || ''}
    activeTab={activeTab()}
    isOutlineOpen={outlineOpen()}
    onTabChange={setActiveTab}
    onOutlineToggle={() => setOutlineOpen(!outlineOpen())}
    // ... 其他回调
  />
  
  <div class="main-content">
    {/* 现有内容区域 */}
  </div>
</main>
```

### 状态管理

```typescript
// 可复用现有状态，无需新增 store
// App.tsx 中已有：
- activeTab: Signal<'preview' | 'source' | 'diff'>
- outlineOpen: Signal<boolean>
- settings: Signal<Settings>

// 需要新增的状态：
- isFullscreen: Signal<boolean>
- searchQuery: Signal<string>
- searchResults: Signal<SearchResult[]>
```

### 响应式适配

```css
/* 移动端适配 */
@media (max-width: 768px) {
  .breadcrumb-bar {
    display: none;  /* 小屏隐藏面包屑 */
  }
  
  .action-toolbar {
    overflow-x: auto;  /* 横向滚动 */
    scrollbar-width: none;
  }
  
  .header-filename {
    font-size: 16px;
  }
}
```

---

## 🖼️ 视觉示意

### 浅色模式
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔙 OpenMKView / docs / api / reference.md            ⭐  [⋯]    │ ← 浅灰背景
├─────────────────────────────────────────────────────────────────┤
│ 📄 reference.md                           [Preview][Source][Diff]│
│ Modified 2h ago • 24.5 KB                                        │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search  [📋 Outline 12]  │  [📋 Copy] [⬇️ Export] [⚙️]  [🔲]  │ ← 白色背景
└─────────────────────────────────────────────────────────────────┘
```

### 深色模式
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔙 OpenMKView / docs / api / reference.md            ⭐  [⋯]    │ ← 深灰背景
├─────────────────────────────────────────────────────────────────┤
│ 📄 reference.md                           [Preview][Source][Diff]│
│ Modified 2h ago • 24.5 KB                                        │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search  [📋 Outline 12]  │  [📋 Copy] [⬇️ Export] [⚙️]  [🔲]  │ ← 稍深背景
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ 实施建议

### 优先级 1（核心功能）
1. ✅ 面包屑导航栏
2. ✅ 文档标题 + 元信息
3. ✅ Tab 切换器（现有功能迁移）
4. ✅ 大纲切换按钮（现有功能迁移）

### 优先级 2（增强功能）
1. 📋 复制全文按钮
2. ⬇️ 导出功能
3. 🔲 全屏模式
4. 🔍 文档内搜索

### 优先级 3（优化功能）
1. ⭐ 文件收藏
2. ⚙️ 快速视图设置
3. ⋯ 更多操作菜单
4. 路径智能折叠

---

## 📚 参考设计

- **VS Code**: Tab 设计和面包屑导航
- **Notion**: 简洁的文档标题栏
- **Obsidian**: 工具栏按钮布局
- **GitBook**: 文档内搜索交互

---

*文档创建时间: 2026-03-18*  
*设计者: ACO (阿可)* 🌸
