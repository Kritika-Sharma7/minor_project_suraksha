# 🚀 Deployment Guide

## Frontend → Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. From project root
cd frontend
npm run build

# 3. Deploy
vercel --prod

# 4. Set environment variables in Vercel dashboard:
#    VITE_API_BASE_URL = https://your-backend.railway.app/api/v1
#    VITE_WS_URL      = wss://your-backend.railway.app/api/v1/ws/threat-stream
```

## Backend → Railway

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login & init
railway login
railway init

# 3. Set environment variables
railway variables set TWILIO_ACCOUNT_SID=ACxxx
railway variables set TWILIO_AUTH_TOKEN=xxx
railway variables set TWILIO_FROM_NUMBER=+1xxx
railway variables set ALERT_TO_NUMBER=+1xxx
railway variables set SMTP_USER=your@gmail.com
railway variables set SMTP_PASSWORD=app_password
railway variables set ALERT_EMAIL_TO=guardian@example.com
railway variables set ALLOWED_ORIGINS=https://your-app.vercel.app

# 4. Deploy via Dockerfile
railway up --dockerfile Dockerfile
```

## Backend → Render (alternative)

1. Connect GitHub repo at render.com
2. Select "Docker" environment  
3. Set root directory: `/`
4. Dockerfile path: `Dockerfile`
5. Add all environment variables from `.env.example`

## Local Development

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
cp .env.example .env    # fill in credentials
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
cp .env.example .env.local
# set VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

## API Documentation

After starting the backend, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc
