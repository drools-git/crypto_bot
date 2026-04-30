@echo off
echo ==============================================
echo Installing Crypto Trading Workstation (Conda Edition)
echo ==============================================

echo [1/2] Setting up Backend with Conda...
:: Crear el entorno si no existe (-n crypto_bot)
call conda create -n crypto_bot python=3.12 -y
:: Instalar dependencias usando conda run para evitar problemas de activacion en scripts
call conda run -n crypto_bot python -m pip install --upgrade pip
call conda run -n crypto_bot pip install -r backend/requirements.txt

echo [2/2] Setting up Frontend...
cd frontend
call npm install
call npm install lucide-react lightweight-charts
:: shadcn init suele ser interactivo, pero con -y intentamos forzar
call npx -y shadcn@latest init -y
cd ..

echo ==============================================
echo Installation Complete!
echo Conda environment "crypto_bot" is ready.
echo You must copy .env.example to .env to set API keys.
echo Run startup.bat to start the workstation.
echo ==============================================
pause
