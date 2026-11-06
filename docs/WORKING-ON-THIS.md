# Working on this, from a Mac

Everything needed to go from a clean machine to a running app, a passing
test suite, and a deploy. Written for macOS; the notes about Windows are
there because the other machine this is developed on is a Windows box and
some of its problems are not real.

---

## 1. What this is, and where it runs

**NikahCanada** is a live Muslim matrimonial service in Montreal, not a
spec build. Real members have accounts on it.

| | |
| --- | --- |
| Repo | `https://github.com/f0rsakenHere/nikahapp.git`, branch `main` |
| Live site | <https://nikahcanada.ca> |
| Server | Contabo VPS, `deploy@169.58.248.239` |
| App directory | `/srv/nikahcanada` |
| Service | systemd unit `nikahcanada`, bound to `127.0.0.1:3000` |
| Proxy | nginx, `/etc/nginx/sites-available/nikahcanada` |
| Database | MongoDB Atlas |
| Stack | Next.js 15 App Router, React 19, Tailwind v4, MongoDB driver |

Node 22 on the server, Node 24 on the Windows machine; there is no
`engines` field, and anything from 20 up has been fine. Use whatever
`nvm` gives you.

---

## 2. Getting it running

```bash
git clone https://github.com/f0rsakenHere/nikahapp.git
cd nikahapp
npm install
```

Do **not** copy `node_modules` across from the Windows machine.
`@node-rs/argon2` is a native module and npm will fetch the darwin-arm64
build for you; a Windows binary will simply fail to load.

### The environment file

`.env.local` is gitignored and has to be put there by hand. For local
work it needs exactly two values:

```
MONGODB_URI=...
MONGODB_DB=...
```

The safe way to get them, without the connection string ever passing
through a chat window or a clipboard history:

```bash
scp deploy@169.58.248.239:/srv/nikahcanada/.env.local .env.local
```

Then **delete everything except `MONGODB_URI` and `MONGODB_DB`**. The
server's copy also carries `NODE_ENV=production`, `APP_ORIGIN` and the
email credentials, and every one of those is wrong for a dev machine —
see §6 for why the email key in particular breaks half the checkers.

### Playwright

The checkers drive a real browser. Install both engines:

```bash
npx playwright install chromium webkit
```

WebKit matters. It is the closest thing to the iPhone Safari that
members actually use, and a fault that only appears there has already
cost this project three rounds of "it works here".

### Run it

```bash
npm run dev     # http://localhost:3000
```

---

## 3. ⚠️ The database is the live one

`MONGODB_DB` in that file points at the **production database**. Running
`npm run dev` on your Mac connects straight to it — the members on your
screen are real members, and anything you write is written for real.
Atlas accepts connections from anywhere, deliberately, so this works
from any machine with no tunnel.

The checkers are written to clean up after themselves: each creates its
own fixtures and removes them in a `finally` block. They are safe to run.
Editing data by hand is not — `scripts/*.cjs` that write anything take
`--apply` and are dry-run by default, and that convention is worth
keeping.

To work against a scratch copy instead, point `MONGODB_DB` at a name
nobody uses. The app will create it empty; `npm run db:seed -- --apply`
fills it with a demo pool.

---

## 4. Everyday commands

```bash
npm run dev          # the app
npm test             # 447 unit tests, src/lib, ~3s
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run lint
```

**Never run `npm run build` while `npm run dev` is up.** They share
`.next` and clobber each other; afterwards dev serves 404s for every
chunk including `layout.css` and the page renders completely unstyled.
Stop the server, `rm -rf .next`, start again.

---

## 5. The checkers

Playwright scripts that drive the real app and assert against the real
database. They are the only thing that catches what unit tests cannot.

```bash
npm run check:mark          # the heart and the pass on a browse card
npm run check:mark:safari   # the same, in WebKit
npm run check:pool          # ask → accept → conversation, end to end
npm run check:join          # registration
npm run check:finish        # finishing a profile
npm run check:feedback      # every point the tester raised, one by one
npm run check:dashboard
npm run check:walis         # two walis, one member
npm run check:activity      # "last here" bands against the real pool
npm run check:links         # every link on every page
npm run check:nav
npm run check:redirects
npm run check:responsive    # advisory; exits 0 with findings
npm run check:draft
npm run check:logo
npm run check:verify-email
npm run check:signup-email
npm run check:plan          # refuses to run: it would switch the paywall
                            # on in live settings
```

