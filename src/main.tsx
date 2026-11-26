import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)

// Vercel Web Analytics: privacy friendly, no cookies. Only runs on a deployed
// production build; on localhost and in development it does nothing at all.
const host = location.hostname
const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)
if (import.meta.env.PROD && !local) {
  import('@vercel/analytics').then(({ inject }) => inject()).catch(() => { /* analytics must never break the page */ })
}
