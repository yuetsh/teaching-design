<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as booksApi from '../services/booksApi'
import type { BookSummary } from '../services/booksApi'
import { useAuth } from '../composables/useAuth'

type LoadStatus = 'loading' | 'loaded' | 'error'

const emit = defineEmits<{ open: [id: string]; admin: [] }>()
const { user, logout } = useAuth()

const books = ref<BookSummary[]>([])
const loadStatus = ref<LoadStatus>('loading')
const loadError = ref<string | null>(null)

const newBookName = ref('')
const actionError = ref<string | null>(null)

const renamingId = ref<string | null>(null)
const renameValue = ref('')

const cstDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function formatCstUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const parts = Object.fromEntries(
    cstDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${parts.year}/${parts.month}/${parts.day}`
}

async function loadBooks(): Promise<void> {
  loadStatus.value = 'loading'
  try {
    books.value = await booksApi.listBooks()
    loadStatus.value = 'loaded'
  } catch (error) {
    loadStatus.value = 'error'
    loadError.value = error instanceof Error ? error.message : '加载失败。'
  }
}

onMounted(loadBooks)

async function createBook(): Promise<void> {
  const name = newBookName.value.trim()
  if (!name) return

  try {
    const created = await booksApi.createBook(name)
    newBookName.value = ''
    emit('open', created.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '创建失败。'
  }
}

function startRename(book: BookSummary): void {
  renamingId.value = book.id
  renameValue.value = book.name
}

function cancelRename(): void {
  renamingId.value = null
}

async function confirmRename(): Promise<void> {
  const id = renamingId.value
  const name = renameValue.value.trim()
  if (!id || !name) return

  try {
    const updated = await booksApi.renameBook(id, name)
    const target = books.value.find((book) => book.id === id)
    if (target) target.name = updated.name
    renamingId.value = null
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '重命名失败。'
  }
}

async function removeBook(book: BookSummary): Promise<void> {
  if (!window.confirm(`确定要删除「${book.name}」吗？此操作无法撤销。`)) return

  try {
    await booksApi.deleteBook(book.id)
    books.value = books.value.filter((entry) => entry.id !== book.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '删除失败。'
  }
}
</script>

<template>
  <div class="book-list-page app-page">
    <div class="app-page-header">
      <h1>教学设计</h1>
      <div class="app-page-actions">
        <button v-if="user?.role === 'admin'" class="ui-button" type="button" @click="emit('admin')">
          用户管理
        </button>
        <button class="ui-button" type="button" @click="logout">退出登录</button>
      </div>
    </div>

    <form class="book-list-create" @submit.prevent="createBook">
      <input
        v-model="newBookName"
        class="ui-field"
        type="text"
        placeholder="新整本名称"
        aria-label="新整本名称"
      />
      <button class="ui-button ui-button--primary" type="submit">新建整本</button>
    </form>

    <p v-if="actionError" class="app-notice app-notice--error" role="alert">
      {{ actionError }}
      <button type="button" @click="actionError = null">关闭</button>
    </p>

    <p v-if="loadStatus === 'loading'">加载中…</p>

    <div v-else-if="loadStatus === 'error'" class="app-notice app-notice--error" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" data-testid="retry" @click="loadBooks">重试</button>
    </div>

    <template v-else>
      <p v-if="books.length === 0">还没有整本，创建一个开始使用。</p>

      <ul v-else class="book-list">
        <li v-for="book in books" :key="book.id" class="book-list-item">
          <template v-if="renamingId === book.id">
            <input v-model="renameValue" class="ui-field" type="text" aria-label="整本名称" />
            <button
              class="ui-button"
              type="button"
              :data-testid="`confirm-rename-${book.id}`"
              @click="confirmRename"
            >
              保存
            </button>
            <button class="ui-button" type="button" @click="cancelRename">取消</button>
          </template>
          <template v-else>
            <span class="book-list-name">{{ book.name }}</span>
            <span class="book-list-meta">更新于 {{ formatCstUpdatedAt(book.updatedAt) }} · {{ book.lessonCount }} 课</span>
            <button class="ui-button" type="button" :data-testid="`open-${book.id}`" @click="emit('open', book.id)">
              打开
            </button>
            <button class="ui-button" type="button" :data-testid="`rename-${book.id}`" @click="startRename(book)">
              重命名
            </button>
            <button
              class="ui-button ui-button--danger"
              type="button"
              :data-testid="`delete-${book.id}`"
              @click="removeBook(book)"
            >
              删除
            </button>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
