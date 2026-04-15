import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许外部访问
    allowedHosts: [
      '64a005a9.r32.cpolar.top', // 允许通过 cpolar 域名访问
      '.cpolar.top', // 允许所有 cpolar 子域名
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        proxyTimeout: 0,
        timeout: 0,
      },
    },
  },
});
