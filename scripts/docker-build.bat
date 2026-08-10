@echo off
setlocal
cd /d "%~dp0.."

if not exist "ENVs\ENVs\tablet-nextjs\.env" (
  echo ERROR: missing ENVs\ENVs\tablet-nextjs\.env
  exit /b 1
)
if not exist "ENVs\ENVs\tv-nextjs\.env" (
  echo ERROR: missing ENVs\ENVs\tv-nextjs\.env
  exit /b 1
)

echo Building nagpur-marina:latest from ENVs\ENVs ...
echo   tablet: 
type ENVs\ENVs\tablet-nextjs\.env
echo   tv:
type ENVs\ENVs\tv-nextjs\.env
echo   server:
type ENVs\ENVs\socket-server\.env

docker build -t nagpur-marina:latest .
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo.
echo Build complete: nagpur-marina:latest
echo Next: scripts\docker-export.bat
endlocal
