# 教学设计生成器后端（Bun + SQLite）设计方案

## 1. 建设目标

在现有 Vue 3 + TypeScript + Vite 教学设计生成器基础上，新增一个 Bun 后端服务，使用 SQLite 持久化保存多本「教学设计整本」（课程名称、教师姓名、全部教案及顺序）。用户可以创建、打开、重命名、删除多本整本，并在编辑时自动保存到服务器。同时新增「输入主题生成教案」功能，调用 Deepseek API 生成符合现有模板结构的 Markdown 教案，解析后作为新课时加入当前整本。

前端原有的解析、编辑、打印、ZIP 导出逻辑保持不变，仅将持久化层从浏览器 `localStorage` 切换为服务器 API。

## 2. 现状与变更范围

当前系统（见 [2026-06-15-printable-teaching-design-generator-design.md](2026-06-15-printable-teaching-design-generator-design.md)）是纯前端应用：

- `useTeachingBook` 管理单一 `TeachingBook`（封面 + 教案数组 + 选中页 + 排序）。
- `bookStorage.ts` 将该 `TeachingBook` 序列化存入 `localStorage`，刷新后通过 `RestoreDraftDialog` 提示恢复。
- 上传、解析、编辑、打印、导出 ZIP 均在浏览器本地完成。

本次变更：

- 新增 Bun + Hono + `bun:sqlite` 后端，提供整本的增删改查 API 和 AI 生成 API。
- 移除 `bookStorage.ts`、`RestoreDraftDialog.vue` 及相关 localStorage 逻辑。
- 新增整本列表页作为应用入口，新增「生成教案」对话框。
- `useTeachingBook` 改为基于 `bookId` 从服务器加载/保存数据。
- 教案的解析（`markdownParser`）、生成（`markdownWriter`）、打印（`PrintBook`）、ZIP 导出（`zipExporter`）等服务保持不变，AI 生成的 Markdown 同样通过 `parseTeachingDesign` 解析，复用既有容错与警告机制。

`data/` 目录下的语料教案由用户通过现有上传功能手动导入到某个整本中，服务器不直接读取或预置 `data/` 内容。

## 3. 核心产品决策

- 不引入用户账号体系，所有人访问同一个后端，看到同一份整本列表。
- 整本以「列表 -> 选择/新建 -> 工作区」的方式使用：进入应用先看到整本列表，选择或新建后进入现有工作区，编辑期间自动保存到该整本。
- 删除整本是显式操作（列表页确认），与工作区内的「清空当前整本内容」（清空教案列表但保留整本记录）是两个不同操作。
- 「生成教案」是工作区工具栏的一个按钮：输入主题 -> 调用 Deepseek -> 解析为新教案 -> 加入当前整本课次列表末尾，用户可继续手动编辑。
- 生成失败、保存失败、列表加载失败均以非破坏性提示展示，不清除已有的整本内容或编辑状态。

## 4. 技术方案

技术栈：

- 前端：Vue 3、TypeScript、Vite（不变）
- 后端：Bun 运行时 + Hono 路由框架 + `bun:sqlite`
- AI 生成：Deepseek Chat Completion API，密钥通过服务器端环境变量 `DEEPSEEK_API_KEY`（`.env`，不提交到仓库）配置
- 数据传输：JSON over HTTP，前端通过 `fetch` 调用 `/api/*`

开发环境：Vite dev server 通过代理将 `/api` 转发到本地 Bun 服务（端口 3001）。生产环境：`bun run server/index.ts` 同时提供 API 与 `vite build` 产出的静态文件。

## 5. 数据库设计

SQLite 数据库文件位于 `data/teaching-books.db`（加入 `.gitignore`）。

