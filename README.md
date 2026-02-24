# Gulf of Maine Buoy Monitor

Real-time NOAA NDBC buoy data viewer for the Gulf of Maine, deployed on Fly.io with automatic GitHub Actions CI/CD.

---

## Project Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v24+)
- [Git](https://git-scm.com/)
- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) — Fly.io CLI
- A [Fly.io](https://fly.io) account
- A [GitHub](https://github.com) account

---

## Git Setup

### 1. Initialize the repository

```bash
git init
```

### 2. Create `.gitignore`

```
node_modules/
```

This ensures `node_modules/` is never committed. The file lives at `.gitignore`.

### 3. Initial commit

```bash
git add .
git commit -m "Initial commit: Gulf of Maine buoy monitor on Fly.io"
```

### 4. Push to GitHub

Create a new repository on GitHub, then:

```bash
git remote add origin https://github.com/<your-username>/buoy-monitor.git
git branch -M main
git push -u origin main
```

---

## Fly.io Setup

### 1. Install flyctl

```bash
brew install flyctl       # macOS
# or
curl -L https://fly.io/install.sh | sh
```

### 2. Authenticate

```bash
fly auth login
```

### 3. Launch the app

Run this from the project root. It generates `fly.toml` and the `Dockerfile`:

```bash
fly launch
```

When prompted:
- **App name**: `buoy-monitor`
- **Region**: `ewr` (Newark, NJ — closest to Gulf of Maine)
- **Dockerfile**: generated automatically via `@flydotio/dockerfile`

### 4. Deploy manually (optional)

```bash
fly deploy
```

---

## Files Created or Modified

| File | Description |
|------|-------------|
| `.gitignore` | Excludes `node_modules/` from version control |
| `.dockerignore` | Excludes `node_modules/`, `.env`, and `*.log` from Docker builds |
| `fly.toml` | Fly.io app configuration (app name, region, HTTP service, VM specs) |
| `Dockerfile` | Multi-stage Docker build for the Node.js app |
| `package.json` | Declares dependencies including `@flydotio/dockerfile` |
| `.github/workflows/fly.yml` | GitHub Actions workflow for automatic deploys on push to `main` |

---

## Fly.io Configuration (`fly.toml`)

```toml
app = 'buoy-monitor'
primary_region = 'ewr'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1
```

Key settings:
- **Port 3000** — matches the Express server's listen port
- **auto_stop_machines** — machines stop when idle to reduce cost
- **min_machines_running = 0** — scales to zero when not in use
- **Region `ewr`** — Newark, NJ (low latency for Gulf of Maine data)

---

## Automatic Deployment (GitHub Actions)

File: `.github/workflows/fly.yml`

Every push to `main` automatically deploys to Fly.io.

### Setup

1. Generate a Fly.io API token:
   ```bash
   fly tokens create deploy -x 999999h
   ```

2. Add it as a GitHub secret:
   - Go to your GitHub repo → **Settings → Secrets and variables → Actions**
   - Create a secret named `FLY_API_TOKEN` and paste the token

3. Push to `main` — the workflow runs automatically.

### Workflow summary

```yaml
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

`--remote-only` builds the Docker image on Fly.io's infrastructure rather than locally, which is faster in CI.

---

## Local Development

```bash
npm install
node server.js
```

The server runs at `http://localhost:3000`.

---

## Architecture

- **Runtime**: Node.js 24 with Express
- **Container**: Multi-stage Docker build (slim Node base image)
- **Hosting**: Fly.io (single shared-CPU VM, 1 GB RAM)
- **CI/CD**: GitHub Actions → Fly.io remote build + deploy
- **Data source**: NOAA NDBC buoy feeds (fetched server-side)
