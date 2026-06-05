# Hostinger VPS CI/CD

This backend deploys to a Hostinger VPS through GitHub Actions, SSH, Docker, and Docker Compose.

## 1. Prepare the VPS

Install Docker, Docker Compose, and Git on the Hostinger VPS.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in after adding the user to the Docker group.

## 2. Add GitHub Secrets

Add these repository secrets in GitHub:

```text
HOSTINGER_HOST=your_vps_ip_or_hostname
HOSTINGER_PORT=22
HOSTINGER_USER=your_ssh_user
HOSTINGER_SSH_KEY=private_ssh_key_for_that_user
HOSTINGER_DEPLOY_PATH=/home/your_user/apps/blih-erp-backend
ENV_PRODUCTION_B64=base64 encoded contents of .env.production
```

Use `.env.production.example` as the template for `.env.production`.

Create the base64 value from your production env file:

```bash
base64 -w 0 .env.production
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .env.production -Raw)))
```

## 3. Deploy

Push to `main`, or run the workflow manually from GitHub Actions:

```text
Deploy Backend to Hostinger VPS
```

The workflow validates the backend, connects to the VPS, pulls the latest code, writes `.env.production`, rebuilds the Docker image, and restarts the Compose stack.

If the GitHub repository is private, add a deploy key or GitHub token on the VPS so `git clone` and `git fetch` can read the repository.

The Docker image uses Node 22 and installs system Chromium in the container. Puppeteer browser downloads are disabled during `npm ci`.

## 4. Useful VPS Commands

```bash
cd /home/your_user/apps/blih-erp-backend
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose restart app
```

## Notes

Production uses `DB_SYNC=false`. Run migrations as part of a release once the migration command is wired into the runtime image.
