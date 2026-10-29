// vite.config.mts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { createRequire } from 'module';

// Loaded at run time: Vite would otherwise inline this CommonJS file into its config bundle.
const { portalConfigDefine } = createRequire(import.meta.url)('./portalConfig.cjs');

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: 'default',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/styles/input.css',
          dest: 'styles',
        },
        {
          src: 'src/LanguagesContent',
          dest: 'i18n'
        },
        {
          src: 'public/UAE_MOF_brandmark_Horizontal_CMYK_E-1-scaled-removebg-preview.png',
          dest: '.',
        },
        {
          src: 'public/2961948.png',
          dest: '.',
        },
        {
          src: 'public/index.html',
          dest: '.',
        }
      ]
    })
  ],
  define: {
    ...portalConfigDefine(),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
  },
  build: {
    emptyOutDir: false,
    target: 'esnext',
    lib: {
      entry: 'src/demo/bootstrap.tsx',
      formats: ['iife'],
      name: 'WeaveAiChatComponent',
      fileName: () => 'main.js',
    },
    rollupOptions: {
      output: {
        globals: {
          react: 'React',
          'react-dom/client': 'ReactDOM',
        }
      },
      // external: ['react', 'react-dom']
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer
      ]
    }
  }
});
