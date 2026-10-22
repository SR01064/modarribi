# Fish Audio Worker for Modarribi

This Cloudflare Worker serves the app's text-to-speech and AI comment endpoints. It keeps the Fish Audio API key in a Cloudflare Worker secret; the AI binding generates short English comments without a Claude API key.

## Deploy from Cloudflare Dashboard

1. Open **Workers & Pages → Create application → Worker** and choose **Connect to Git**.
2. Connect `SR01064/modarribi` on branch `main`.
3. Set the root directory to `cloudflare-worker`; use the checked-in `wrangler.jsonc` configuration and `src/index.js` entry point.
4. Deploy the Worker.
5. In Worker **Settings → Variables and Secrets**, add `FISH_API_KEY` as a secret using a newly rotated Fish Audio key. Never commit it or paste it in chat.
6. Redeploy if the dashboard prompts for it, then test the Worker root URL. It should return JSON with `status: ok`.
7. The checked-in `wrangler.jsonc` includes the Workers AI binding named `AI`. If the dashboard deploy flow does not apply bindings from this file, open **Settings → Bindings → Add → Workers AI**, set the variable name to `AI`, and deploy.
8. In Modarribi voice settings, set the proxy address to `https://<worker-name>.<account-subdomain>.workers.dev/api/tts`.

The `/api/comment` endpoint accepts only a small task category and returns one new English line. It does not accept free-form user text. The client remembers recent generated lines and falls back to non-repeating preset lines if AI is unavailable.

The free Workers plan has a published limit of 100,000 requests per day. Fish Audio account usage and limits still apply separately. The free plan's quota and behavior can change; check Cloudflare's current pricing and limits before relying on it.
