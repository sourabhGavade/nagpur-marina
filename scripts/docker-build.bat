@echo off
setlocal
cd /d "%~dp0.."

:: Browser Socket.IO URL (Caddy public endpoint). Override when needed:
::   set NEXT_PUBLIC_SOCKET_URL=https://192.168.0.50:5001
if "%NEXT_PUBLIC_SOCKET_URL%"=="" set "NEXT_PUBLIC_SOCKET_URL=https://192.168.0.111:5001"

echo Building nagpur-marina:latest ...
echo   NEXT_PUBLIC_SOCKET_URL=%NEXT_PUBLIC_SOCKET_URL%
docker build -t nagpur-marina:latest --build-arg "NEXT_PUBLIC_SOCKET_URL=%NEXT_PUBLIC_SOCKET_URL%" .
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo.
echo Build complete: nagpur-marina:latest
echo Next: scripts\docker-export.bat
endlocal
