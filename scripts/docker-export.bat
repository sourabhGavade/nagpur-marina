@echo off
setlocal
cd /d "%~dp0.."

if not exist "dist" mkdir dist

echo Exporting nagpur-marina:latest to dist\nagpur-marina.tar ...
docker save nagpur-marina:latest -o dist\nagpur-marina.tar
if errorlevel 1 (
  echo Export failed. Build the image first with scripts\docker-build.bat
  exit /b 1
)

echo.
echo Copied package files for site delivery...
copy /Y run.bat dist\run.bat >nul
copy /Y stop.bat dist\stop.bat >nul
if exist docs\README-SITE.txt (
  copy /Y docs\README-SITE.txt dist\README-SITE.txt >nul
)

echo.
echo Site package ready in dist\:
echo   nagpur-marina.tar
echo   run.bat
echo   stop.bat
echo   README-SITE.txt
endlocal
