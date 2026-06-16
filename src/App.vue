<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AdminPage from './components/AdminPage.vue'
import BookListPage from './components/BookListPage.vue'
import LoginPage from './components/LoginPage.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import { useAuth } from './composables/useAuth'

type AppRoute =
  | { name: 'login' }
  | { name: 'books' }
  | { name: 'book'; bookId: string }
  | { name: 'admin' }

const { isLoggedIn, fetchMe } = useAuth()
const route = ref<AppRoute>(getInitialRoute())

function parseRoute(pathname: string): AppRoute {
  if (pathname === '/login') return { name: 'login' }
  if (pathname === '/admin') return { name: 'admin' }
  if (pathname === '/books') return { name: 'books' }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/)
  if (bookMatch?.[1]) {
    try {
      return { name: 'book', bookId: decodeURIComponent(bookMatch[1]) }
    } catch {
      return { name: 'books' }
    }
  }

  return { name: 'books' }
}

function getInitialRoute(): AppRoute {
  const parsed = parseRoute(window.location.pathname)
  return isLoggedIn.value ? parsed : { name: 'login' }
}

function routeToPath(nextRoute: AppRoute): string {
  if (nextRoute.name === 'login') return '/login'
  if (nextRoute.name === 'admin') return '/admin'
  if (nextRoute.name === 'book') return `/books/${encodeURIComponent(nextRoute.bookId)}`
  return '/books'
}

function replaceRoute(nextRoute: AppRoute): void {
  const path = routeToPath(nextRoute)
  route.value = nextRoute
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path)
  }
}

function pushRoute(nextRoute: AppRoute): void {
  const path = routeToPath(nextRoute)
  route.value = nextRoute
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

function syncRouteForAuth(): void {
  if (!isLoggedIn.value) {
    replaceRoute({ name: 'login' })
    return
  }

  if (route.value.name === 'login') {
    replaceRoute({ name: 'books' })
    return
  }

  replaceRoute(route.value)
}

function handlePopState(): void {
  route.value = parseRoute(window.location.pathname)
  syncRouteForAuth()
}

onMounted(async () => {
  window.addEventListener('popstate', handlePopState)
  await fetchMe()
  syncRouteForAuth()
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
})

async function handleLoginSuccess(): Promise<void> {
  await fetchMe()
  if (isLoggedIn.value) {
    pushRoute({ name: 'books' })
  } else {
    replaceRoute({ name: 'login' })
  }
}

function openBook(id: string): void {
  pushRoute({ name: 'book', bookId: id })
}

function backToList(): void {
  pushRoute({ name: 'books' })
}

function openAdmin(): void {
  pushRoute({ name: 'admin' })
}

watch(isLoggedIn, syncRouteForAuth)
</script>

<template>
  <LoginPage v-if="route.name === 'login'" @success="handleLoginSuccess" />
  <template v-else>
    <AdminPage v-if="route.name === 'admin'" @back="backToList" />
    <WorkspaceView
      v-else-if="route.name === 'book'"
      :key="route.bookId"
      :book-id="route.bookId"
      @back="backToList"
    />
    <BookListPage v-else @open="openBook" @admin="openAdmin" />
  </template>
</template>
