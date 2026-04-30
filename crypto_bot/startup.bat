@echo off
echo ==============================================
echo Starting Crypto Trading Workstation (Conda)
echo ==============================================

:: Start Backend Server using Conda
start "Crypto Bot Backend" cmd /k "cd backend && conda run -n crypto_bot uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend Next.js Server on Port 4000
start "Crypto Bot Frontend" cmd /k "cd frontend && npm run dev -- -p 4000"

echo Services have been launched in separate windows!
echo FastApi: http://localhost:8000
echo Next.js:  http://localhost:4000
echo ==============================================
