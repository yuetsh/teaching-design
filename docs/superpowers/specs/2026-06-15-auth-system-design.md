# 用户账号系统设计

**日期：** 2026-06-15  
**状态：** 已批准

## 背景

项目现状：Vue 前端 + Hono/Bun 后端 + SQLite，所有数据对任何人开放访问，无任何认证。目标是加入登录门禁，防止陌生人访问，但所有登录用户共享同一份数据。

## 核心决策

- 多用户账号，存数据库，管理员创建账号（不开放注册）
- access token（JWT，15分钟）+ refresh token（随机UUID入库，7天）双 token 方案
- refresh token hash 后存库，支持撤销

---

## 一、数据库 Schema

在现有 `books` 表旁新增两张表，在 `server/db.ts` 的 `SCHEMA` 中追加：

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

**初始 admin 账号：** 服务启动时读取环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，若 users 表中不存在该用户名则自动写入。密码用 bcrypt hash 存储。

---

## 二、服务端 API

### 新增文件

- `server/auth.ts` — JWT 签发/验证、bcrypt、token CRUD 的纯函数
- `server/middleware/auth.ts` — Hono 中间件（验证 Bearer token，注入 user 到 context）
- `server/routes/auth.ts` — `/api/auth/*` 路由
- `server/routes/admin.ts` — `/api/admin/*` 路由

### 端点列表

| 方法 | 路径 | 说明 | 认证要求 |
|------|------|------|----------|
| POST | `/api/auth/login` | 登录，返回 access + refresh token | 无 |
| POST | `/api/auth/refresh` | 换新 access token | 无（带 refresh token） |
| POST | `/api/auth/logout` | 撤销当前 refresh token | Bearer |
| GET  | `/api/auth/me` | 返回当前用户信息 | Bearer |
| GET  | `/api/admin/users` | 列出所有用户 | Admin only |
| POST | `/api/admin/users` | 创建新用户 | Admin only |
| DELETE | `/api/admin/users/:id` | 删除用户 | Admin only |

### 现有路由保护

`/api/books/*` 和 `/api/generate/*` 全部加上 auth 中间件，未认证返回 401。

### Token 规格

- **access token**：JWT，HS256，payload `{ userId, role, exp: now+15min }`，密钥来自环境变量 `JWT_SECRET`
- **refresh token**：`crypto.randomUUID()`，SHA-256 hash 后存 `refresh_tokens` 表，原始值返回给客户端

---

## 三、前端

### 新增文件

- `src/composables/useAuth.ts` — token 管理、登录/登出/刷新逻辑
- `src/components/LoginPage.vue` — 登录表单
- `src/components/AdminPage.vue` — 用户管理页（admin 专属）

### 修改文件

- `src/App.vue` — 根据登录状态切换渲染 LoginPage 或主应用
- `src/services/booksApi.ts` — 所有请求加 `Authorization` header，401 时触发 refresh

### useAuth composable 行为

- localStorage 存 `access_token` 和 `refresh_token`
- 导出：`isLoggedIn`（computed）、`user`（ref）、`login()`、`logout()`
- 提供 `authedFetch()` 封装：自动带 token，遇 401 先尝试 refresh，refresh 失败则清除 token 跳登录页

### AdminPage

- 仅当 `user.role === 'admin'` 时在主界面显示入口
- 功能：列出所有用户、创建账号（用户名+密码）、删除账号（不能删除自己）

---

## 四、环境变量

`.env` 新增：

```
JWT_SECRET=<随机长字符串>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<初始密码>
```

---

## 五、依赖

- `jsonwebtoken` 或 Hono 自带的 `hono/jwt` — JWT 操作
- `bcryptjs` — 密码 hash（纯 JS，兼容 Bun）

---

## 六、不在本次范围内

- 修改密码功能
- 邮件验证
- 多 admin 角色权限细分
