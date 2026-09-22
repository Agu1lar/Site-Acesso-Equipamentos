@echo off
cd /d "%~dp0\.."
:loop
echo [%date% %time%] iniciando Eva >> "%~dp0\..\after-hours-watch.log"
"C:\Program Files\nodejs\npm.cmd" run after-hours -- --live
echo [%date% %time%] worker parou, religa em 5s >> "%~dp0\..\after-hours-watch.log"
timeout /t 5 /nobreak >nul
goto loop
