/** M3 snackbar queue: one message at a time, auto-dismissed. */
import { reactive } from 'vue'

interface Snack {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

export const snackbar = reactive({ current: null as Snack | null })

let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 0

export function showSnackbar(message: string, action?: Snack['action']): void {
  clearTimeout(timer)
  snackbar.current = { id: nextId++, message, action }
  timer = setTimeout(dismissSnackbar, 4000)
}

export function dismissSnackbar(): void {
  clearTimeout(timer)
  snackbar.current = null
}
