# buildwithkyial.com

Portfolio site for Kyial Ibraeva, freelance web developer. Static HTML/CSS/JS with Cloudflare Pages Functions for the admin panel, portfolio catalog, reviews and contact form.

```
public/            static site (Cloudflare Pages build output directory)
  index.html       home page (all SEO meta, JSON-LD, FAQ)
  privacy.html     privacy policy
  admin/           admin panel at /admin
  js/render.js     HTML renderers shared by the browser and the server
functions/
  index.js         fills the home page with portfolio and reviews on the server (SEO)
  _middleware.js   www -> non-www redirect, noindex on *.pages.dev
  api/[[path]].js  JSON API
  _lib/            storage and auth helpers
```

## Deploy as a Cloudflare Worker (recommended)

`wrangler.jsonc` and `worker/index.js` let the same code run as a Worker with static assets.

1. Cloudflare → Workers & Pages → Create → Import a repository → choose this repo. Worker name must be `buildwithkyial` (same as in `wrangler.jsonc`). Deploy command: `npx wrangler deploy`.
2. The KV namespace `SITE_KV` is created automatically on the first deploy.
3. Worker → Settings → Variables and Secrets → Add → Secret `ADMIN_PASSWORD`.
4. Worker → Settings → Domains & Routes: enable `workers.dev` for a preview link, add `buildwithkyial.com` and `www.buildwithkyial.com` as Custom domains.

## Deploy on Cloudflare Pages (alternative)

Functions only work when the site is deployed from Git or with Wrangler, not with drag-and-drop upload.

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → Workers & Pages → your Pages project (or Create → Pages → Connect to Git).
   - Build command: *(empty)*
   - Build output directory: `public`
3. Storage: Workers & Pages → KV → Create namespace `buildwithkyial-site`.
   Then Pages project → Settings → Bindings → Add → KV namespace, variable name **`SITE_KV`**, choose that namespace.
4. Password: Pages project → Settings → Variables and Secrets → Add → type *Secret*, name **`ADMIN_PASSWORD`**, a long password.
5. Redeploy (Deployments → Retry deployment) so the binding and secret are picked up.
6. Custom domains: add `buildwithkyial.com` and `www.buildwithkyial.com`. The www version redirects to the main domain automatically.

Then open `https://buildwithkyial.com/admin`, sign in, and fill in **Profile and contacts**.

## Email notifications

Contact form messages are always saved in the admin panel (Messages tab). To also get them by email, create a free access key at https://web3forms.com and paste it in Admin → Profile and contacts → Web3Forms access key.

## After launch (SEO)

1. Google Search Console → add property `https://buildwithkyial.com` → verify via DNS (Cloudflare can add the record).
2. Sitemaps → submit `https://buildwithkyial.com/sitemap.xml`.
3. URL Inspection → `https://buildwithkyial.com/` → Request indexing.
4. Create a Google Business Profile (service-area business) and Bing Webmaster Tools (import from Search Console).

## Local development

```
npx wrangler pages dev public --kv SITE_KV --binding ADMIN_PASSWORD=dev-password
```

## Editing prices and services

Services, prices and FAQ are plain HTML in `public/index.html` (kept static so Google reads them directly). Prices also appear in the JSON-LD block at the top of the same file and in the FAQ answers; update all three together.

## Limits (Cloudflare free plan)

KV allows 100,000 reads and 1,000 writes per day, which is far more than a portfolio site needs. Images are compressed in the browser before upload (WebP, max 1600 px) and cached at the edge.
