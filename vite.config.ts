import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 生产构建去除 console/debugger（发售包加固；sourcemap 默认即关闭）
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
}))
