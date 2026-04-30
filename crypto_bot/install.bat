@echo off
echo ==============================================
echo Installing Crypto Trading Workstation
echo ==============================================

echo [1/2] Setting up Backend...
cd backend
python -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..

echo [2/2] Setting up Frontend...
cd frontend
call npm install
call npm install lucide-react lightweight-charts
call npx shadcn@latest init -y
cd ..

echo ==============================================
echo Installation Complete!
echo You must copy .env.example to .env to set API keys.
echo Run startup.bat to start the workstation.
echo ==============================================
pause
