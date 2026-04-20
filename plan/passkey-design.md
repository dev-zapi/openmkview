# Passkey (WebAuthn) 功能设计文档

## 概述

OpenMKView 支持 Passkey 作为密码登录的**替代方式**（非 2FA）。用户可以选择使用用户名/密码或 Passkey 登录。Passkey 凭据以 JSON 文件形式存储在 XDG data 目录中。

**当前状态：已实现**

---

## 架构设计

### 技术选型

| 组件 | 选型 | 版本 |
|------|------|------|
| WebAuthn 后端 | `webauthn-rs` | 0.5 |
| 凭据存储 | JSON 文件 | — |
| 前端 API | Web Authentication API | — |
| 前端框架 | SolidJS | — |

### 存储策略

- **位置**: `~/.local/share/openmkview/passkeys.json`（通过 `dirs::data_local_dir()` 获取）
- **权限**: Unix 系统下文件权限 `0o600`（仅所有者可读写）
- **写入方式**: 原子写入（先写 `.tmp` 文件，再 `rename`）
- **损坏处理**: 解析失败时自动备份为 `passkeys.broken-{timestamp}.json`，重新初始化

### 安全绑定机制（Auth Binding）

Passkey 凭据与当前管理员账户绑定。绑定值通过以下字段的 SHA-256 哈希计算：

```
SHA-256(username + NUL + password_hash + NUL + algorithm + NUL + source)
```

当管理员账户的用户名、密码或算法发生变化时，绑定值改变，**所有已注册的 Passkey 将被自动清除**。

---

## 数据模型

### PasskeyStoreData（文件存储结构）

```json
{
  "auth_binding": "<sha256 hex>",
  "user_id": "<uuid v4>",
  "credentials": [
    {
      "id": "<base64url encoded credential id>",
      "name": "This device",
      "created_at": "2025-01-01T00:00:00Z",
      "last_used_at": "2025-01-02T00:00:00Z",
      "passkey": { /* webauthn-rs Passkey struct, opaque */ }
    }
  ]
}
```

### PasskeySiteConfig（运行时配置）

```rust
struct PasskeySiteConfig {
    rp_id: String,    // Relying Party ID，通常是域名，如 "localhost"
    origin: String,   // 完整 origin，如 "http://localhost:4567"
}
```

### PasskeyState（应用状态）

```rust
struct PasskeyState {
    site: PasskeySiteConfig,
    store_path: PathBuf,
    store: Arc<Mutex<PasskeyStoreData>>,
    registration_challenges: Arc<Mutex<HashMap<String, ChallengeRecord<PasskeyRegistration>>>>,
    authentication_challenges: Arc<Mutex<HashMap<String, ChallengeRecord<PasskeyAuthentication>>>>,
    ceremony_timeout_seconds: u64,  // 默认 300 秒
}
```

---

## API 端点

### 注册流程（需已认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/passkey/register/start` | 生成注册 challenge |
| `POST` | `/api/auth/passkey/register/finish` | 验证并保存凭据 |

#### Register Start 响应

```json
{
  "requestId": "<uuid>",
  "options": { /* PublicKeyCredentialCreationOptions (webauthn-rs 格式) */ }
}
```

#### Register Finish 请求

```json
{
  "requestId": "<uuid>",
  "name": "My MacBook",
  "credential": { /* 浏览器返回的 PublicKeyCredential 序列化后 */ }
}
```

#### Register Finish 响应

```json
{
  "credentials": [
    { "id": "...", "name": "My MacBook", "createdAt": "...", "lastUsedAt": null }
  ]
}
```

### 认证流程（公开，无需已认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/passkey/login/start` | 生成认证 challenge |
| `POST` | `/api/auth/passkey/login/finish` | 验证 Passkey 并创建 session |

#### Login Start 响应

```json
{
  "requestId": "<uuid>",
  "options": { /* PublicKeyCredentialRequestOptions (webauthn-rs 格式) */ }
}
```

#### Login Finish 请求

```json
{
  "requestId": "<uuid>",
  "credential": { /* 浏览器返回的 PublicKeyCredential 序列化后 */ }
}
```

