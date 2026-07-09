import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A Zephyr Scanner API NÃO envia Access-Control-Allow-Origin (testado em
// 2026-07-08, ver NOTES.md), então o navegador bloqueia a chamada direta.
// Em dev, o próprio servidor do Vite faz proxy de /zephyr-api → o host real.
// Em produção o deploy precisa de um rewrite equivalente (ex. vercel.json) —
// decisão registrada em NOTES.md, fica pro prompt de deploy.
const scannerProxy = {
  '/zephyr-api': {
    target: 'https://zephyrprotocol.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/zephyr-api/, '/api'),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: scannerProxy },
  preview: { proxy: scannerProxy },
})
