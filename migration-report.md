# OpenMKView 迁移调查报告

## 一、架构对比

### Main 分支（老版本）- Next.js
| 特性 | 详情 |
|------|------|
| 框架 | Next.js 15.5.12 + React 18.3.1 |
| 样式 | Tailwind CSS v4 + shadcn/ui 组件库 |
| 字体 | Geist Sans / Geist Mono |
| 状态管理 | Zustand + persist |
| 图标 | lucide-react |
| Markdown | Shiki 代码高亮 + remark/rehype |
| 文件树 | react-arborist 虚拟列表 |
| 布局 | react-resizable-panels 可调整面板 |
| 后端 | Next.js API Routes + better-sqlite3 |
| 主题 | 浅色/深色/系统主题 |

### Rust-migration 分支（当前）- Rust + SolidJS
| 特性 | 详情 |
|------|------|
| 后端 | Rust + Actix-web + rusqlite |
| 前端 | SolidJS 1.9.11 |
| 样式 | 自定义 CSS（VS Code 风格） |
| 字体 | 系统字体 |
| 状态管理 | SolidJS createSignal + 自定义 store |
| 图标 | Emoji |
| Markdown | solid-markdown + Prism.js |
| 文件树 | 自定义递归组件（无虚拟列表） |
| 布局 | 固定布局 |
| 主题 | 简单的 invert filter 深色模式 |

---

## 二、UI 详细差异

### 1. Activity Bar（左侧活动栏）

**Main 分支：**
- 宽度：48px (w-12)
- 背景：bg-muted/50（浅灰）/ 深色模式下更深的颜色
- 项目图标：圆形按钮，显示项目名称首字母，激活状态使用 bg-primary
- 底部按钮：主题切换（下拉菜单）、Git、设置
- 图标使用 lucide-react：Plus, Sun, Moon, Monitor, Settings, GitBranch
- Tooltip 提示

**Rust-migration 分支：**
- 宽度：48px
- 背景：#333（深灰）
- 项目列表：在 sidebar 中显示，不在 activity bar
- 图标使用 emoji：📁 🌿 ⚙️
- 无 Tooltip

### 2. Sidebar（文件浏览器）

**Main 分支：**
- 可调整宽度（20%-40%）
- 文件树使用 react-arborist 虚拟列表
- 显示项目名和路径（缩写）
- 关闭项目按钮（X 图标）
- 现代化的文件夹/文件图标（lucide-react）
- 选中状态：bg-accent

**Rust-migration 分支：**
- 固定宽度 280px
- 自定义递归树组件
- 显示项目列表
- 关闭项目按钮（✕ 文字）
- Emoji 图标：📁 📂 📄
- 选中状态：background: #094771

### 3. Markdown Viewer（主要内容区）

**Main 分支：**
- 可调整的文档宽度（full/fixed）
- 三种视图模式：Preview / Source / Diff
- Git 状态标签（显示 Modified/Untracked 等）
- Outline 面板（右侧，可开关）
- Shiki 代码高亮（github-dark/github-light 主题）
- 滚动条样式自定义
- 字体可配置（UI 字体和 Markdown 字体分开）

**Rust-migration 分支：**
- 简单的宽度控制（full/fixed）
- 三种视图模式：Preview / Diff / Source
- 无 Git 状态标签
- Outline 面板（右侧浮窗）
- Prism.js 代码高亮
- 默认滚动条
- 统一字体

### 4. Git Panel

**Main 分支：**
- Dialog 弹窗形式（shadcn/ui）
- 完整功能：Status, Add All, Push, Pull, Pull Rebase, Fetch, Log, Command
- 文件状态分组：Staged / Changes
- 每个文件显示状态图标和文字标签
- 单文件 stage 按钮（悬停显示）
- Commit message 输入框 + Commit 按钮