#### Login Finish 响应

与普通登录一致，返回 `AuthStatusResponse` 并设置 session cookie。

### 管理（需已认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/auth/passkey/list` | 列出所有已注册 Passkey |
| `DELETE` | `/api/auth/passkey/{id}` | 删除指定 Passkey |

---

## 前端实现

### WebAuthn 工具函数 (`frontend/src/utils/webauthn.ts`)

处理浏览器 WebAuthn API 与服务端 JSON 之间的数据转换：

- `decodeBase64Url` / `encodeBase64Url` — Base64URL 编解码
- `prepareCreationOptions` — 将服务端注册选项转换为 `PublicKeyCredentialCreationOptions`
  - 解码 `challenge`、`user.id`、`excludeCredentials[].id` 为 `ArrayBuffer`
- `prepareRequestOptions` — 将服务端认证选项转换为 `CredentialRequestOptions`
  - 解码 `challenge`、`allowCredentials[].id` 为 `ArrayBuffer`
- `serializeRegistrationCredential` — 将浏览器 `PublicKeyCredential` 序列化为 JSON
  - 编码 `rawId`、`response.attestationObject`、`response.clientDataJSON` 为 Base64URL
  - 提取 `transports` 信息
- `serializeAuthenticationCredential` — 将浏览器认证响应序列化为 JSON
  - 编码 `rawId`、`response.authenticatorData`、`response.clientDataJSON`、`response.signature`、`response.userHandle`
- `ensureWebauthnSupport` — 检查浏览器是否支持 WebAuthn

### Auth Store (`frontend/src/stores/authStore.ts`)

扩展了以下方法：

- `passkeyAvailable` signal — 控制登录页是否显示 Passkey 按钮
- `loginWithPasskey()` — Passkey 认证完整流程
- `registerPasskey(name?)` — Passkey 注册完整流程
- `listPasskeys()` — 获取已注册 Passkey 列表
- `deletePasskey(id)` — 删除指定 Passkey

### 登录页面 (`frontend/src/components/LoginPage.tsx`)

- 当 `passkeyAvailable` 为 `true` 时，在密码表单下方显示分隔线和 "Sign in with Passkey" 按钮
- Passkey 按钮独立于密码表单的提交流程

### 类型定义 (`frontend/src/types/app.ts`)

```typescript
interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
  sessionTimeoutMinutes?: number;
  passkeyAvailable: boolean;
}

interface PasskeyCredentialSummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface PasskeyListResponse {
  credentials: PasskeyCredentialSummary[];
}

interface PasskeyCeremonyStart<T = unknown> {
  requestId: string;
  options: T;
}
```

---

## 后端文件结构

```
src/
├── passkey.rs              # Passkey 核心逻辑
│   ├── PasskeyState        # 应用状态（凭据存储、challenge 缓存）
│   ├── PasskeySiteConfig   # RP ID / Origin 配置
│   ├── build_passkey_state  # 初始化状态
│   ├── build_passkey_site   # 解析并验证 origin
│   ├── resolve_passkey_origin # 决定 origin（环境变量/CLI/默认）
│   ├── passkey_register_start/finish  # 注册 handler
│   ├── passkey_login_start/finish     # 认证 handler
│   ├── passkey_list         # 列表 handler
│   └── passkey_delete       # 删除 handler
├── handlers/
│   └── passkey_handler.rs   # Handler re-export 层
├── auth.rs                  # 认证中间件
│   ├── is_public_path()     # 包含 passkey login 路径
│   ├── AuthStatusResponse   # 包含 passkeyAvailable 字段
│   └── passkey_available()  # 检查是否有已注册凭据
└── lib.rs                   # AppState 包含 passkey 字段
```

---

## Relying Party 配置

### Origin 解析优先级

1. 环境变量 `OPENMKVIEW_PASSKEY_ORIGIN`
2. 自动推断：`http://{host}:{port}`
   - `0.0.0.0` / `::` / `[::]` 映射为 `localhost`
   - IPv6 地址自动加方括号

### 验证规则

