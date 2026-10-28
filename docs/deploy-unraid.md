# Deploying to Unraid

The container is `Nuvio-Manager`, image `ghcr.io/jamesgallagher/nuvio-manager:latest`, host port 8095.

## What publishes the image

- A merge to `main` publishes `latest` and `sha-<short>`.
- Pushing a `vX.Y.Z` tag publishes `X.Y.Z`, `X.Y` and `latest`.
- Every PR that changes the app bumps `package.json` (CI enforces it). The footer shows the version and short commit.

## Updating the running container

Easiest: Unraid web UI, Docker tab, `Nuvio-Manager`, **Force update**.

From a shell on the server:

```bash
docker pull ghcr.io/jamesgallagher/nuvio-manager:latest
docker rm -f Nuvio-Manager
docker run -d --name Nuvio-Manager --restart unless-stopped -p 8095:8080 \
  -e SUPABASE_URL=https://api.nuvio.tv -e SUPABASE_ANON_KEY= \
  --label net.unraid.docker.managed=dockerman \
  --label 'net.unraid.docker.webui=http://[IP]:[PORT:8095]/' \
  --label net.unraid.docker.icon=https://raw.githubusercontent.com/jamesgallagher/NuvioManager/main/unraid/nuvio-manager-icon.png \
  ghcr.io/jamesgallagher/nuvio-manager:latest
```

The app keeps no data on the server (accounts live in each browser), so recreating the container loses nothing.

## Check it

Open `http://<server>:8095/`, hard refresh (Ctrl+F5) and compare the footer with the release you expect. `GET /healthz` returns `ok`.

## The Unraid template

`unraid/my-nuvio-manager.xml` is the template. Copy it to `/boot/config/plugins/dockerMan/templates-user/my-Nuvio-Manager.xml` on the server (the file name matches the container name) and Edit / Apply in the Docker tab rebuilds the container from it.
