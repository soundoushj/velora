import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 700 } }); // three.js ships in a lazy chunk used only by the Story page
