import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
// basicSsl is required so that crypto.subtle is available when accessing
// the dev server from other devices on the local network (crypto.subtle
// only works in secure contexts: localhost or https://).
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Only enable basicSsl in dev — GitHub Pages provides HTTPS natively
    ...(command === 'serve' ? [basicSsl()] : []),
  ],
  base: '/ultimate-chess/',
}))
