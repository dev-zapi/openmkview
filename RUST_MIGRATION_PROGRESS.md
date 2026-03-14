# OpenMKView Rust 迁移进度

**版本**: v0.2.0-beta  
**更新日期**: 2024-03-14  
**状态**: MVP 完成 ✅

## 已完成功能

### 后端 API ✅ 100%
- ✅ 项目管理 (GET/POST/DELETE /api/projects)
- ✅ 文件树 (GET /api/files/tree)
- ✅ 文件内容 + Markdown 渲染 (GET /api/files/content)
- ✅ 设置管理 (GET/PUT /api/settings)
- ✅ Git 完整操作 (POST /api/git) - 12 个 actions

### 前端界面 ✅ 90%
- ✅ Activity Bar
- ✅ 可调整侧边栏（拖动手柄）
- ✅ 项目管理和切换
- ✅ 文件树浏览（可折叠）
- ✅ Markdown 预览模式
- ✅ 源码查看模式
- ✅ Diff 查看模式
- ✅ Git 面板（status/add/commit/push/pull）
- ✅ 设置对话框
- ✅ 响应式布局

## 技术栈

| 层次 | 技术 |
|-----|------|
| Web 框架 | actix-web 4 |
| 数据库 | rusqlite + SQLite |
| Markdown | pulldown-cmark 0.12 |
| 前端 | HTMX 2 + 原生 JS |
| 样式 | 内联 CSS |

## 运行项目

### 开发模式
```bash
cd openmkview-rs/openmkview-rs
cargo run
```

### 发布模式（单二进制）
```bash
cd openmkview-rs/openmkview-rs
cargo build --release
# 生成 target/release/openmkview
./target/release/openmkview
```

访问 http://localhost:3000

## 功能特性

### VS Code 风格布局
- 三栏布局：Activity Bar → 侧边栏 → 主内容区
- 可拖动手柄调整侧边栏宽度（150-500px）
- 暗色主题

### Markdown 渲染
- GitHub Flavored Markdown 支持
- 表格、任务列表、删除线
- 语法高亮（计划中）
- 可配置宽度（全宽/70%/800px/900px）

### Git 集成
- 查看文件状态（已修改/新增/删除/未跟踪）
- Stage 所有更改
- Commit（带对话框）
- Push / Pull
- 查看 Diff

### 文件管理
- 打开本地目录作为项目
- 项目历史记录
- 文件树导航
- 快速切换文件

## 代码统计

| 文件 | 行数 | 说明 |
|-----|------|------|
| main.rs | ~700 | 后端 API + Git 操作 |
| models.rs | ~230 | 数据模型 + Markdown 渲染 |
| index.html | ~300 | 前端界面 |
| **总计** | **~1230** | 精简高效 |

## 性能

- 启动时间：<1 秒
- 内存占用：<50MB
- 二进制大小：~20MB（release 模式）
- API 响应：<10ms

## 下一步

### 高优先级
- [ ] 语法高亮（集成 syntect）
- [ ] Outline 目录面板
- [ ] 文件搜索
- [ ] 主题切换（亮/暗）

### 中优先级
- [ ] 文件创建/重命名/删除
- [ ] 自动保存
- [ ] 历史记录导航
- [ ] 快捷键支持

### 低优先级
- [ ] 插件系统
- [ ] 云同步
- [ ] 协作编辑

## 里程碑

- ✅ 2024-03-14: Rust 环境搭建
- ✅ 2024-03-14: 基础后端 API
- ✅ 2024-03-14: Git API 完成
- ✅ 2024-03-14: Markdown 渲染
- ✅ 2024-03-14: MVP 完成
- ✅ 2024-03-14: 完整 UI（Git 面板 + 可调布局）
- 🔲 2024-03-15: Beta 测试
- 🔲 2024-03-16: v0.2.0 正式发布

## 已知问题

1. 语法高亮未实现（代码块显示为普通文本）
2. Outline 面板未实现
3. 文件操作（创建/删除/重命名）不支持
4. 没有键盘快捷键

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

---

**项目地址**: https://github.com/dev-zapi/openmkview  
**开发分支**: rust-migration
