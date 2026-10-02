import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Na GitHub Pages stranica živi na /nihongo-shadowing/, u Codespaceu na /.
  base: command === 'build' ? '/nihongo-shadowing/' : '/',
  plugins: [react(), tailwindcss()],
}))
