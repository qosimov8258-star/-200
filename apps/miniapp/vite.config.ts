import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 3000 — backend, 3001 — admin panel, 3002 — Mini App.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Telegram ichida sinash uchun tunnel (https) orqali ochiladi.
    allowedHosts: true,
  },
})
