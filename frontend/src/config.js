// Base URL for the backend API.
// Local dev: empty string, so requests hit relative /api/* and Vite proxies them
// to localhost:8000 (see vite.config.js). Production: set VITE_API_BASE_URL to the
// Render backend URL, e.g. https://datagrid-backend.onrender.com
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
