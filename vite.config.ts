import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The WhatsApp link preview needs an absolute og:image URL. On Vercel the
 * production domain is known at build time (VERCEL_PROJECT_PRODUCTION_URL, which
 * is the custom domain once one is attached). Set SITE_URL to override.
 */
const siteUrl = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '')

export default defineConfig({
  plugins: [
    react(),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
    {
      // The opening screen is styled inline in index.html, so the main stylesheet
      // must not block the first paint: load it without blocking rendering.
      name: 'async-css',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: (html) => html.replace(/<link rel="stylesheet"( crossorigin)? href="([^"]+)">/g, (_m, _c, href) =>
          `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}"></noscript>`),
      },
    },
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
  preview: { host: true },
})
