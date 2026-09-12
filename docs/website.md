# The deployed web app

This fork runs as a **personal web build** of the app: the same Flutter
codebase that ships to Android and iOS, compiled for the browser and deployed
to Cloudflare. It is not a marketing site and not a rewrite — it is the app,
at a URL.

The static page that used to live here (a landing page pointing at the store
listings) is now one page inside the app's shell, at `/about`.

## What deploys

`flutter build web` produces `build/web`, and that directory is what
Cloudflare serves. Everything under `web/` in the repository — the HTML
shell, the PWA manifest, the icons, `_headers`, `robots.txt`, and `/about` —
is copied into it by the build, so the deployed directory is self-contained
and nothing is assembled by hand.

`wrangler.jsonc` points at `build/web` and declares no `main`: there is no
server-side code, just static assets. Unknown paths serve the app shell
(`single-page-application`) because a deep link belongs to the app's router,
not to a missing file.

## Who runs the build

**GitHub Actions**, not Cloudflare. Cloudflare's build image has no Flutter
SDK, so its own Git build cannot produce `build/web` — it fails with *"Could
not detect a directory containing static files"* or, once this config landed,
*"assets directory does not exist"*. Both are the same fact stated twice:
nothing to deploy until Flutter has run.

So `.github/workflows/deploy-web.yml` builds and deploys on every push to
`main`, and **the Cloudflare Git build should be switched off** in the
dashboard. It needs two repository secrets:

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A token with the *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | The account the Worker lives in |

Two more are optional. `SUPABASE_PROJECT_URL` and `SUPABASE_PROJECT_ANON_KEY`
turn on the multi-source food backend (USDA, BLS); without them the app falls
back to Open Food Facts, which needs no credentials. `SENTRY_DNS` is left
empty on purpose — crash reports from a personal fork have no business
arriving in the upstream project's account, and an empty DSN makes Sentry
inert.

## Building it yourself

```sh
flutter build web --release --no-web-resources-cdn --base-href /
just site        # preview the built output on http://localhost:8787
just site_deploy # deploy it (needs Cloudflare credentials)
```

`--no-web-resources-cdn` is not optional. Without it the engine (CanvasKit) is
fetched from `gstatic.com` on every cold load: a third-party request this app
has no reason to make, blocked by the CSP in `web/_headers`, which leaves a
blank page rather than a slow one.

## What the browser costs you

The web build is the same app, but a browser is not a phone, and three
guarantees change:

- **No hardware-backed key.** On a phone the Hive encryption key lives in the
  Android Keystore or iOS Keychain. A browser has no equivalent, so the key
  sits in browser storage. Your data still never leaves the device; the
  protection around it is weaker.
- **Clearing site data deletes everything.** Hive keeps its boxes in
  IndexedDB. One tap in a browser's settings wipes the diary with no undo, so
  the export in Settings matters more here than it does on a phone.
- **Three features have no browser implementation:** Health Connect / Apple
  Health sync, local notifications (so no fasting-complete alert), and photos
  for meals, recipes and profiles — `path_provider` has no web support, and
  the app degrades to a logged warning rather than a crash.

## Requests the app makes

The shell loads nothing from a third party: no hosted fonts, no analytics, no
CDN scripts. The app itself contacts **Open Food Facts** when you search for a
food or scan a barcode, and its image CDN for product photos — that is what a
food database is, and `web/_headers` allows those two hosts and no others.

## Worker name

`name` in `wrangler.jsonc` must match the Worker the Cloudflare project is
connected to. If they differ, the deploy succeeds and publishes to a second
Worker under that name, leaving the expected hostname stale.
