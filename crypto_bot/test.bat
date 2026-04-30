@echo off
echo ==============================================
echo Running Backend Tests with Coverage (Conda)
echo ==============================================
cd backend
call conda run -n crypto_bot pytest
cd ..

echo ==============================================
echo Running Frontend Tests (Jest)
echo ==============================================
cd frontend
call npm test
cd ..
pause
