# The project website

`public/` holds a small static site — a landing page, a 404 page, the logo, a
stylesheet, response headers, and `robots.txt`. Cloudflare serves it as a
static-asset Worker. There is no server-side code: `wrangler.jsonc` declares no
`main`, so nothing runs per request.

## Why this exists

The Cloudflare project attached to this repository runs `npx wrangler deploy`
at the repository root on every push. Before `wrangler.jsonc` existed, wrangler
had to guess what to publish, found no directory of static files in a Flutter
app tree, and failed the build with:

```
Could not detect a directory containing static files (e.g. html, css and js)
for the project
```

The config names `public/` explicitly, so the guesswork — and the failure —
is gone.

**The Flutter app is not what gets deployed.** It has no web target: there is
no `web/` directory, and the app depends on mobile-only plugins (barcode
scanner, Health Connect / Apple Health, secure storage backed by the Keystore
and Keychain). Adding a web build is a separate decision, not a deployment
detail.

## Commands

```sh
just site         # preview on http://localhost:8787
just site_deploy  # deploy (this is what the Cloudflare build runs)
```

Both shell out to `npx wrangler`, so they need Node and network access but no
Flutter toolchain. Deploying needs Cloudflare credentials; the Cloudflare build
supplies its own, and locally `wrangler` will prompt to log in.

## Rules for the site

- **No third-party requests.** No hosted fonts, no analytics, no CDN scripts,
  no remotely hosted images. The app's privacy claims are about what it
  contacts; a page that makes those claims while loading a tracker would
  undercut them. `public/_headers` pins that with a `Content-Security-Policy`
  of `default-src 'none'` and `img-src 'self'`, so a stray external reference
  fails visibly rather than quietly phoning home.
- **No copy of the privacy policy.** The formal policy is published at
  [iubenda](https://www.iubenda.com/privacy-policy/53501884) and is the URL the
  store listings point to. A second copy here could drift from it, and a
  privacy policy that contradicts itself is worse than one that lives in a
  single place. `docs/privacy-policy/*.txt` are the archived store-submission
  texts and are not published by the site either.
- **Claims match the README.** The landing-page copy is drawn from README.md.
  If a claim changes there — a figure, a standard, a guarantee — change it in
  `public/index.html` too.

## Worker name

`name` in `wrangler.jsonc` must match the Worker the Cloudflare project is
connected to. If they differ, the build succeeds but publishes to a second
Worker under the name in this file, and the expected hostname stays stale.
