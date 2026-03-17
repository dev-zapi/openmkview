# OpenMKView 完整迁移计划

## 当前状态分析

### 迁移前 (main 分支 - Next.js)
组件列表：
- activity-bar: 活动栏（项目切换、Git、设置按钮）
- app-shell: 应用外壳
- file-explorer: 文件资源管理器（react-arborist 虚拟滚动）
- git-panel: Git 面板（完整 Git 功能）
- git-command-dialog: Git 命令对话框
- git-diff-dialog: Git Diff 对话框
- git-log-dialog: Git 日志对话框
- markdown-viewer: Markdown 查看器（Shiki 高亮）
- outline-panel: 大纲面板（目录导航）
- settings-dialog: 设置对话框
- welcome-page: 欢迎页面
- mobile-nav: 移动端导航

### 迁移后 (rust-migration 分支 - SolidJS)
现有组件：
- FileTree: 简单递归文件树
- MarkdownView: Markdown 渲染（PrismJS）
- DiffViewer: Diff 查看器
- DiffSelector: Diff 选择器

## 需要完成的工作

### Phase 1: 核心功能完善
1. ✅ 项目管理和切换
2. ✅ 文件树浏览
3. ✅ Markdown 预览
4. ✅ Source 模式
5. ✅ Diff 模式

### Phase 2: Git 功能
1. Git 面板 UI
2. Git 状态显示
3. Git 操作（add, commit, push, pull）
4. Git 日志查看
5. Git Diff 对比

### Phase 3: 大纲面板
1. 从 Markdown 提取标题
2. 大纲导航 UI
3. 点击跳转功能

### Phase 4: 设置面板
1. Markdown 宽度设置
2. 主题切换
3. 其他设置项

### Phase 5: 测试完善
1. 单元测试覆盖所有组件
2. E2E 测试覆盖所有功能
3. 视觉回归测试

## API 对比

### 后端 API（已完整实现）
- ✅ GET /api/projects - 列出项目
- ✅ POST /api/projects - 创建项目
- ✅ DELETE /api/projects/:id - 删除项目
- ✅ GET /api/files/tree - 获取文件树
- ✅ GET /api/files/content - 获取文件内容
- ✅ POST /api/files - 创建文件
- ✅ PUT /api/files - 重命名文件
- ✅ DELETE /api/files - 删除文件
- ✅ GET /api/settings - 获取设置
- ✅ PUT /api/settings - 更新设置
- ✅ POST /api/git - 执行 Git 操作
- ✅ GET /api/git/commits - 获取提交历史
- ✅ GET /api/git/branches - 获取分支列表
- ✅ GET /api/git/tags - 获取标签列表
- ✅ POST /api/git/diff - 获取文件 Diff
- ✅ GET /api/git/file - 获取指定版本的文件

### 前端 API 服务（需要扩展）
当前：api.ts 只有基础功能
需要：添加 Git 相关 API

## 样式对比

### 迁移前
- Tailwind CSS + shadcn/ui
- 现代化设计系统
- 响应式布局

### 迁移后
- 自定义 CSS
- 需要完善以匹配迁移前
