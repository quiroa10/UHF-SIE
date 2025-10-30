@echo off
setlocal
echo Deteniendo servicio Python en puerto 5005...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5005 ^| findstr LISTENING') do (
  echo Terminando PID %%a
  taskkill /PID %%a /F >nul 2>&1
)

echo Listo.
endlocal

