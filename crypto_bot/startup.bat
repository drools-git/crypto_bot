@echo off
echo ==============================================
echo Starting Crypto Trading Workstation (Conda)
echo ==============================================

:: Start Backend Server using Conda (Port 8001 for better compatibility)
start "Crypto Bot Backend" cmd /k "cd backend && conda run -n crypto_bot uvicorn app.main:app --host 127.0.0.1 --port 8001"

:: Start Frontend Next.js Server on Port 4000 (Allow LAN access)
start "Crypto Bot Frontend" cmd /k "cd frontend && npm run dev -- -H 0.0.0.0 -p 4000"

echo Services have been launched in separate windows!
echo FastApi: http://localhost:8000
echo Next.js:  http://localhost:4000
echo ==============================================
