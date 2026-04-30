@echo off
echo ==============================================
echo Starting Crypto Trading Workstation
echo ==============================================

:: Start Backend Server in a new window
start "Crypto Bot Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend Next.js Server in a new window
start "Crypto Bot Frontend" cmd /k "cd frontend && npm run dev"

echo Services have been launched in separate windows!
echo FastApi: http://localhost:8000
echo Next.js:  http://localhost:3000
echo ==============================================
