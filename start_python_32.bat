@echo off
setlocal

:: Script para iniciar el microservicio con Python 32-bit (x86)
:: Requiere tener instalado el "Python Launcher for Windows" y Python 32-bit

set VENV_NAME=.venv32
set PYTHON_EXE=%VENV_NAME%\Scripts\python.exe
set APP_SCRIPT=app.py
set REQUIREMENTS_FILE=requirements.txt

:: Verifica que el Python Launcher (py) exista
where py >nul 2>&1
if errorlevel 1 (
    echo No se encontro el Python Launcher ^("py"^). Instala Python para Windows con el launcher.
    pause
    exit /b 1
)

:: Crea el entorno virtual con Python 32-bit si no existe
if not exist %VENV_NAME% (
    echo Creando entorno virtual 32-bit en %VENV_NAME% ...
    py -3.13-32 -m venv %VENV_NAME%
    if errorlevel 1 (
        echo Error al crear el entorno virtual con Python 32-bit.
        echo Asegurate de tener instalada la version 32-bit (x86) de Python 3.13.
        echo Puedes verificar versiones instaladas con: py -0p
        pause
        exit /b 1
    )
)

:: Activa el entorno virtual
echo Activando entorno virtual 32-bit...
call %VENV_NAME%\Scripts\activate.bat
if errorlevel 1 (
    echo Error al activar el entorno virtual 32-bit.
    pause
    exit /b 1
)

:: Instala dependencias
echo Instalando dependencias en entorno 32-bit...
pip install -r %REQUIREMENTS_FILE%
if errorlevel 1 (
    echo Error al instalar dependencias.
    pause
    exit /b 1
)

:: Inicia el microservicio Flask con Python 32-bit con redireccion de logs correcta
echo Iniciando microservicio Flask (32-bit)...
mkdir logs >nul 2>&1
echo Los logs se guardaran en logs\python_service_32.out.log y logs\python_service_32.err.log

:: Usamos PowerShell para redirigir stdout/stderr del proceso hijo al archivo de log
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '%APP_SCRIPT%' -RedirectStandardOutput 'logs\\python_service_32.out.log' -RedirectStandardError 'logs\\python_service_32.err.log' -WindowStyle Hidden"

:: Espera breve y health-check
timeout /t 2 >nul
echo Verificando salud del servicio en http://127.0.0.1:5005/health ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5005/health; if ($r.StatusCode -eq 200) { Write-Host 'HEALTH OK'; } else { Write-Host ('HEALTH HTTP ' + $r.StatusCode); } } catch { Write-Host 'HEALTH FAIL'; exit 1 }"

echo Microservicio Python (32-bit) lanzado. Para detenerlo usa stop_python.bat
echo Abre logs\python_service_32.log para ver salida detallada.
pause
endlocal