Each takes a `BASE`:

```bash
BASE=http://127.0.0.1:3000  npm run check:mark     # your dev server
BASE=https://nikahcanada.ca npm run check:mark     # production
```

Pointing them at production is legitimate and often the right call — the
database they assert against is the same one either way.

---

## 6. Two rules that make checkers fail for reasons that are not bugs

**Invitation and reset links are only printed on screen in development.**
`mayRevealLinks()` returns true only when there is no mail provider *and*
`NODE_ENV !== "production"`. `next start` sets `NODE_ENV=production` even
on your laptop, so the link-walking checkers — `check:walis`,
`check:verify-email`, `check:join` and friends — need `next dev` and
need the email key **absent** from `.env.local`. They now say so instead
of inventing a fault, via `requireRevealedLinks()` in
`scripts/lib/base.cjs`.

**nginx rate-limits the auth routes.** `/login`, `/register`,
`/forgot-password`, `/reset-password` and `/mfa` are capped at 10 a
minute per IP, everything else at 120. Run several checkers against
production back to back and you will get 503s that look exactly like a
broken sign-in. Wait a minute between runs.

The demo accounts are seeded fixtures and their password is in the repo
(`scripts/seed-pool.cjs`): `aisha.rahman@seed.test` / `one good
passphrase`.

---

## 7. Deploying

Push, then pull and restart on the server. There is no CI.

```bash
git push origin main

ssh deploy@169.58.248.239 'cd /srv/nikahcanada \
  && git fetch --quiet origin \
  && git reset --hard --quiet origin/main \
  && npm run build \
  && sudo systemctl restart nikahcanada'
```

Then check it actually came up:

```bash
ssh deploy@169.58.248.239 'systemctl is-active nikahcanada && cd /srv/nikahcanada && git log --oneline -1'
curl -o /dev/null -s -w '%{http_code}\n' https://nikahcanada.ca/
```

A change under `scripts/` alone needs no deploy — nothing on the server
runs those.

Useful on the box:

```bash
sudo journalctl -u nikahcanada -n 100 --no-pager   # app log
sudo tail -50 /var/log/nginx/error.log
sudo nginx -t && sudo systemctl reload nginx       # after an nginx edit
```

The nginx config is **not** in this repo — it exists only on the server.
Edit it there, and leave a dated `.bak-` copy beside it.

---

## 8. Things that will bite you

**Hover and touch are not the same thing, and neither is Chromium and
Safari.** The browse card used to be covered by a stretched link, with
every button opting back in via `pointer-events: auto`. Chromium honours
that; an iPhone did not, and two separate testers reported the heart and
the pass as dead buttons while every test here passed. The link now wraps
the card's reading matter and the buttons sit outside it. `check:mark`
asks the page, at every scroll position, what a finger landing on each
button would actually hit — keep that check alive.

**A server action's reply is a stream.** The value it returns comes
first, the re-rendered page after it. nginx was sending
`Connection: upgrade` on every request, so the second half did not always
arrive: marks were written and the screen never moved. Fixed with the
standard `map $http_upgrade $connection_upgrade`. If a button ever writes
its row and the page behind it does not refresh, suspect the proxy before
the component.

**Windows-only problems you will not have.** The other machine's
`next start` wedges: images hang forever and server actions return 200
without the client ever committing. None of that happens on macOS or on
the server. If you read a comment blaming Windows, that is why.

**Port 3000.** Another project may already hold it. Every checker calls
`assertOurApp()`, which fails loudly with the right advice rather than
measuring somebody else's site.

---

## 9. Still open — these are decisions, not bugs

- **The madhhab filter** on browse. The field and the display were
  restored after the tester asked; the filter was not.
- **Which pricing model is real.** `/pricing` sells packages, the code
  charges brothers from their fourth message, and charging is switched
  off. `check:plan` refuses to run because it would switch the paywall on
  in live settings.
- **Whether the 24 demo profiles stay in the live pool.** Their password
  is public in this repo.
- **A public contact address.** The site has none.
- **`/legal/privacy` and `/legal/terms`** are placeholders, while
  registration asks members to agree to them. The text has to come from
  the client.
- Three of the five real members have no madhhab or height, because those
  questions postdate their sign-up.
