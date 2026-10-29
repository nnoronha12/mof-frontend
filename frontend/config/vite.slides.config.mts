import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, '../slides'),
  publicDir: path.resolve(__dirname, '../public'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../dist-slides'),
    emptyOutDir: true,
    target: 'es2020',
  },
});
