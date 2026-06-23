# Deploying to Render

This project is built on TanStack Start. The default Lovable build targets
Cloudflare Workers; for Render we override the Nitro preset to `node-server`
at build time via the `NITRO_PRESET` env var. **No source code changes are
required** — your Lovable preview keeps working.

## 1. Push the code to GitHub
In Lovable: top-right → GitHub → Create repository. Render reads from GitHub.

## 2. Create the Render service
1. https://dashboard.render.com → **New +** → **Blueprint**
2. Connect the GitHub repo. Render will detect `render.yaml`.
3. Click **Apply**.

(Or do it manually: New Web Service → Node runtime → use the build/start
commands shown in `render.yaml`.)

## 3. Set the environment variables
In the Render service → **Environment**, fill in every `sync: false` var.
You can copy the values from your current Lovable Cloud project — they are
the same secrets the app already uses.

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | Lovable → Backend → Project Settings |
| `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | same |
| `VITE_SUPABASE_PROJECT_ID` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | Lovable → Backend → API keys (service role) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys (use **LIVE** keys for production) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks (generated when you create the webhook in step 5) |
| `LOVABLE_API_KEY` | only if any server function calls Lovable AI |

## 4. Deploy
Render will build (`bun install && NITRO_PRESET=node-server bun run build`)
and start (`node .output/server/index.mjs`). First build takes ~3–5 min.
You will get a URL like `https://codeforge-store.onrender.com`.

## 5. Point Razorpay webhook at Render
In Razorpay Dashboard → Webhooks → Add new:
- URL: `https://<your-render-domain>/api/public/razorpay/webhook`
  (adjust the path if your webhook route differs — check `src/routes/api/`)
- Events: `payment.captured`, `payment.failed`, `order.paid`
- Copy the generated secret into `RAZORPAY_WEBHOOK_SECRET` on Render.

## 6. (Optional) Custom domain
Render service → **Settings → Custom Domains** → add your domain and follow
the DNS instructions.

## Troubleshooting
- **Build fails with "Cannot find module"** — Render needs Bun. The blueprint
  uses Bun automatically; if you created the service manually pick the Node
  runtime and keep the `bun install ...` build command (Render has Bun
  preinstalled).
- **App boots but server functions 500** — a server-only env var is missing.
  Check Render → Logs and add the missing one in Environment.
- **Razorpay webhook 401** — `RAZORPAY_WEBHOOK_SECRET` on Render does not
  match the secret Razorpay generated. Re-copy it.
- **Cold starts on free plan** — upgrade to Starter ($7/mo) for always-on.
