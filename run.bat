@echo off
:: ============================================================
:: run.bat — site launcher for Nagpur Marina
:: 1. Start Caddy (host reverse proxy), if configured
:: 2. Load Docker image if missing, then start the one container
:: 3. Open Chrome kiosk on the TV app
:: ============================================================
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "IMAGE_NAME=nagpur-marina:latest"
set "CONTAINER_NAME=nagpur-marina"
set "IMAGE_TAR=%SCRIPT_DIR%nagpur-marina.tar"

:: Site-specific paths (edit on the venue PC if needed)
set "CADDY_FOLDER=C:\Users\admin\Documents\caddy"
set "CADDY_EXE=caddy_windows_amd64.exe"
set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "TV_URL=http://localhost:3001"
set "ENABLE_MOCK_HARDWARE=0"

:: ---- Step 1: Caddy (optional — skipped if folder missing) ----
if exist "%CADDY_FOLDER%\%CADDY_EXE%" (
  echo Starting Caddy...
  start "Caddy" cmd /k "cd /d "%CADDY_FOLDER%" && .\%CADDY_EXE% run"
  timeout /t 3 /nobreak >nul
) else (
  echo Caddy not found at "%CADDY_FOLDER%\%CADDY_EXE%" — skipping proxy.
)

:: ---- Step 2: Docker ----
where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker is not installed or not on PATH.
  echo Install Docker Desktop, start it, then run this script again.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker is installed but not running.
  echo Start Docker Desktop, wait until it is ready, then try again.
  pause
  exit /b 1
)

docker image inspect %IMAGE_NAME% >nul 2>&1
if errorlevel 1 (
  if exist "%IMAGE_TAR%" (
    echo Loading image from "%IMAGE_TAR%" ...
    docker load -i "%IMAGE_TAR%"
    if errorlevel 1 (
      echo ERROR: docker load failed.
      pause
      exit /b 1
    )
  ) else (
    echo ERROR: Image %IMAGE_NAME% not found and no tar at:
    echo   %IMAGE_TAR%
    echo Place nagpur-marina.tar next to this script, or load the image manually.
    pause
    exit /b 1
  )
)

docker inspect %CONTAINER_NAME% >nul 2>&1
if not errorlevel 1 (
  echo Removing previous container %CONTAINER_NAME% ...
  docker rm -f %CONTAINER_NAME% >nul 2>&1
)

echo Starting %CONTAINER_NAME% ...
docker run -d --name %CONTAINER_NAME% --restart unless-stopped ^
  -p 3000:3000 -p 3001:3001 -p 4000:4000 ^
  -e ENABLE_MOCK_HARDWARE=%ENABLE_MOCK_HARDWARE% ^
  %IMAGE_NAME%
if errorlevel 1 (
  echo ERROR: docker run failed.
  pause
  exit /b 1
)

:: ---- Wait for health ----
echo Waiting for server health on http://localhost:4000/health ...
set /a ATTEMPTS=0
:wait_health
set /a ATTEMPTS+=1
if %ATTEMPTS% GTR 60 (
  echo ERROR: Server did not become healthy in time.
  echo Check: docker logs %CONTAINER_NAME%
  pause
  exit /b 1
)
curl -fsS http://localhost:4000/health >nul 2>&1
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto wait_health
)
echo Server is healthy.

:: ---- Step 3: Chrome kiosk (TV) ----
if not exist "%CHROME_PATH%" (
  echo WARNING: Chrome not found at "%CHROME_PATH%"
  echo Open the TV manually: %TV_URL%
  pause
  exit /b 0
)

echo Opening Chrome kiosk at %TV_URL% ...
start "" "%CHROME_PATH%" --kiosk --new-window --no-first-run --no-default-browser-check --disable-sync --disable-features=Translate --autoplay-policy=no-user-gesture-required --user-data-dir="%TEMP%\chrome-kiosk" "%TV_URL%"

timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).AppActivate('Chrome'); Start-Sleep -Milliseconds 500; (New-Object -ComObject WScript.Shell).SendKeys('~')"

echo.
echo Nagpur Marina is running.
echo   Tablet:  http://localhost:3000  (or http://^<this-pc-lan-ip^>:3000)
echo   TV:      %TV_URL%
echo   Server:  http://localhost:4000/health
echo Use stop.bat to stop the container.
endlocal
exit /b 0
