@echo off
:: ============================================================
:: launch.bat
:: 1. Start Caddy (reverse proxy)
:: 2. Open terminal in project folder and run the dev command
:: 3. Open Chrome fullscreen (kiosk mode) at a specific URL,
::    with autoplay-policy flag + a simulated Enter keypress
::    as a backup in case autoplay is still blocked
:: ============================================================

:: ---- Step 1: Start Caddy (reverse proxy) in its own terminal ----
set "CADDY_FOLDER=C:\Users\admin\Documents\caddy"

start "Caddy" cmd /k "cd /d "%CADDY_FOLDER%" && .\caddy_windows_amd64.exe run"

:: Give Caddy time to start before launching the project
timeout /t 5 /nobreak >nul

:: ---- Step 2: Open terminal in project folder and run the dev command ----
set "TARGET_FOLDER=C:\Users\admin\Documents\GitHub\nagpur-marina"
set "COMMAND_TO_RUN=bun run dev:with-mock"

start "MyTerminal" cmd /k "cd /d "%TARGET_FOLDER%" && %COMMAND_TO_RUN%"

:: Give the command a moment to start up before opening Chrome
:: (increase/decrease the number of seconds as needed)
timeout /t 5 /nobreak >nul

:: ---- Step 3: Open Chrome fullscreen at a URL ----
set "URL=http://localhost:3001"
set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"

start "" "%CHROME_PATH%" --kiosk --new-window --no-first-run --no-default-browser-check --disable-sync --disable-features=Translate --autoplay-policy=no-user-gesture-required --user-data-dir="%TEMP%\chrome-kiosk" "%URL%"

:: ---- Step 4: Backup - simulate Enter keypress in case autoplay is still blocked ----
:: Give Chrome time to open and the page to load before sending the keypress
timeout /t 5 /nobreak >nul
powershell -command "(New-Object -ComObject WScript.Shell).AppActivate('Chrome'); Start-Sleep -Milliseconds 500; (New-Object -ComObject WScript.Shell).SendKeys('~')"

exit