**Rust-migration 分支：**
- 固定右侧面板
- 基础功能：Stage All, Pull, Push, Commit
- Changes / Commits 标签切换
- 简单的状态指示（M/U/A/D 字母）
- 无单文件 stage 功能

### 5. Settings Panel

**Main 分支：**
- Dialog 弹窗形式
- UI Font：字体家族 + 字号预设
- Markdown Font：字体家族 + 字号预设
- Table Width：Full / Auto
- Markdown Width：Full / Fixed（支持自定义值）
- 实时保存

**Rust-migration 分支：**
- 弹窗形式
- Markdown Width：Full / Fixed
- Theme：Light / Dark
- 手动保存按钮

### 6. Welcome Page

**Main 分支：**
- 居中布局
- Open Project 大按钮
- Recent Projects 网格卡片
- 显示项目名和路径

**Rust-migration 分支：**
- 简单居中文字
- "Open Project" 按钮在 sidebar
- 无 Recent Projects

### 7. 颜色和主题

**Main 分支：**
- 使用 Tailwind CSS 变量系统
- :root 定义浅色主题变量
- .dark 定义深色主题变量
- 颜色使用 oklch 色彩空间
- 现代化的卡片、边框、阴影效果

**Rust-migration 分支：**
- 固定 VS Code 风格深色主题
- 硬编码颜色值（#333, #252526, #2d2d30 等）
- 深色模式使用 CSS filter: invert(1) hue-rotate(180deg)

---

## 三、功能差异

| 功能 | Main 分支 | Rust-migration 分支 |
|------|-----------|---------------------|
| 多项目同时打开 | ✅ | ✅ |
| 项目历史记录 | ✅ | ❌ |
| URL 同步 | ✅ | ❌ |
| 移动端适配 | ✅ | ❌ |
| 面板可调整大小 | ✅ | ❌ |
| 虚拟列表（大文件树） | ✅ | ❌ |
| 文件 Git diff | ✅ | ✅（但实现不同） |
| Git log 查看 | ✅ | ✅ |
| Git command 执行 | ✅ | ❌ |
| Git fetch/pull-rebase | ✅ | ❌ |
| UI 字体设置 | ✅ | ❌ |
| Markdown 字体设置 | ✅ | ❌ |
| 表格宽度设置 | ✅ | ❌ |
| 代码高亮 | Shiki（更丰富） | Prism.js（基础） |
| 深色主题 | ✅ 完善的主题系统 | ✅ 简单的 invert filter |

---

## 四、迁移计划

### 阶段 1：样式系统重构

**目标**：将自定义 CSS 替换为类似 Tailwind 的现代化样式系统

1. **引入 Tailwind CSS v4**
   - 在 frontend 目录安装 tailwindcss, @tailwindcss/postcss, tw-animate-css
   - 创建 globals.css 替换现有的 index.css 和 global.css

2. **定义 CSS 变量**
   - 复制 main 分支的颜色变量系统（oklch 色彩空间）
   - 定义浅色/深色主题变量

3. **基础样式类**
   - 定义 .bg-background, .text-foreground 等工具类
   - 滚动条样式
   - 过渡动画

### 阶段 2：组件重构

**优先级：高**

1. **App.tsx 重构**
   - 使用 CSS Grid 或 Flexbox 实现三栏布局
   - 添加 resizable panels（使用 solid-resizable-panels 或自定义实现）
   - 实现移动端响应式布局

2. **ActivityBar 重构**
   - 使用 lucide-solid 图标库（或 solid-icons）
   - 实现项目首字母图标
   - 添加 Tooltip 组件
   - 主题切换下拉菜单

3. **Sidebar 重构**
   - 添加项目路径显示（缩写）
   - 重构 FileTree 组件：
     - 使用虚拟列表（solid-virtua 或 @tanstack/solid-virtual）
     - 使用 lucide 图标
     - 选中状态样式

