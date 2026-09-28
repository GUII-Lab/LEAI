import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/datapipeline/api/v1/': {
        target: process.env.LEAI_DEV_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        InstructorHome: fileURLToPath(new URL('./InstructorHome.html', import.meta.url)),
        PromptDesigner: fileURLToPath(new URL('./PromptDesigner.html', import.meta.url)),
        FeedbackAnalyzer: fileURLToPath(new URL('./FeedbackAnalyzer.html', import.meta.url)),
        FeedbackChat: fileURLToPath(new URL('./FeedbackChat.html', import.meta.url)),
        CourseBanner: fileURLToPath(new URL('./CourseBanner.html', import.meta.url)),
        Customizations: fileURLToPath(new URL('./Customizations.html', import.meta.url)),
        InstructorLogin: fileURLToPath(new URL('./InstructorLogin.html', import.meta.url)),
        InstructorPassword: fileURLToPath(new URL('./InstructorPassword.html', import.meta.url)),
        NotFound: fileURLToPath(new URL('./NotFound.html', import.meta.url)),
        feedback: fileURLToPath(new URL('./feedback.html', import.meta.url)),
      },
    },
  },
})
