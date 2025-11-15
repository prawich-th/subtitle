import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sqlocalPlugin from 'sqlocal/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sqlocalPlugin()],
})
