# Fix Broken Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作区工具栏新增「修复 X 处提示」按钮，点击后弹出 `FixBrokenDialog`，依次重新生成所有有警告的教案并原位替换，完成后显示摘要。

**Architecture:** 在 `useTeachingBook` 中新增 `regenerateLesson(id)` 用于原位替换单篇；新建 `FixBrokenDialog.vue` 负责进度显示（confirm → running → done/error）；`WorkspaceToolbar` 新增 `fixBroken` emit 与条件显示按钮；`WorkspaceView` 协调状态并驱动循环。

**Tech Stack:** Vue 3 + TypeScript，与现有 BatchGenerateDialog 模式保持一致。

---

## File Structure

| 文件 | 操作 |
|---|---|
| `src/composables/useTeachingBook.ts` | 修改：新增 `regenerateLesson`，接口加 `regenerateLesson` |
| `src/components/FixBrokenDialog.vue` | 新建：修复进度对话框 |
| `src/components/WorkspaceToolbar.vue` | 修改：新增 `fixBroken` emit 与按钮 |
| `src/components/WorkspaceView.vue` | 修改：新增 fix 状态与处理逻辑 |

---

## Task 1: `regenerateLesson` in `useTeachingBook.ts`

**Files:**
- Modify: `src/composables/useTeachingBook.ts`

- [ ] **Step 1: 在 `TeachingBookStore` 接口加入 `regenerateLesson`**

在 `generateLesson` 行下方追加：

```typescript
  regenerateLesson: (id: DesignId) => Promise<GenerateLessonResult>
```

- [ ] **Step 2: 实现 `regenerateLesson` 函数**

在 `generateLesson` 函数后插入（`return {` 之前）：

```typescript
  async function regenerateLesson(id: DesignId): Promise<GenerateLessonResult> {
    const existing = book.value.designs.find((d) => d.id === id)
    if (!existing) return { ok: false, message: '找不到该教案。' }

    const topic = existing.originalFilename.replace(/\.md$/i, '')
    try {
      const result = await booksApi.generateLesson(topic)
      const newDesign = parseTeachingDesign(result.filename, result.markdown)
      const index = book.value.designs.findIndex((d) => d.id === id)
      if (index !== -1) {
        book.value.designs.splice(index, 1, newDesign)
        if (book.value.selectedId === id) {
          book.value.selectedId = newDesign.id
        }
      }
      touch()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '修复失败。' }
    }
  }
```

- [ ] **Step 3: 在 `return` 对象中暴露 `regenerateLesson`**

在 `generateLesson,` 行之后加一行：

```typescript
    regenerateLesson,
```

- [ ] **Step 4: 运行测试确认无破坏**

```bash
bun run test -- src/composables/useTeachingBook.test.ts
```

期望：全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/composables/useTeachingBook.ts
git commit -m "feat: add regenerateLesson to useTeachingBook"
```

---

## Task 2: 新建 `FixBrokenDialog.vue`

**Files:**
- Create: `src/components/FixBrokenDialog.vue`

- [ ] **Step 1: 创建组件文件**

内容如下：

```vue
<script setup lang="ts">
import { watch, ref } from 'vue'

type Phase = 'confirm' | 'running' | 'done' | 'error'

const props = defineProps<{
  running: boolean
  done: number
  total: number
  currentTopic: string
  error: string | null
}>()

const emit = defineEmits<{
  start: []
  cancel: []
  close: []
}>()

const phase = ref<Phase>('confirm')

watch(
  () => props.running,
  (val) => {
    if (val) {
      phase.value = 'running'
    } else if (phase.value === 'running') {
      phase.value = props.error ? 'error' : 'done'
    }
  },
)

function handleClose(): void {
  phase.value = 'confirm'
  emit('close')
}
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="fix-dialog-title">
    <div class="dialog">
      <h2 id="fix-dialog-title">修复问题教案</h2>

      <!-- 确认 -->
      <template v-if="phase === 'confirm'">
        <p>共 <strong>{{ total }}</strong> 篇教案存在解析问题，点击开始将重新生成并原位替换。</p>
        <div class="dialog-actions">
          <button type="button" @click="emit('start')">开始修复</button>
          <button type="button" @click="emit('close')">取消</button>
        </div>
      </template>

      <!-- 修复中 -->
      <template v-else-if="phase === 'running'">
        <p class="batch-progress-label">
          正在修复第 <strong>{{ done + 1 }}</strong> / {{ total }} 篇
        </p>
        <p class="batch-current-topic">{{ currentTopic }}</p>
        <div class="batch-progress-bar">
          <div class="batch-progress-fill" :style="{ width: `${(done / total) * 100}%` }" />
        </div>
        <div class="dialog-actions">
          <button type="button" @click="emit('cancel')">停止</button>
        </div>
      </template>

      <!-- 出错 -->
      <template v-else-if="phase === 'error'">
        <p class="app-notice app-notice--error" role="alert">{{ error }}</p>
        <p>已修复 {{ done }} / {{ total }} 篇，修复中止。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>

      <!-- 完成 -->
      <template v-else-if="phase === 'done'">
        <p>已修复 <strong>{{ done }}</strong> / {{ total }} 篇教案。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FixBrokenDialog.vue
