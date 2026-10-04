import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.PUPPETS_API ?? 'http://127.0.0.1:3100';

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PUPPETS_WEB_PORT ?? 3101),
    strictPort: true,
    proxy: { '/api': API },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // As bibliotecas saem do pacote principal: cada bloco fica abaixo de 500 kB (sem o aviso do build) e
        // quase nunca muda, então o navegador reaproveita do cache quando só o código da ferramenta muda.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/lucide-react')) return 'icones';
          if (id.includes('node_modules/gsap')) return 'gsap';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Vários arquivos jsdom em paralelo deixam a máquina lenta; 5 s (padrão) dava falso vermelho.
    testTimeout: 30000,
    // A máquina costuma dividir CPU com outros projetos; menos trabalhadores = menos falso vermelho por lentidão.
    maxWorkers: 3,
  },
});
