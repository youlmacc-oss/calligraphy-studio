import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function redirectRootToStudio() {
  return {
    name: 'redirect-root-to-studio',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = String(req.url || '')
        if (url === '/' || url === '/index.html') {
          res.statusCode = 302
          res.setHeader('Location', '/calligraphy-studio/')
          res.end()
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), redirectRootToStudio()],
  base: '/calligraphy-studio/',
  server: {
    port: 5173,
    open: '/calligraphy-studio/',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
  },
})