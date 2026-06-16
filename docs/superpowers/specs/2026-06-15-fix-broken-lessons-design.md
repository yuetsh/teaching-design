# 一键修复问题教案 设计文档

**日期：** 2026-06-15  
**背景：** 批量生成时，AI（deepseek-v4-flash）偶尔生成格式异常的 Markdown（基础信息表以 `|:---|:---|` 开头，无表头行），导致解析器无法提取课题、课时等字段，产生警告（warnings）。用户需要一键重新生成所有有警告的教案并原位替换。

---

## 功能描述

在工作区工具栏新增"修复 X 篇问题教案"按钮，仅当当前整本有警告教案时显示。点击后弹出 `FixBrokenDialog`，列出问题教案数量，用户确认后依次重新生成并原位替换，完成后显示摘要。

---

## 数据层：`useTeachingBook.ts`

新增 `regenerateLesson(id: DesignId): Promise<GenerateLessonResult>`：

1. 根据 `id` 查找教案，取 `originalFilename`（去掉 `.md` 后缀）作为 topic
2. 调用 `booksApi.generateLesson(topic)` 获取新 Markdown
3. 用 `parseTeachingDesign` 解析
4. 在 `book.value.designs` 中原位替换（`splice`）
5. 若当前选中的是该教案，更新 `selectedId` 为新教案的 id
6. 调用 `touch()` 触发自动保存
7. 返回 `{ ok: true }` 或 `{ ok: false, message }`

暴露于 `TeachingBookStore` 接口。

---

## 新组件：`FixBrokenDialog.vue`

**Props：**
- `running: boolean`
- `done: number`
- `total: number`
- `currentTopic: string`
- `error: string | null`

**Emits：**
- `start: []` — 确认开始修复
- `cancel: []` — 取消（仅 running 阶段）
- `close: []` — 关闭对话框

**Phase 状态（组件内部）：**

| phase | 触发条件 | 显示内容 |
|---|---|---|
| `confirm` | 初始 | "共 X 篇教案有问题，重新生成可修复。" + 开始/取消按钮 |
| `running` | `start` emit 后，`running=true` | 进度条 + "正在修复第 X/Y 篇" + 当前课题 + 停止按钮 |
| `done` | `running` 变为 false 且无 error | "已修复 Y 篇教案。" + 关闭按钮 |
| `error` | `running` 变为 false 且有 error | 错误信息 + "已完成 X/Y 篇" + 关闭按钮 |

phase 切换逻辑与 `BatchGenerateDialog` 保持一致（watch `props.running`）。

---

## 修改：`WorkspaceToolbar.vue`

- 新增 prop：`warningCount: number`（已有）
- 新增 emit：`fix-broken: []`
- 新增按钮：仅当 `warningCount > 0` 时显示，文案 `修复 {{ warningCount }} 处提示`

---

## 修改：`WorkspaceView.vue`

新增状态：
- `showFixDialog: boolean`
- `fixRunning: boolean`
- `fixDone: number`
- `fixTotal: number`
- `fixCurrentTopic: string`
- `fixError: string | null`
- `fixCancelled: boolean`

新增 `handleFixStart()`：

```
brokenLessons = book.designs.filter(d => d.warnings.length > 0)
fixTotal = brokenLessons.length
fixDone = 0
fixRunning = true
for each lesson:
  if fixCancelled: break
  fixCurrentTopic = topic
  result = await regenerateLesson(lesson.id)
  if !result.ok: fixError = result.message; break
  fixDone++
fixRunning = false
```

新增 `closeFixDialog()`：重置状态，关闭对话框。

---

## 文件变更

| 文件 | 操作 |
|---|---|
| `src/composables/useTeachingBook.ts` | 新增 `regenerateLesson` |
| `src/components/FixBrokenDialog.vue` | 新建 |
| `src/components/WorkspaceToolbar.vue` | 新增 fix-broken emit 与按钮 |
| `src/components/WorkspaceView.vue` | 新增 fix 状态与处理逻辑 |

---

## 错误处理

- 单篇失败：记录 `fixError`，中止后续修复，进入 error phase（已完成的保留）
- 网络超时：同上，由 `booksApi.generateLesson` 抛出异常捕获
- 用户取消：设置 `fixCancelled = true`，当前篇完成后停止，进入 done phase（不视为 error）

---

## 不在范围内

- 每篇修复结果的详细日志（仅显示总数）
- 单篇教案的独立修复按钮（侧边栏）
- 修复前预览差异
