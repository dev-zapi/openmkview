# Copilot Instructions for OpenMKView

OpenMKView 是一个基于 Rust 的 Markdown 文件预览器，画面布局借鉴 opencode web，采用三栏设计（Activity Bar → 文件浏览器 → Markdown 查看器）。使用 SQLite 数据库进行项目和设置的持久化存储。

## 技术栈

- **语言**: Rust 2021 Edition
- **Web 框架**: Actix-web 4
- **数据库**: rusqlite 0.32 (SQLite)
- **模板引擎**: Askama 0.13
- **Markdown 处理**: pulldown-cmark 0.12
- **序列化**: serde + serde_json
- **静态资源**: rust-embed 8
- **代码高亮**: syntect 5.3.0

## 开发命令

- **开发运行**: `cargo run`
- **构建**: `cargo build --release`
- **测试**: `cargo test`
- **格式化**: `cargo fmt`
- **检查**: `cargo clippy`

## 仓库结构

```
src/
├── main.rs                    # 应用入口和路由配置
├── lib.rs                     # 模块导出
├── errors/                    # 错误处理层
│   └── mod.rs                 # 统一错误类型定义
├── models/                    # 数据模型层
│   ├── mod.rs
│   ├── project.rs             # 项目相关模型
│   ├── file.rs                # 文件相关模型
│   └── settings.rs            # 设置相关模型
├── db/                        # 数据库层
│   ├── mod.rs
│   ├── connection.rs          # 数据库连接初始化
│   └── repositories/          # 数据访问层
│       ├── mod.rs
│       ├── project_repo.rs    # 项目 CRUD 操作
│       └── settings_repo.rs   # 设置 CRUD 操作
├── services/                  # 业务逻辑层
│   ├── mod.rs
│   ├── project_service.rs     # 项目业务逻辑
│   ├── file_service.rs        # 文件业务逻辑
│   ├── git_service.rs         # Git 操作逻辑
│   ├── markdown_service.rs    # Markdown 渲染逻辑
│   └── settings_service.rs    # 设置业务逻辑
└── handlers/                  # HTTP 处理器层
    ├── mod.rs
    ├── project_handler.rs     # 项目 API 端点
    ├── file_handler.rs        # 文件 API 端点
    ├── git_handler.rs         # Git API 端点
    └── settings_handler.rs    # 设置 API 端点
```

## 架构模式

1. **分层架构**:
   - **Handlers**: 处理 HTTP 请求/响应，不包含业务逻辑
   - **Services**: 包含核心业务逻辑
   - **Repositories**: 数据访问层，封装数据库操作
   - **Models**: 数据结构定义

2. **错误处理**:
   - 使用统一的 `AppError` 类型
   - 实现 `ResponseError` trait 自动转换为 HTTP 响应
   - 避免使用 `.unwrap()`，使用 `?` 运算符传播错误

3. **依赖注入**:
   - 通过 `web::Data<T>` 传递服务和仓库
   - 服务层持有仓库的引用，避免重复创建连接

4. **数据库**:
   - 使用 rusqlite 进行 SQLite 操作
   - 连接通过 `Mutex<Connection>` 包装以支持多线程
   - 仓库模式封装所有 SQL 查询

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 首页 HTML |
| GET | `/api/projects` | 获取项目列表 |
| POST | `/api/projects` | 创建/打开项目 |
| DELETE | `/api/projects/{id}` | 关闭项目 |
| GET | `/api/files/tree` | 获取文件树 |
| GET | `/api/files/content` | 获取文件内容 |
| POST | `/api/files` | 创建文件 |
| PUT | `/api/files` | 重命名文件 |
| DELETE | `/api/files` | 删除文件 |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/git` | Git 操作 |

## 编码规范

### 必须遵守

- 使用 Rust 2021 Edition 特性
- 遵循现有代码风格和命名约定
- 所有公开 API 使用 `AppResult<T>` 返回类型
- 错误信息使用中文（面向用户）
- 结构体字段使用英文命名
- 保持模块职责单一，避免循环依赖

### 推荐做法

- 使用 `#[derive(Debug)]` 便于调试
- 为序列化结构体实现 `Clone` trait
- 使用 `serde` 属性处理 JSON 字段命名（如 `rename = "camelCase"`）
- 数据库查询使用参数化查询防止 SQL 注入
- 文件路径操作使用 `PathBuf` 而非字符串

### 提交规范

- 使用中文编写提交信息
- 遵循约定式提交格式：`type: description`
  - `feat`: 新功能
  - `fix`: 修复 bug
  - `refactor`: 代码重构
  - `docs`: 文档更新
  - `chore`: 构建/工具/配置

## 测试指南

- 为 service 层编写单元测试
- 使用临时目录测试文件操作
- Mock 数据库连接进行测试
- 确保测试不依赖外部状态

## 数据安全

- 禁止提交包含敏感信息的文件
- 文件路径验证防止目录遍历攻击
- 数据库连接字符串不硬编码在代码中
- 用户输入必须进行验证和清理
