<script setup lang="ts">
import { ref } from 'vue'
import BookListPage from './components/BookListPage.vue'
import WorkspaceView from './components/WorkspaceView.vue'

const currentBookId = ref<string | null>(null)

function openBook(id: string): void {
  currentBookId.value = id
}

function backToList(): void {
  currentBookId.value = null
}
</script>

<template>
  <BookListPage v-if="!currentBookId" @open="openBook" />
  <WorkspaceView v-else :key="currentBookId" :book-id="currentBookId" @back="backToList" />
</template>
