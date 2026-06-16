<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{ success: [] }>()

const { login } = useAuth()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit(): Promise<void> {
  if (!username.value.trim() || !password.value) return
  error.value = ''
  loading.value = true
  try {
    await login(username.value.trim(), password.value)
    emit('success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <form class="login-form" @submit.prevent="handleSubmit">
      <h1>教学设计</h1>
      <div class="field">
        <label for="username">用户名</label>
        <input
          id="username"
          class="ui-field"
          v-model="username"
          type="text"
          autocomplete="username"
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="password">密码</label>
        <input
          id="password"
          class="ui-field"
          v-model="password"
          type="password"
          autocomplete="current-password"
          :disabled="loading"
        />
      </div>
      <p v-if="error" class="ui-error">{{ error }}</p>
      <button
        class="ui-button ui-button--primary"
        type="submit"
        :disabled="loading || !username || !password"
      >
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #edf0f2;
  padding: 24px;
}

.login-form {
  width: min(100%, 340px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(32, 42, 51, 0.12);
  padding: 24px;
}

.login-form h1 {
  margin: 0;
  color: var(--green-700);
  font-size: 24px;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  color: var(--muted);
  font-size: 14px;
}
</style>
