@echo off
echo ==============================================
echo Running Tests with Coverage (Conda)
echo ==============================================
cd backend
call conda run -n crypto_bot pytest
cd ..
pause
