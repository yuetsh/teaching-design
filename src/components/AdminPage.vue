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
const loading = ref(false)

async function loadUsers(): Promise<void> {
  users.value = await authedFetch<UserSummary[]>('/api/admin/users')
}

async function createUser(): Promise<void> {
  if (!newUsername.value.trim() || !newPassword.value) return
  error.value = ''
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

async function handleLogout(): Promise<void> {
  await logout()
}

onMounted(loadUsers)
</script>

<template>
  <div class="admin-page">
    <header>
      <button @click="emit('back')">← 返回</button>
      <h1>用户管理</h1>
      <button @click="handleLogout">退出登录</button>
    </header>

    <section class="create-user">
      <h2>新建用户</h2>
      <form @submit.prevent="createUser">
        <input v-model="newUsername" placeholder="用户名" :disabled="loading" />
        <input v-model="newPassword" type="password" placeholder="密码" :disabled="loading" />
        <select v-model="newRole" :disabled="loading">
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button type="submit" :disabled="loading || !newUsername || !newPassword">创建</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section class="user-list">
      <h2>所有用户</h2>
      <table>
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
              <button @click="removeUser(u.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

header h1 {
  flex: 1;
  margin: 0;
}

.create-user form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.create-user input,
.create-user select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: #c0392b;
  font-size: 0.875rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}

th, td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

th {
  font-weight: 600;
  color: #555;
}

button {
  padding: 0.3rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
}

button:hover {
  background: #f5f5f5;
}
</style>
