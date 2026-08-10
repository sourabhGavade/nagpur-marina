@echo off
:: ============================================================
:: stop.bat — stop the Nagpur Marina Docker container
:: ============================================================
setlocal
set "CONTAINER_NAME=nagpur-marina"

where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker is not on PATH.
  pause
  exit /b 1
)

docker inspect %CONTAINER_NAME% >nul 2>&1
if errorlevel 1 (
  echo Container %CONTAINER_NAME% is not running.
  exit /b 0
)

echo Stopping %CONTAINER_NAME% ...
docker stop %CONTAINER_NAME%
docker rm %CONTAINER_NAME% >nul 2>&1
echo Stopped.
endlocal
