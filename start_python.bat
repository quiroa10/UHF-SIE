@echo off
setlocal
cd /d %~dp0

echo Iniciando servicio Python (UHF)...

if not exist .venv (
  echo Creando entorno virtual...
  py -m venv .venv
)

call .venv\Scripts\activate.bat

echo Instalando dependencias (puede tardar la primera vez)...
python -m pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt

echo Levantando servicio en http://127.0.0.1:5005 ...
python app.py

endlocal

