import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works on any GitHub Pages path
// (user.github.io/ or user.github.io/repo-name/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
