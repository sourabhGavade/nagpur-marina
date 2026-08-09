@echo off
setlocal
cd /d "%~dp0.."

echo Building nagpur-marina:latest ...
docker build -t nagpur-marina:latest .
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo.
echo Build complete: nagpur-marina:latest
echo Next: scripts\docker-export.bat
endlocal
