# Passkey 代码评审与修复方案

## 评审背景

- 评审对象：`plan/passkey-design.md` 对应的已开发实现
- 评审范围：
  - 后端：`src/passkey.rs`、`src/auth.rs`、`src/main.rs`、`src/config.rs`
  - 前端：`frontend/src/stores/authStore.ts`、`frontend/src/utils/webauthn.ts`、相关页面与测试
- 评审方式：代码评审 + 安全评审

## 总体结论

当前 Passkey(WebAuthn) 主流程与设计文档整体一致：

- 已实现注册、登录、列表、删除
- 已实现 origin 校验、challenge 一次性消费、auth binding 失效清空
- 当前未发现直接的认证绕过路径

但仍存在 4 个需要处理的问题，其中 2 个应优先修复：

- 匿名登录 challenge 可被恶意打满，导致 Passkey 登录拒绝服务
- Session Cookie 的 `Secure` 标记与 Passkey origin 配置耦合，代理部署下存在误配风险
- `passkeys.json` 启动时不会校验/修复已有文件权限
- `config.toml` 中敏感认证材料写入时未显式收紧文件权限

## 详细问题

### 1. 匿名 challenge 池可被打满，导致 Passkey 登录 DoS

- 风险等级：中
- 修复优先级：P1
- 位置：
  - `src/auth.rs:182-188`
  - `src/passkey.rs:23-26`
  - `src/passkey.rs:246-279`
  - `src/passkey.rs:396-406`

#### 问题说明

`/api/auth/passkey/login/start` 是公开接口。当前实现每次调用都会在全局内存中保留一个 challenge，默认存活 300 秒；当待处理 challenge 数达到 `100` 后，后续请求会直接失败。

攻击者无需登录，只需连续请求约 100 次，即可在 challenge 过期前让所有合法用户的 Passkey 登录失败。

#### 影响

- 可造成 Passkey 登录短时不可用
- 风险属于匿名可触发的拒绝服务
- 在公开部署场景下较容易被利用

#### 修复方案

建议采用最小可控修复：

1. 将当前“全局固定上限”改为“全局上限 + 客户端维度限流”。
2. 对 `login/start` 增加基于客户端标识的速率限制。
3. 优先使用 `peer_addr`；若部署在可信反向代理之后，再评估是否引入受信任代理下的真实客户端 IP。
4. 当超过限制时返回更明确的 `429 Too Many Requests`，不要继续复用业务型 `400`。
5. 保留现有过期清理逻辑和 one-time use 逻辑。

#### 建议测试

- 新增 `login/start` 限流测试
- 新增 challenge 达到上限后的行为测试
- 新增 challenge 过期后恢复可用测试
- 新增 challenge 只能消费一次的测试

### 2. Session Cookie 的 `Secure` 标记与 Passkey origin 配置耦合

- 风险等级：中
- 修复优先级：P1
- 位置：
  - `src/main.rs:290-299`
  - `src/auth.rs:264-289`

#### 问题说明

当前 `secure_cookies` 的取值由：

```rust
let secure_cookies = passkey_origin.starts_with("https://");
```

决定。这意味着 Session Cookie 的安全属性并不是由 Cookie 自身部署策略决定，而是被 Passkey origin 配置间接控制。

在 TLS 终止于反向代理的部署场景下，如果 `OPENMKVIEW_PASSKEY_ORIGIN` 漏配或误配为 `http://...`，即使外部访问路径实际是 HTTPS，登录 Cookie 也会失去 `Secure` 标记。

#### 影响

- 代理部署时容易因为配置错误而弱化会话安全性
- 密码登录和 Passkey 登录都会受影响
- 风险主要来自误配和运维不可见性，而非代码直接绕过

#### 修复方案

建议将 Cookie 安全策略与 Passkey 配置解耦：

1. 为 Cookie 增加独立配置项，例如：`OPENMKVIEW_SECURE_COOKIES` 或配置文件项 `session.secure_cookies`。
2. 默认策略保持兼容：
   - 本地纯 HTTP 开发默认 `false`
   - 明确公共 HTTPS 部署时默认 `true`
3. 如果检测到 `passkey_origin` 为 `https://` 但 `secure_cookies = false`，启动时输出高优先级告警。
4. 在 README 或部署文档中明确反向代理部署必须配置 Cookie 策略。