4. **MarkdownView 重构**
   - 集成 Shiki 代码高亮
   - 添加 Git 状态标签
   - 实现 OutlinePanel 嵌入布局

**优先级：中**

5. **GitPanel 重构**
   - 使用 Dialog 组件（solid-ui 或自定义）
   - 添加完整 Git 功能
   - 文件状态分组显示
   - 状态图标和标签

6. **SettingsPanel 重构**
   - 使用 Dialog 组件
   - 添加所有设置项
   - 字体预设按钮
   - 实时保存

7. **WelcomePage 重构**
   - 添加 Recent Projects 列表
   - 网格卡片布局

### 阶段 3：功能补全

1. **状态管理增强**
   - 补全缺失的 Git 功能（fetch, pull-rebase, exec）
   - 添加项目历史记录
   - URL 同步（可选）

2. **Store 重构**
   - 考虑使用 solid-zustand 或保持原生 createSignal
   - 添加 localStorage 持久化

3. **Markdown 处理**
   - 集成 remark/rehype 生态
   - 替换 Prism.js 为 Shiki

### 阶段 4：后端对接

1. **确保 Rust 后端 API 兼容**
   - 检查所有 API 端点
   - 补全缺失的 Git 相关端点

2. **静态文件服务**
   - Rust 后端需要正确服务 dist 目录
   - 或者使用反向代理

---

## 五、推荐的组件库选择

| 功能 | 推荐库 |
|------|--------|
| 图标 | lucide-solid 或 solid-icons |
| 虚拟列表 | @tanstack/solid-virtual 或 solid-virtua |
| 可调整面板 | solid-resizable-panels（需检查可用性）或自定义实现 |
| Dialog | @corvu/dialog 或 solid-ui |
| Tooltip | @corvu/tooltip 或 solid-ui |
| 代码高亮 | shiki（solid 集成） |
| Markdown | solid-markdown（保留）+ remark/rehype |

---

## 六、样式迁移优先级

### 必须立即修复的样式问题
1. **整体布局**：当前太窄（1126px），应该全屏自适应
2. **颜色系统**：从固定颜色改为 CSS 变量系统
3. **字体系统**：添加 Geist 字体或类似字体
4. **图标系统**：从 emoji 改为 lucide 图标

### 次要修复的样式问题
1. 按钮样式统一
2. 输入框样式统一
3. 滚动条样式
4. 过渡动画

---

## 七、文件变更清单

### 前端变更
```
frontend/
├── package.json              # 添加依赖
├── postcss.config.mjs        # 新增
├── src/
│   ├── index.css             # 重写（Tailwind 入口）
│   ├── styles/
│   │   └── global.css        # 重写或删除
│   ├── App.tsx               # 重构布局
│   ├── components/
│   │   ├── ActivityBar.tsx   # 重构
│   │   ├── FileTree.tsx      # 重构（虚拟列表）
│   │   ├── GitPanel.tsx      # 重构
│   │   ├── MarkdownView.tsx  # 重构（Shiki）
│   │   ├── OutlinePanel.tsx  # 重构
│   │   ├── SettingsPanel.tsx # 重构
│   │   └── WelcomePage.tsx   # 新增
│   └── stores/
│       └── projectStore.ts   # 增强
```

### 后端变更（如需）
```
src/
├── main.rs                   # 修改静态文件服务路径
└── handlers/
    └── git_handler.rs        # 补全缺失的 Git 功能
```

---

## 八、验证清单

- [ ] 整体布局与 main 分支一致（三栏、可调整）
- [ ] 颜色系统与 main 分支一致（浅色/深色主题）
- [ ] Activity Bar 显示项目首字母图标
- [ ] File Tree 使用虚拟列表，支持大目录
- [ ] Markdown 预览使用 Shiki 高亮
- [ ] Git Panel 功能完整
- [ ] Settings Panel 功能完整
- [ ] Welcome Page 显示最近项目
- [ ] 移动端适配（可选）
