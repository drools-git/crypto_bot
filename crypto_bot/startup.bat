@echo off
echo ==============================================
echo Starting Crypto Trading Workstation (Conda)
echo ==============================================

:: Start Backend Server using Conda
start "Crypto Bot Backend" cmd /k "conda run -n crypto_bot uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend Next.js Server on Port 3001
start "Crypto Bot Frontend" cmd /k "cd frontend && npm run dev -- -p 3001"

echo Services have been launched in separate windows!
echo FastApi: http://localhost:8000
echo Next.js:  http://localhost:3001
echo ==============================================
