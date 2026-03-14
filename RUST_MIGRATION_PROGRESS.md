# Rust 迁移进度报告

## 已完成 (Phase 0-2)

### ✅ Phase 0: Git 分支设置
- 创建 `rust-migration` 开发分支
- 建立分支管理规范

### ✅ Phase 1: Rust 环境初始化
- 安装 Rust 工具链 (rustc 1.94.0)
- 创建 `openmkview-rs/` 项目
- 配置 Cargo.toml 依赖

### ✅ Phase 2: 后端 API 实现 (部分)
**已完成：**
- ✅ 数据库层 (rusqlite)
- ✅ 项目管理 API (GET/POST/DELETE /api/projects)
- ✅ 文件树 API (GET /api/files/tree)
- ✅ 文件内容 API (GET /api/files/content)
- ✅ 设置 API (GET/PUT /api/settings)
- ✅ 使用 actix-web 框架
- ✅ 编译成功

**待完成：**
- 🔲 Git 操作 API (POST /api/git)
- 🔲 目录搜索 API (GET /api/directories/search)

## 待完成 (Phase 3-6)

### 🔲 Phase 3: 前端 HTMX 重写
需要实现：
1. 基础布局模板 (base.html)
2. Activity Bar 组件
3. File Explorer 组件 (HTMX + 嵌套列表)
4. Markdown Viewer (使用 pulldown-cmark + syntect)
5. Outline Panel
6. Git Panel
7. Settings Dialog

**技术栈：**
- HTMX (动态交互)
- Alpine.js (轻量级状态管理)
- Tailwind CSS (样式)
- pulldown-cmark (Markdown 解析)
- syntect (语法高亮)

### 🔲 Phase 4: 功能集成
1. 静态资源嵌入 (使用 actix-files)
2. Askama 模板渲染
3. Git 操作集成
4. 可调整面板 (使用 Split.js)

### 🔲 Phase 5: 测试与优化
1. 单元测试
2. 集成测试
3. 性能优化
4. 编译优化 (release profile)

### 🔲 Phase 6: 文档更新
1. 更新 README.md
2. 创建 Rust 安装指南
3. 迁移说明文档

## 技术决策

### 框架选择
- **Web 框架**: actix-web (替代 axum)
  - 原因：对同步代码更友好，rusqlite 集成简单
  - 缺点：不是 async-first，但对我们的场景足够

### 数据库
- **rusqlite**: 直接使用 rusqlite::Connection + Mutex
  - 简单直接
  - 单线程访问足够（我们的场景）

### 模板引擎
- **askama**: 编译期模板
  - 类型安全
  - 高性能

## 下一步行动

### 立即执行
1. 实现 Git API
2. 创建基础 HTML 模板
3. 集成 Markdown 渲染

### 本周内
1. 完成文件树前端
2. 完成 Markdown 预览
3. 集成静态资源

### 下周
1. 完成所有前端组件
2. 测试和优化
3. 编写文档

## 构建说明

### 开发模式
```bash
cd openmkview-rs
cargo run
```

### 发布模式 (单二进制)
```bash
cd openmkview-rs
cargo build --release
# 生成 target/release/openmkview
```

### 优化配置
在 Cargo.toml 中添加：
```toml
[profile.release]
lto = true
codegen-units = 1
strip = true
```

## 已知问题

1. **rusqlite 不是 Send+Sync**
   - 解决：使用 std::sync::Mutex 包装
   
2. **路径安全验证**
   - 已实现：canonicalize + starts_with 检查
   
3. **Git 操作**
   - 待实现：使用 std::process::Command

## 代码统计

| 文件 | 行数 | 状态 |
|-----|------|------|
| main.rs | ~300 | ✅ 完成 |
| models.rs | ~150 | ✅ 完成 |
| 总计 | ~450 | 60% 完成 |

## 里程碑

- ✅ 2024-03-14: Rust 环境搭建
- ✅ 2024-03-14: 基础后端 API
- 🔲 2024-03-15: Git API + 前端框架
- 🔲 2024-03-16: 完整前端 UI
- 🔲 2024-03-17: 测试与发布

---

**当前版本**: v0.2.0-alpha
**目标版本**: v0.2.0-stable
