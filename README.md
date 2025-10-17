# Durain — repository and deployment guide

This repository contains a Flask backend (object detection using Ultralytics) in `back/` and a React frontend in `front/`.

This README gives clear, copy-paste commands to:
- Initialize and push the repo to GitHub (from Windows PowerShell)
- Deploy the project to a Linux server using Docker Compose
- Optional steps for managing the app with systemd and exposing via nginx with HTTPS

IMPORTANT SAFETY NOTE
- This repository currently contains trained model files (`*.pt`) in `back/`. These files are large and should generally not be kept in git for production projects. Consider moving them to a release asset, object storage (S3), or mounting them as a volume on the server. See the "Model file handling" section below.

CONTENTS
- back/: Flask backend and model files
- front/: React frontend
- docker-compose.yml: local and server orchestration
- deploy/: sample systemd and nginx configuration

1) Prepare and push to GitHub (Windows PowerShell)

Replace <your-user> and <your-repo> with your GitHub username and repository name.

```powershell
cd 'C:\Users\chisa\Desktop\Durain'
git init
git add .
git commit -m "Initial import: Durain app with back/front and docker configs"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

2) Deploy to an Ubuntu/Debian Linux server (copy-paste)

# On the server, as a sudo user

1) Install Docker & Compose (Ubuntu example):

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

2) Clone the repo and start the app:

```bash
cd /opt
git clone https://github.com/<your-user>/<your-repo>.git
cd <your-repo>
chmod +x deploy_server.sh
./deploy_server.sh
# or directly
docker compose up --build -d
```

After successful startup:
- Frontend: http://server-ip:3000
- Backend API: http://server-ip:5000

3) Optional: Run with systemd

Edit `deploy/durain.service` and set `WorkingDirectory` to the path where you cloned the repo (for example `/opt/<your-repo>`), then:

```bash
sudo cp deploy/durain.service /etc/systemd/system/durain.service
sudo systemctl daemon-reload
sudo systemctl enable --now durain.service
sudo systemctl status durain.service
```

4) Optional: nginx reverse proxy + TLS (Certbot)

Install nginx and Certbot, then enable the provided sample config (edit `server_name` first):

```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/durain
sudo ln -s /etc/nginx/sites-available/durain /etc/nginx/sites-enabled/durain
sudo nginx -t
sudo systemctl reload nginx

# Install certbot and request a certificate for your domain
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

Model file handling (recommended)
- Option A (recommended): Remove `*.pt` files from git and store them externally (S3, Google Cloud Storage, or GitHub release). On server startup, download them into an expected directory.
- Option B: Keep weights on the server and mount a host volume into the backend container in `docker-compose.yml`.

Production notes and improvements
- Don't use Flask's debug server in production. Run the backend with gunicorn or another WSGI server.
- If you need GPU acceleration, switch the Docker base image to an appropriate CUDA image and configure the server to use the NVIDIA container runtime.
- Add environment variable support and secrets handling (do not commit secrets to git).
- Add CI/CD (GitHub Actions) to build images and push to a registry.

Support — next actions I can take for you
- Initialize Git here and push (I'll need the GitHub repo URL).
- Update the backend Dockerfile to run via gunicorn.
- Replace model files with a startup downloader and remove them from git (you'll provide model URLs).
- Add a GitHub Actions workflow to build and optionally push images.

If you want me to perform any of the above changes automatically, tell me which one and provide any required info (for example: GitHub repo URL or model download URLs).