```sql
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data TEXT NOT NULL,        -- JSON 序列化的 TeachingBook（schemaVersion、cover、designs、selectedId、updatedAt）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- `data` 字段直接复用前端 `TeachingBook` 的 JSON 结构，不做字段级拆表，避免引入与前端模型重复维护的风险。
- `name` 是整本在列表页展示的名称，与 `TeachingBook.cover.courseName` 独立（前者用于管理，后者用于打印封面）。
- `updated_at` 在每次 `PUT /api/books/:id` 时更新，用于列表页排序和展示。

## 6. 后端 API

所有响应为 JSON；出错时返回 `{ "error": "<message>" }` 及合适的 4xx/5xx 状态码。

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|---|---|---|---|---|
| GET | `/api/books` | - | `{ id, name, updatedAt, lessonCount }[]` | 按 `updated_at` 倒序列出整本 |
| POST | `/api/books` | `{ name }` | `{ id, name, updatedAt, data: TeachingBook }` | 创建整本，`data` 为 `createEmptyBook()` |
| GET | `/api/books/:id` | - | `{ id, name, updatedAt, data: TeachingBook }` | 加载整本；不存在返回 404 |
| PUT | `/api/books/:id` | `{ data: TeachingBook }` | `{ id, name, updatedAt }` | 覆盖保存 `data`，更新 `updated_at` |
| PATCH | `/api/books/:id` | `{ name }` | `{ id, name, updatedAt }` | 重命名整本 |
| DELETE | `/api/books/:id` | - | `{ ok: true }` | 删除整本 |
| POST | `/api/generate` | `{ topic }` | `{ filename, markdown }` | 调用 Deepseek 生成教案 Markdown |

`POST /api/generate` 实现要点：

- 服务器构造提示词，要求 Deepseek 按照现有教案模板结构（一级标题、基本信息表、`## 教学过程` 五列表、`## 板书设计`、`## 教学成效与反思`）输出 Markdown，主题信息来自请求中的 `topic`。
- `filename` 由主题派生（例如 `<topic>.md`），用于 `parseTeachingDesign(filename, markdown)` 和后续 ZIP 导出时的文件名；与现有课时文件名重复时沿用现有「keep」策略，由前端导入逻辑处理。
- Deepseek 请求失败（网络错误、超时、鉴权失败、限流）统一返回 `502`，`error` 信息可展示给用户。

## 7. 前端变更

### 7.1 `src/services/booksApi.ts`（新增）

封装上述 API 的 `fetch` 调用，返回类型与后端响应一致，统一抛出带 `message` 的错误供调用方捕获。

### 7.2 `src/components/BookListPage.vue`（新增）

应用入口页面：

- 加载并展示整本列表（名称、更新时间、课时数）。
- 「新建整本」：输入名称 -> `POST /api/books` -> 直接进入该整本的工作区。
- 每行提供「打开」「重命名」「删除」（删除需二次确认）。
- 列表加载失败时显示错误提示和重试按钮。

### 7.3 `useTeachingBook` 重写

- 接收 `bookId`，初始化时 `GET /api/books/:id` 加载 `TeachingBook`。
- 响应式变化后按 300ms 防抖调用 `PUT /api/books/:id` 保存整本 `data`，`saveStatus` 含义不变（`idle | saving | saved | error`）。
- 移除 `restore`、`pendingDuplicateFiles` 中与本地草稿恢复相关的逻辑；导入重名提示对话框（`ImportConflictDialog`）保留。
- `clearBook()` 语义不变：清空当前整本的 `designs`，仍保存到同一个整本记录。
- 新增 `generateLesson(topic)`：调用 `POST /api/generate`，成功后 `parseTeachingDesign` 解析并 `push` 到 `designs`，选中新教案；失败时设置错误提示，不影响现有数据。

### 7.4 `src/components/GenerateLessonDialog.vue`（新增）

- 输入主题文本框 + 确认/取消。
- 提交后显示加载状态；Deepseek 调用失败在对话框内显示错误并允许重试，不关闭对话框。

### 7.5 `WorkspaceToolbar.vue`

- 新增「生成教案」按钮，打开 `GenerateLessonDialog`。
- 新增「返回列表」按钮，回到 `BookListPage`（不删除当前整本，依赖已有自动保存）。

### 7.6 `App.vue`

- 用本地 `ref` 在 `BookListPage` 与现有工作区（`WorkspaceToolbar` + `LessonSidebar` + `A4Workspace` + `PrintBook`）之间切换，不引入路由库。
- 进入工作区时把选中的 `bookId` 传给 `useTeachingBook`。

