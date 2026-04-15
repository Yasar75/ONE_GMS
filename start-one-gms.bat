@echo off
echo Starting ONE_GMS...

set ROOT=%~dp0

echo [1/2] Starting Backend (FastAPI)...
start "ONE_GMS Backend" cmd /k "cd /d "%ROOT%backend" && venv\Scripts\activate && fastapi dev src\"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (React)...
start "ONE_GMS Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Both servers are starting in separate windows.
