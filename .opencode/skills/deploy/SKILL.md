---
name: deploy
description: 部署项目到生产环境。执行完整部署流程：检查并提交代码改动、推送远程仓库、执行 make install restart。当用户说"部署"、"deploy"、"推送部署"、"上线"、"帮我部署"、"我要部署了"等触发。即使只说"push"或"commit并push"且项目有Makefile，也应触发。
---

# 项目部署工作流

执行标准部署流程，确保代码安全推送到远程仓库并重启服务。

## 工作流步骤

### 1. 检查未提交改动

首先检查工作区状态：

```bash
git status --short
```

**如果有未提交改动：**

- 检查改动内容：`git diff --stat` 和关键文件的具体改动
- 结合上下文（本次对话中做了什么）生成commit message
- commit message遵循项目AGENTS.md规范：
  - 格式：`<type>: <description>`
  - 类型：`feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
  - 英文，不超过50字符
  
**生成commit message的策略：**
- 回顾对话历史，理解本次改动的目的
- 如果是新功能 → `feat: <功能描述>`
- 如果是bug修复 → `fix: <问题描述>`
- 如果是重构 → `refactor: <重构内容>`
- 如果只是配置或小调整 → `chore: <调整内容>`
- 执行commit：
  ```bash
  git add .
  git commit -m "<message>"
  ```

**如果没有未提交改动：** 直接进入下一步

### 2. 检查需要推送的commit

检查本地与远程的差异：

```bash
git status
```

或更精确地：

```bash
git log origin/main..HEAD --oneline  # 或当前分支对应的远程分支
```

**如果有未推送的commit：**

- 显示待推送的commit列表
- 执行推送：
  ```bash
  git push
  ```

**如果已经同步：** 提示用户并继续下一步

### 3. 执行部署命令

运行项目部署命令：

```bash
make install restart
```

**如果Makefile不存在或命令失败：**
- 提示用户部署命令执行失败
- 显示具体错误信息
- 询问用户如何处理

### 4. 报告结果

向用户报告完整部署流程的结果：
- 是否提交了改动（commit message内容）
- 是否推送了commit（推送的commit数量）
- make命令执行结果（成功/失败）
- 最终状态：部署完成或失败原因

## 错误处理

遇到以下情况应停止并询问用户：

1. **Git冲突** - 本地与远程有冲突
2. **推送失败** - 网络问题或权限问题
3. **make命令失败** - 部署脚本执行出错
4. **用户明确要求停止** - 随时可以中断流程

## 快速模式

如果用户说"快速部署"或"skip checks"，可以跳过交互式确认，直接执行流程。但仍需报告结果。

## 注意事项

- 执行前确认当前分支是正确的部署分支
- 不执行force push除非用户明确要求
- 检查是否包含敏感文件（.env、密钥等），如有则警告用户