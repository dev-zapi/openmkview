# OpenMKView Rust 运行说明

## 快速开始

### 1. 确保 Rust 已安装
```bash
rustc --version
# 应显示 rustc 1.x.x
```

如未安装，运行：
```bash
curl --proto '=https' --sslv2.4 -sSf https://sh.rustup.rs | sh
```

### 2. 编译项目
```bash
cd openmkview-rs
cargo build --release
```

### 3. 运行
```bash
./target/release/openmkview
```

或者开发模式：
```bash
cargo run
```

### 4. 访问
打开浏览器访问：http://localhost:3000

## 使用指南

### 打开项目
1. 点击"📂 打开项目"按钮
2. 输入 Markdown 文件所在目录的完整路径
3. 点击确定

### 浏览文件
- 点击文件夹图标展开/折叠目录
- 点击文件查看内容

### 查看模式
- **预览**: 渲染后的 Markdown
- **源码**: 原始 Markdown 文本
- **Diff**: 与 Git HEAD 的差异

### Git 操作
1. 点击 Activity Bar 的 🌿 按钮打开 Git 面板
2. 查看文件状态（颜色标识）：
   - 🟡 黄色：已修改
   - 🟢 绿色：新增
   - 🔴 红色：删除
   - 🔵 蓝色：未跟踪
3. 使用按钮：
   - Stage All: 暂存所有更改
   - Commit: 提交（弹出对话框输入信息）
   - Push: 推送到远程
   - Pull: 从远程拉取

### 调整布局
- 拖动侧边栏右侧的手柄调整宽度
- 范围：150px - 500px

### 设置
1. 点击 Activity Bar 的 ⚙️ 按钮
2. 选择 Markdown 宽度：
   - 全宽
   - 70%
   - 800px
   - 900px
3. 点击"保存"

## 故障排除

### 端口被占用
错误："Address already in use"
解决：
```bash
lsof -ti:3000 | xargs kill -9
```

### 无法打开项目
确保输入的是绝对路径，且目录存在。

### Git 操作失败
确保项目目录是 Git 仓库（有 .git 文件夹）。

## 性能优化

### 发布构建（推荐）
```bash
cargo build --release
```
优点：
- 优化编译，运行更快
- 二进制文件更小

### 开发构建
```bash
cargo run
```
优点：
- 编译快速
- 包含调试信息

## 数据持久化

数据存储在：
```
openmkview-rs/data/openmkview.db
```

包含：
- 项目历史
- 系统设置

## 快捷键（计划中）

目前不支持快捷键，计划添加：
- `Ctrl/Cmd + P`: 快速打开文件
- `Ctrl/Cmd + Shift + F`: 搜索文件
- `Ctrl/Cmd + B`: 切换侧边栏
- `Ctrl/Cmd + \``: 切换 Git 面板

---

**版本**: v0.2.0-beta  
**更新日期**: 2024-03-14
