/* @refresh reload */
import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import LoginPage from './components/LoginPage.tsx'
import { authStore } from './stores/authStore'

const root = document.getElementById('root')

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (confirm('有新版本可用,是否立即更新?\n\nNew version available, refresh now?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
  })
}

const Root = () => {
  const [ready, setReady] = createSignal(false)

  onMount(async () => {
    await authStore.checkStatus()
    setReady(true)
  })

  createEffect(() => {
    if (!authStore.authRequired()) {
      setReady(true)
    }
  })

  return (
    <Show when={ready()} fallback={<div class="login-loading">Loading...</div>}>
      <Show when={authStore.authRequired() && !authStore.authenticated()} fallback={<App />}>
        <LoginPage />
      </Show>
    </Show>
  )
}

render(() => <Root />, root!)
