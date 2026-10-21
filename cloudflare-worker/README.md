# Fish Audio Worker for Modarribi

This Cloudflare Worker is an alternative to the Render Node.js proxy. It keeps the Fish Audio API key in a Cloudflare Worker secret and exposes only the `/api/tts` endpoint.

## Deploy from Cloudflare Dashboard

1. Open **Workers & Pages → Create application → Worker** and choose **Connect to Git**.
2. Connect `SR01064/modarribi` on branch `main`.
3. Set the root directory to `cloudflare-worker`; use the checked-in `wrangler.jsonc` configuration and `src/index.js` entry point.
4. Deploy the Worker.
5. In Worker **Settings → Variables and Secrets**, add `FISH_API_KEY` as a secret using a newly rotated Fish Audio key. Never commit it or paste it in chat.
6. Redeploy if the dashboard prompts for it, then test the Worker root URL. It should return JSON with `status: ok`.
7. In Modarribi voice settings, set the proxy address to `https://<worker-name>.<account-subdomain>.workers.dev/api/tts`.

The free Workers plan has a published limit of 100,000 requests per day. Fish Audio account usage and limits still apply separately. The free plan's quota and behavior can change; check Cloudflare's current pricing and limits before relying on it.

