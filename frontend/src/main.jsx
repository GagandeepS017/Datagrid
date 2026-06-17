import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { API_BASE } from './config'

// All axios calls use relative /api/* paths; this points them at the right host
// (empty in dev for the Vite proxy, the Render URL in production).
axios.defaults.baseURL = API_BASE

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
