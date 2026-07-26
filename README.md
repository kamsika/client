# Student Management System frontend

This is a Next.js frontend for the Flask API in `student-management-system-api`.

## Local development

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

The frontend reads the backend URL from `NEXT_PUBLIC_API_URL` in `.env.local`.
The repository includes a local `.env.local` and a safe template at
`.env.local.example`. To point at another backend, copy the template and update
the URL:

```bash
cp .env.local.example .env.local
```

Use the API origin only, without a trailing slash. For example:

```env
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

All API requests go through `lib/api-client.ts`, so changing this one variable
connects the whole frontend to a different backend.

## Vercel deployment

1. Import the `client` directory as the Vercel project root.
2. Add `NEXT_PUBLIC_API_URL=https://your-api.up.railway.app` in Vercel for
   Production, Preview, and Development.
3. Redeploy after changing the variable. `NEXT_PUBLIC_*` values are included
   in the browser bundle at build time.

The Railway API must allow the Vercel site origin through its `CORS_ORIGINS`
or `FRONTEND_URL` environment variable.
