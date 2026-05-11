# StudentSphere Pro

## Deploy to Vercel

This app is configured for TanStack Start on Vercel with Nitro.

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Add these Environment Variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. Deploy with the default project settings. The repository includes `vercel.json`, so Vercel will run `npm install` and `npm run build`. Nitro writes Vercel build output to `.vercel/output`.

For local verification:

```sh
npm install
npm run build
```
