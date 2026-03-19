@echo off
echo Starting Learning Management System...

echo [1/2] Starting Backend (FastAPI)...
start "LMS Backend" cmd /k "cd /d "D:\VS Code\Learning-Management-System\backend" && venv\Scripts\activate && fastapi dev src\"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (React)...
start "LMS Frontend" cmd /k "cd /d "D:\VS Code\Learning-Management-System\frontend" && npm run dev"

echo Both servers are starting in separate windows.
