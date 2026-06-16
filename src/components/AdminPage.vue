<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authedFetch, useAuth } from '../composables/useAuth'
import type { UserSummary } from '../composables/useAuth'

const emit = defineEmits<{ back: [] }>()

const { logout } = useAuth()
const users = ref<UserSummary[]>([])
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref<'user' | 'admin'>('user')
const error = ref('')
const success = ref('')
const loading = ref(false)

async function loadUsers(): Promise<void> {
  try {
    users.value = await authedFetch<UserSummary[]>('/api/admin/users')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载用户失败'
  }
}

async function createUser(): Promise<void> {
  if (!newUsername.value.trim() || !newPassword.value) return
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await authedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: newUsername.value.trim(),
        password: newPassword.value,
        role: newRole.value,
      }),
    })
    newUsername.value = ''
    newPassword.value = ''
    newRole.value = 'user'
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    loading.value = false
  }
}

async function removeUser(id: string): Promise<void> {
  if (!confirm('确定要删除该用户吗？')) return
  try {
    await authedFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

async function resetPassword(id: string): Promise<void> {
  if (!confirm('确定要将该用户密码重置为 123456 吗？')) return
  error.value = ''
  success.value = ''
  try {
    await authedFetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' })
    success.value = '已将密码重置为 123456。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重置失败'
  }
}

async function handleLogout(): Promise<void> {
  await logout()
}

onMounted(loadUsers)
</script>

<template>
  <div class="admin-page app-page">
    <header class="app-page-header">
      <h1>用户管理</h1>
      <div class="app-page-actions">
        <button class="ui-button" type="button" @click="emit('back')">← 返回</button>
        <button class="ui-button" type="button" @click="handleLogout">退出登录</button>
      </div>
    </header>

    <section class="create-user">
      <h2>新建用户</h2>
      <form @submit.prevent="createUser">
        <input v-model="newUsername" class="ui-field" placeholder="用户名" :disabled="loading" />
        <input
          v-model="newPassword"
          class="ui-field"
          type="password"
          placeholder="密码"
          :disabled="loading"
        />
        <select v-model="newRole" class="ui-select" :disabled="loading">
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button
          class="ui-button ui-button--primary"
          type="submit"
          :disabled="loading || !newUsername || !newPassword"
        >
          创建
        </button>
      </form>
      <p v-if="error" class="ui-error">{{ error }}</p>
      <p v-if="success" class="ui-success">{{ success }}</p>
    </section>

    <section class="user-list">
      <h2>所有用户</h2>
      <table class="ui-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>角色</th>
            <th>创建时间</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.role === 'admin' ? '管理员' : '普通用户' }}</td>
            <td>{{ new Date(u.createdAt).toLocaleDateString('zh-CN') }}</td>
            <td>
              <button
                class="ui-button"
                type="button"
                :data-testid="`reset-password-${u.id}`"
                @click="resetPassword(u.id)"
              >
                重置密码
              </button>
              <button
                class="ui-button ui-button--danger"
                type="button"
                :data-testid="`delete-user-${u.id}`"
                @click="removeUser(u.id)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.app-page-header h1 {
  flex: 1;
}

.create-user {
  margin-bottom: 24px;
}

.create-user h2,
.user-list h2 {
  margin: 0 0 12px;
  color: var(--green-700);
  font-size: 18px;
}

.create-user form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