#### 建议测试

- 新增 `secure_cookies=true/false` 的 Cookie 属性测试
- 新增 HTTPS Passkey origin 与 Cookie 配置组合测试
- 新增代理部署场景的启动配置测试

### 3. `passkeys.json` 启动时不会校验或修复已有文件权限

- 风险等级：低
- 修复优先级：P2
- 位置：
  - `src/passkey.rs:108-124`
  - `src/passkey.rs:511-535`
  - `src/passkey.rs:700-710`

#### 问题说明

设计文档要求 Unix 下 `passkeys.json` 权限为 `0o600`。当前实现只在写临时文件时设置 `mode(0o600)`，但启动时加载已有文件不会检查权限，也不会主动修复。

如果文件来自手动复制、恢复备份或宽松 umask 场景，服务会直接读取该文件。

#### 影响

- 本地多用户环境下可能扩大凭据文件的可读范围
- 问题主要是主机侧最小权限控制不完整

#### 修复方案

1. 在 `build_passkey_state()` 或 `load_store()` 后增加权限校验。
2. Unix 下如果权限宽于 `0o600`，自动修复为 `0o600` 并记录日志。
3. 如果自动修复失败，应中止加载并返回明确错误，避免在不安全权限下继续运行。
4. 可补充目录权限检查，至少保证存储目录不会明显宽于预期。

#### 建议测试

- 新增 Unix 条件下的权限修复测试
- 新增已有宽权限文件启动修复测试
- 新增修复失败时的错误返回测试

### 4. `config.toml` 中敏感认证材料写入时未显式收紧权限

- 风险等级：低
- 修复优先级：P2
- 位置：
  - `src/config.rs:92-121`

#### 问题说明

`config.toml` 中保存了密码哈希和 session secret，但 `save_config()` 目前通过 `fs::write()` 直接写入，没有显式设置 Unix 权限，也没有采用与 Passkey 存储一致的原子写入策略。

#### 影响

- 多用户系统中可能扩大密码哈希和 session secret 的本地暴露面
- 与 Passkey 存储相比，敏感配置文件的保护级别不一致

#### 修复方案

1. 将 `save_config()` 改为原子写入：临时文件 + `rename`。
2. Unix 下显式设置 `0o600`。
3. 写入完成后执行 `sync_all()`，与 `passkeys.json` 的写入策略保持一致。
4. 将“敏感配置文件最小权限策略”统一抽成复用函数，避免两处逻辑再次分叉。

#### 建议测试

- 新增 `config.toml` 原子写入测试
- 新增 Unix 条件下权限校验测试
- 新增 secret 自动生成后的文件权限测试

## 修复顺序建议

建议按以下顺序处理：

1. 修复匿名 challenge DoS 问题
2. 解耦并明确 Session Cookie 的 `Secure` 策略
3. 修复 `passkeys.json` 的启动权限校验与自动收敛
4. 修复 `config.toml` 的敏感文件写入权限与原子写入
5. 补齐相关单元测试和集成测试

## 建议实现拆分

为了保持提交原子性，建议拆为以下几个工作项：

1. `fix: limit passkey login challenges`
2. `fix: decouple secure cookies from passkey origin`
3. `fix: enforce passkey store file permissions`
4. `fix: harden config file writes`
5. `test: add passkey security coverage`

## 当前测试基线

本次评审时已验证：

- `cargo test` 通过
- `source ~/.nvm/nvm.sh && npm test` 通过

## 当前测试缺口

现有测试已覆盖部分 helper 和前端 UI，但以下方面仍缺口明显：

- challenge 一次性消费与过期行为
- `login/start` 匿名频率控制与上限行为
- auth binding 变化后自动清空凭据
- Unix 文件权限校验与自动修复
- Passkey 注册/登录完整闭环的前端 store 行为
- 代理部署下 Cookie 安全策略相关行为

## 结论

Passkey 功能主体实现可用，且与设计文档大体一致，但在匿名登录入口的资源控制、代理部署下的 Cookie 安全策略、以及本地敏感文件权限治理上仍有明显改进空间。

建议优先完成 P1 项，再补齐权限与测试层面的收尾工作。
