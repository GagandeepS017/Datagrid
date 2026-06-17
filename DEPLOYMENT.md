# Deployment

DataGrid deploys as two free services: the FastAPI backend on **Render** and the
React/Vite frontend on **Vercel**. Deploy the backend first, copy its URL, then
deploy the frontend pointing at it.

```
Browser  ->  Vercel (frontend, static)  ->  Render (backend, FastAPI)  ->  Anthropic API
```

Local development is unaffected: with no env vars set, the frontend uses the Vite
proxy to `localhost:8000` and the backend allows localhost origins.

---

## Order of operations

1. Deploy the backend to Render, set its secrets, get its URL.
2. Deploy the frontend to Vercel with `VITE_API_BASE_URL` = the Render URL.
3. Go back to Render and set `FRONTEND_ORIGIN` = the Vercel URL (for CORS).

---

## 1. Backend on Render

1. Push this repo to GitHub (already done if you are reading this there).
2. In the [Render dashboard](https://dashboard.render.com): **New > Blueprint**,
   select this repo. Render reads `render.yaml` and creates the
   `datagrid-backend` web service automatically.
   - If you prefer manual setup instead of the blueprint: **New > Web Service**,
     Root Directory `backend`, Build Command `pip install -r requirements.txt`,
     Start Command `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Set environment variables (Render dashboard > the service > **Environment**):
   - `ANTHROPIC_API_KEY` = your Anthropic key. **Secret, never commit it.**
   - `FRONTEND_ORIGIN` = leave blank for now; you will set it in step 3 below.
   - `DEMO_MAX_REQUESTS` = `0` (or a small number like `50` for a public demo).
4. Deploy. When it is live, copy the service URL, e.g.
   `https://datagrid-backend.onrender.com`. Check `<url>/health` returns
   `{"status":"ok"}` and `<url>/docs` loads.

> Heavy dependencies: `requirements.txt` includes `sdv`, `mlflow`, and `torch`,
> which are large and may exceed Render's free build/memory limits. If the build
> fails on size or memory, remove the `sdv` and `mlflow` lines from
> `backend/requirements.txt` and redeploy. The app degrades gracefully: the
> synthetic-data copula option falls back to independent sampling, and the eval
> harness simply will not be available.

> Persistence: Render's free tier has an ephemeral filesystem. Uploaded tables
> are kept in memory and queries work normally, but they are not saved across
> restarts/redeploys (the "Recent datasets" list will be empty after a restart).
> This is expected; no action needed.

---

## 2. Frontend on Vercel

1. In the [Vercel dashboard](https://vercel.com): **Add New > Project**, import
   this repo.
2. Set the **Root Directory** to `frontend`. Vercel detects Vite and reads
   `frontend/vercel.json` (build `npm run build`, output `dist`).
3. Add an environment variable (Vercel project > **Settings > Environment
   Variables**):
   - `VITE_API_BASE_URL` = your Render backend URL from step 1, e.g.
     `https://datagrid-backend.onrender.com` (no trailing slash).
4. Deploy. Copy the Vercel URL, e.g. `https://datagrid.vercel.app`.

> Vite env vars are read at build time. If you change `VITE_API_BASE_URL` later,
> trigger a redeploy.

---

## 3. Connect the two (CORS)

1. Back in Render, set `FRONTEND_ORIGIN` = your Vercel URL
   (e.g. `https://datagrid.vercel.app`, no trailing slash). Multiple origins can
   be comma-separated.
2. Render redeploys. The backend now accepts requests from the frontend.

---

## Free-tier cold start

Render's free web service spins down after inactivity. The first request after
idle can take 30-60 seconds while it wakes up, so the first upload or query on a
cold demo will feel slow.

Suggested one-line note to show in the UI (e.g. under the upload zone):

> First request after a while may take up to a minute while the free backend wakes up.
