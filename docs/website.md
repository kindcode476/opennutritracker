# The deployed web app

This fork runs as a **personal web build**: the same Flutter codebase that
ships to Android and iOS, compiled for the browser and served by Cloudflare.
It is the app at a URL, not a marketing site. The old landing page is one
route inside it, at `/about`.

## How deployment works

`build/web` — the output of `flutter build web` — **is committed to this
repository**, and it is what Cloudflare publishes.

Cloudflare's builder clones the repo and runs `npx wrangler deploy`.
`wrangler.jsonc` points at `build/web`, so the deploy is an upload of files
that are already there. No API token, no CI secrets, no second build service:
Cloudflare is already authenticated to its own account, and nothing needs to
compile anything.

That is deliberate, and it is the whole reason the folder is committed.
Cloudflare's build image has no Flutter SDK and cannot get one, so it can
never produce `build/web` itself — it failed for weeks with *"Could not detect
a directory containing static files"* and then *"assets.directory does not
exist"*, which are two ways of saying the same thing. The alternative was a
GitHub Actions workflow holding Cloudflare credentials; this is simpler, and
for a one-person fork the trade-offs land differently than they would on a
shared project.

**The cost, stated plainly:** a committed build can lag the source. If app
code changes and nobody rebuilds, the live site keeps serving the old app
with nothing to warn you. Whoever changes `lib/`, `web/`, `pubspec.yaml` or
the assets must rebuild and commit the result in the same change.

## Rebuilding

```sh
just build_web   # flutter build web --release --no-web-resources-cdn --base-href /
git add build/web
```

`--no-web-resources-cdn` is not optional. Without it the engine (CanvasKit) is
fetched from `gstatic.com` on every cold load: a third-party request this app
has no reason to make, blocked by the CSP in `web/_headers`, which leaves a
blank page rather than a slow one.

The `canvaskit/skwasm*` files are deleted after the build. They are the
WebAssembly renderer; this is a JavaScript build and never loads them, and
they are 12 MB of the output. Verified by removing them and booting the app.

`just site` serves the built folder locally on http://localhost:8787.

## What the browser costs you

Three guarantees change compared with the phone app:

- **No hardware-backed key.** On a phone the Hive encryption key lives in the
  Android Keystore or iOS Keychain. A browser has no equivalent, so the key
  sits in browser storage. Your data still never leaves the device; the
  protection around it is weaker.
- **Clearing site data deletes everything.** Hive keeps its boxes in
  IndexedDB, so one tap in a browser's settings wipes the diary with no undo.
  The export in Settings matters more here than it does on a phone — and it
  works: export downloads a zip, import reads one back.
- **Three features have no browser implementation:** Health Connect / Apple
  Health sync, local notifications, and photos for meals, recipes and
  profiles. Each degrades to a logged warning rather than a crash.

## Requests the app makes

The shell loads nothing from a third party: no hosted fonts, no analytics, no
CDN scripts. The app itself contacts **Open Food Facts** when you search for a
food or scan a barcode, and its image CDN for product photos. `web/_headers`
allows those two hosts and no others.

## Worker name

`name` in `wrangler.jsonc` must match the Worker the Cloudflare project is
connected to. If they differ, the deploy succeeds and publishes to a second
Worker under that name, leaving the expected hostname stale.
