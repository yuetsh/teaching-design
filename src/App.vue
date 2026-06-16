<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminPage from './components/AdminPage.vue'
import BookListPage from './components/BookListPage.vue'
import LoginPage from './components/LoginPage.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import { useAuth } from './composables/useAuth'

const { isLoggedIn, fetchMe } = useAuth()
const currentBookId = ref<string | null>(null)
const showAdmin = ref(false)

onMounted(async () => {
  await fetchMe()
})

function openBook(id: string): void {
  currentBookId.value = id
  showAdmin.value = false
}

function backToList(): void {
  currentBookId.value = null
}

function openAdmin(): void {
  showAdmin.value = true
  currentBookId.value = null
}

function closeAdmin(): void {
  showAdmin.value = false
}
</script>

<template>
  <LoginPage v-if="!isLoggedIn" @success="fetchMe" />
  <template v-else>
    <AdminPage v-if="showAdmin" @back="closeAdmin" />
    <WorkspaceView
      v-else-if="currentBookId"
      :key="currentBookId"
      :book-id="currentBookId"
      @back="backToList"
    />
    <BookListPage v-else @open="openBook" @admin="openAdmin" />
  </template>
</template>