git commit -m "feat: add FixBrokenDialog component"
```

---

## Task 3: WorkspaceToolbar — 新增修复按钮

**Files:**
- Modify: `src/components/WorkspaceToolbar.vue`

- [ ] **Step 1: 新增 `fixBroken` emit**

把 `defineEmits` 改为：

```typescript
defineEmits<{
  upload: []
  print: []
  export: []
  clear: []
  generate: []
  batchGenerate: []
  fixBroken: []
  back: []
}>()
```

- [ ] **Step 2: 在 `warningCount` span 前加修复按钮**

把：

```html
    <span v-if="warningCount > 0" class="workspace-toolbar-warning">
      {{ warningCount }} 处提示
    </span>
```

替换为：

```html
    <template v-if="warningCount > 0">
      <button type="button" data-testid="fix-broken" @click="$emit('fixBroken')">
        修复 {{ warningCount }} 处提示
      </button>
    </template>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkspaceToolbar.vue
git commit -m "feat: add fix-broken button to WorkspaceToolbar"
```

---

## Task 4: WorkspaceView — 协调 fix 流程

**Files:**
- Modify: `src/components/WorkspaceView.vue`

- [ ] **Step 1: import FixBrokenDialog**

在现有 import 列表里加（与 `BatchGenerateDialog` 相邻）：

```typescript
import FixBrokenDialog from './FixBrokenDialog.vue'
```

- [ ] **Step 2: 解构 `regenerateLesson`**

在 `useTeachingBook` 解构对象中加：

```typescript
  regenerateLesson,
```

- [ ] **Step 3: 新增 fix 状态 refs**

在 `batchCancelled` ref 之后插入：

```typescript
const showFixDialog = ref(false)
const fixRunning = ref(false)
const fixDone = ref(0)
const fixTotal = ref(0)
const fixCurrentTopic = ref('')
const fixError = ref<string | null>(null)
const fixCancelled = ref(false)
```

- [ ] **Step 4: 新增 fix 处理函数**

在 `closeBatchDialog` 函数之后插入：

```typescript
function openFixDialog(): void {
  fixTotal.value = book.value.designs.filter((d) => d.warnings.length > 0).length
  fixDone.value = 0
  fixError.value = null
  showFixDialog.value = true
}

async function handleFixStart(): Promise<void> {
  const broken = book.value.designs.filter((d) => d.warnings.length > 0)
  fixCancelled.value = false
  fixRunning.value = true

  for (const lesson of broken) {
    if (fixCancelled.value) break
    fixCurrentTopic.value = lesson.originalFilename.replace(/\.md$/i, '')
    const result = await regenerateLesson(lesson.id)
    if (!result.ok) {
      fixError.value = result.message
      break
    }
    fixDone.value++
  }

  fixRunning.value = false
}

function handleFixCancel(): void {
  fixCancelled.value = true
}

function closeFixDialog(): void {
  showFixDialog.value = false
  fixDone.value = 0
  fixTotal.value = 0
  fixError.value = null
}
```

- [ ] **Step 5: 在 template 中挂载 FixBrokenDialog**

在 `<BatchGenerateDialog ... />` 之后加：

```html
      <FixBrokenDialog
        v-if="showFixDialog"
        :running="fixRunning"
        :done="fixDone"
        :total="fixTotal"
        :current-topic="fixCurrentTopic"
        :error="fixError"
        @start="handleFixStart"
        @cancel="handleFixCancel"
        @close="closeFixDialog"
      />
```

- [ ] **Step 6: 在 WorkspaceToolbar 上绑定 `@fix-broken`**

把：

```html
        @batch-generate="showBatchDialog = true"
```

改为：

```html
        @batch-generate="showBatchDialog = true"
        @fix-broken="openFixDialog"
```

- [ ] **Step 7: 运行全量测试**

```bash
bun run test
```

期望：`markdownTable`、`markdownParser`、`useTeachingBook`、`PrintBook` 相关测试全部通过（App.test.ts 的 2 个已知失败不影响）。

- [ ] **Step 8: Commit**

```bash
git add src/components/WorkspaceView.vue
git commit -m "feat: wire fix-broken flow in WorkspaceView"
```
