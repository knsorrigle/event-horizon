import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Minify GLSL in production only; keep it readable while tuning.
    glsl({ minify: command === 'build' }),
  ],
}));