### 7.7 移除内容

- `src/services/bookStorage.ts` 及 `bookStorage.test.ts`
- `src/components/RestoreDraftDialog.vue`
- `useTeachingBook` 中与 localStorage 相关的逻辑及对应测试用例（替换为针对 `booksApi` 的 mock 测试）

## 8. 开发与构建流程

- `vite.config.ts` 增加开发代理：`/api` -> `http://localhost:3001`。
- `package.json` 新增依赖 `hono`，新增脚本：
  - `"server": "bun run server/index.ts"`（生产/手动启动）
  - `"server:dev": "bun --watch run server/index.ts"`（开发时热重载）
  - `"test:server": "bun test server"`
- 开发时需要同时运行 `npm run dev`（Vite）与 `npm run server:dev`（Bun API），两者为独立进程。
- 生产构建：`vite build` 产出 `dist/`；`server/index.ts` 中 Hono 应用对未匹配 `/api/*` 的请求回退为静态文件服务（`dist/`），单进程 `bun run server/index.ts` 即可部署。
- `DEEPSEEK_API_KEY` 通过项目根目录 `.env`（Bun 自动加载，加入 `.gitignore`）配置；缺失时 `/api/generate` 返回 `500` 并提示未配置。

## 9. 错误处理与状态反馈

- 后端：所有路由捕获异常，返回 `{ error }` 及对应状态码（400 参数错误、404 整本不存在、500 数据库/配置错误、502 Deepseek 调用失败）。
- 前端列表页：加载/创建/重命名/删除失败时显示错误提示，不影响已渲染的列表。
- 前端工作区：
  - 加载整本失败（404/网络错误）显示错误并提供返回列表入口。
  - 自动保存失败时 `saveStatus = 'error'`，工具栏显示提示，内存中的编辑内容保留，下次变更会重试保存。
  - 生成教案失败在对话框内提示，不影响已有课次。

## 10. 测试策略

### 10.1 前端（Vitest，不变的运行方式）

- `useTeachingBook.test.ts`：mock `booksApi`，覆盖加载、自动保存防抖、`generateLesson` 成功/失败、`clearBook`。
- `BookListPage.test.ts`（新增）：覆盖列表渲染、创建、重命名、删除、错误提示。
- `GenerateLessonDialog.test.ts`（新增）：覆盖提交、加载状态、错误显示与重试。
- `WorkspaceToolbar.test.ts`：补充「生成教案」「返回列表」按钮的事件触发断言。
- 既有解析器、写出器、ZIP 导出、打印组件测试不变。

### 10.2 后端（`bun:test`）

- `server/db.test.ts`：使用 `:memory:` SQLite，验证表初始化与基本读写。
- `server/routes/books.test.ts`：覆盖列表、创建、获取（含 404）、保存、重命名、删除的完整 CRUD 行为。
- `server/routes/generate.test.ts`：mock `fetch` 模拟 Deepseek 响应，覆盖成功解析、Deepseek 错误（502）、缺失 API Key（500）。

### 10.3 手动验证

- 启动 `server:dev` 与 `dev`，在浏览器中：创建整本 -> 上传 `data/Web` 教案 -> 编辑并确认自动保存（刷新后内容仍存在）-> 使用「生成教案」输入主题并检查生成的课次结构 -> 返回列表确认整本出现并显示正确的更新时间和课时数 -> 删除整本并确认从列表移除。

## 11. 验收标准

- 应用启动后先显示整本列表，可创建、打开、重命名、删除整本。
- 进入某个整本后，原有上传、编辑、拖拽排序、打印、ZIP 导出功能行为不变。
- 编辑内容在 300ms 防抖后通过 API 保存到 SQLite，刷新页面后从服务器恢复，不再依赖 `localStorage`。
- 工具栏「生成教案」可输入主题，调用 Deepseek 生成 Markdown 并作为新课时加入当前整本，解析结果应用既有警告机制。
- 后端、前端的新增/修改测试均通过（`npm test` 与 `bun test server`）。
- 生产构建后单一 `bun run server/index.ts` 进程即可同时提供 API 与前端静态资源。