- 必须是 `http` 或 `https` scheme
- 不能包含路径（只允许 `/`）
- 不能包含 query string 或 fragment
- 不能包含用户名/密码
- RP ID 从 origin 的 host 提取

### Origin 检查

每次注册/认证 ceremony 开始时，检查实际请求的 origin 是否与配置的 origin 匹配：
- scheme 必须一致
- host 必须一致
- port 必须一致（考虑默认端口 80/443）
- 支持 `X-Forwarded-Host` 和 `X-Forwarded-Proto` 反向代理 header

---

## Challenge 管理

- 每个 ceremony（注册/认证）生成唯一 `requestId`（UUID v4）
- Challenge 存储在内存中，与 session 类似使用 `Arc<Mutex<HashMap>>`
- 默认超时 300 秒
- 每次新 ceremony 开始时清理过期 challenge
- `finish` 端点消费 challenge 后立即从 map 中移除（one-time use）

---

## 初始化流程

```
main.rs: run_server()
  ├── resolve_passkey_origin()     # 确定 origin
  ├── resolve_auth_config()        # 解析认证配置
  ├── build_auth_state()           # 构建认证状态
  ├── build_passkey_site()         # 验证并构建 site 配置
  ├── build_passkey_state()        # 加载凭据存储，验证 auth binding
  └── AppState { passkey: Some(Arc<PasskeyState>) }
```

Passkey 仅在认证启用时初始化。如果认证未启用（`auth = None`），则 `passkey = None`。

---

## 错误处理

| 场景 | 错误类型 | 消息 |
|------|----------|------|
| 认证未启用 | `BadRequest` | 当前未启用登录认证 |
| Passkey 未启用 | `BadRequest` | 当前未启用 Passkey |
| 无可用凭据 | `BadRequest` | 当前没有可用的 Passkey |
| Origin 不匹配 | `BadRequest` | 当前访问地址与 Passkey 配置不一致 |
| Challenge 过期 | `BadRequest` | Passkey 注册/登录请求已过期，请重试 |
| 验证失败 | `Unauthorized` | Passkey 验证失败 |
| 凭据已存在 | `Conflict` | 该 Passkey 已经注册过了 |
| 凭据不存在 | `NotFound` | 指定的 Passkey 不存在 |
| 内部状态损坏 | `InternalError` | Passkey 状态已损坏 |

---

## 测试覆盖

### 单元测试（`src/passkey.rs`）

- `default_passkey_origin_maps_wildcard_hosts_to_localhost` — 通配地址映射
- `default_passkey_origin_wraps_ipv6_addresses` — IPv6 地址处理
- `resolve_passkey_origin_prefers_configured_value` — 配置优先级
- `resolve_passkey_origin_ignores_blank_configured_value` — 空值过滤
- `build_passkey_site_rejects_non_origin_url` — 非法 origin 拒绝
- `build_passkey_site_accepts_plain_origin` — 合法 origin 接受
- `ensure_request_origin_accepts_exact_match` — 精确匹配
- `ensure_request_origin_rejects_mismatched_host` — host 不匹配
- `ensure_request_origin_rejects_mismatched_scheme` — scheme 不匹配
- `ensure_request_origin_normalizes_default_https_port` — 默认端口规范化
- `ensure_request_origin_uses_forwarded_headers` — 反向代理支持

---

## 使用指南

### 注册 Passkey

1. 使用用户名/密码登录
2. 进入设置页面的 Passkey 管理区域
3. 点击注册按钮，浏览器弹出 Passkey 创建对话框
4. 完成生物识别/PIN 验证

### 使用 Passkey 登录

1. 在登录页面点击 "Sign in with Passkey"
2. 浏览器弹出 Passkey 选择对话框
3. 完成生物识别/PIN 验证
4. 自动登录

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `OPENMKVIEW_PASSKEY_ORIGIN` | 覆盖自动推断的 origin | `https://mkview.example.com` |

### 反向代理配置

当通过 Nginx 等反向代理访问时，需要：
1. 设置 `OPENMKVIEW_PASSKEY_ORIGIN` 为实际访问地址
2. 确保反向代理传递 `X-Forwarded-Host` 和 `X-Forwarded-Proto` header
