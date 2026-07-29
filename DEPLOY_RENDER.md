# Deploying to Render (Free Tier)

This app has zero npm dependencies, so Render's Node.js auto-detection just works —
no Dockerfile needed for this path (though the Fly.io Dockerfile in this repo
would also work on Render if you ever want to switch to Docker-based deploys).

You'll need your code in a Git repository Render can see (GitHub, GitLab, or
Bitbucket). If you haven't pushed this project to GitHub yet, do that first:

```bash
cd ajaia-docs
git init
git add .
git commit -m "Ajaia Docs submission"
# create a new repo on GitHub (via the website or `gh repo create`), then:
git remote add origin https://github.com/<your-username>/ajaia-docs.git
git branch -M main
git push -u origin main
```

## 1. Create a Render account

Go to **https://render.com** → **Get Started** → sign up (GitHub sign-in is the fastest path, since you'll be connecting a GitHub repo anyway). No credit card required for the free tier.

## 2. Create a new Web Service

- From the Render dashboard, click **New +** → **Web Service**.
- Connect your GitHub account if you haven't already (Render will ask for repo access permissions — you can grant access to just this one repo).
- Select your `ajaia-docs` repository from the list.

## 3. Configure the service

Render will likely auto-detect this is a Node.js app. Fill in / confirm these fields:

| Field | Value |
|---|---|
| **Name** | `ajaia-docs` (or anything you like — this becomes part of your URL) |
| **Region** | Pick whatever's closest to you or your reviewers |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | leave blank, or `echo "no build needed"` — there's nothing to install |
| **Start Command** | `node server.js` |
| **Instance Type** | **Free** |

This project also includes a `render.yaml` Blueprint file with these exact settings pre-filled. If Render detects it, you can instead use **New +** → **Blueprint** and point it at the repo — it'll configure everything above automatically without you typing it in.

## 4. Deploy

Click **Create Web Service**. Render will:
1. Clone your repo
2. Run the build command (near-instant, since there's nothing to install)
3. Start the app with `node server.js`
4. Give you a live URL like `https://ajaia-docs.onrender.com`

First deploy typically takes 1-3 minutes. You'll see live build logs in the dashboard.

## 5. Verify it's live

Visit the URL Render gives you. You should see the Ajaia Docs login screen with the `alice` / `bob` / `carol` chips.

Quick smoke test:
1. Log in as `alice` → confirm the welcome doc appears.
2. Edit some text → wait for "Saved ✓" → refresh the page → confirm it saved.
3. Log in as `bob` → confirm the welcome doc shows under "Shared with Me".

## Important free-tier caveats (be upfront about these)

- **Cold starts:** the free instance spins down after ~15 minutes of no traffic. The next request after that takes roughly 30-60 seconds to wake up before it responds. If a reviewer opens your link cold, the first load will feel slow — that's Render's free tier, not a bug in the app. Worth mentioning this explicitly in your submission so nobody thinks the app is broken.
- **No persistent disk on the free tier:** `data/db.json` lives on the instance's local filesystem, which is wiped on every redeploy and on most restarts/spin-downs on the free plan. This means your data (documents, shares) can reset between reviewer visits. This is disclosed in the README as an accepted tradeoff for a free demo deployment.
  - **If you want real persistence** without leaving the free tier entirely, the practical fix is swapping `data/db.json` for a free-tier hosted database (e.g., a free Postgres/SQLite-compatible service like Neon or Turso) — that's a "what I'd build next" item, not something to scramble to add now.
  - Alternatively, upgrading to Render's paid Starter plan ($7/mo) adds a persistent disk — not necessary for this assignment, just noting the upgrade path.

## 6. Redeploying after changes

Render auto-deploys on every push to `main` by default:

```bash
git add .
git commit -m "some change"
git push
```

Or trigger manually from the dashboard: **Manual Deploy** → **Deploy latest commit**.

## Troubleshooting

- **Build fails looking for `node_modules`/lockfile** → shouldn't happen here since there's no `package-lock.json` and no dependencies, but if Render's build step errors trying to run `npm install` anyway, explicitly set the Build Command to `echo "no build needed"` in the service settings.
- **App crashes on start / "port already in use"** → Render sets `PORT` itself; `server.js` already reads `process.env.PORT`, so this should just work. Check the **Logs** tab in the Render dashboard for the actual error if it doesn't start.
- **First load hangs for a while** → that's the cold-start behavior described above, not an error — wait ~60 seconds.
