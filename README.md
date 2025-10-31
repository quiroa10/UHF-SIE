# Sistema de Integración Chafon RFID

Sistema de integración para lectores RFID UHF Chafon CF601 (USB-OPEN) y CF816 (TCP/IP) con microservicio Python e interfaz web HTML5.

## 🚀 Características

- **CF601**: Conexión USB-OPEN via `UHFPrimeReader.dll` (x86)
- **CF816**: Conexión TCP/IP via `UHFReader288.dll` (x86)
- **Interfaz Web**: Dashboard HTML5 para control y monitoreo
- **Microservicio Python**: Flask en puerto 5005
- **Logs en Tiempo Real**: Monitoreo detallado de actividad
- **Soporte EPC**: Lectura de tags con RSSI, Antena, Canal

## 📋 Requisitos

### Sistema Operativo
- Windows 10/11 (x64) con Python 32-bit (x86) instalado

### Lectores Chafon
- CF601: Lector USB de escritorio (modo USB-OPEN)
- CF816: Lector Ethernet multi-antena

### Navegador Web
- Chrome, Edge, o Firefox (versión reciente)

## 🛠️ Instalación

### 1. Instalar Python 32-bit

1. Descargar Python 3.13 **x86 (32-bit)** desde [python.org](https://www.python.org/downloads/)
2. Durante la instalación, marcar **"Add Python to PATH"** y **"Install Python launcher"**
3. Verificar la instalación:
   ```cmd
   py -0p
   ```
   Debe mostrar una entrada con `-3.13-32`

### 2. Preparar el Proyecto

1. Descomprimir o clonar el proyecto completo (incluida la carpeta `vendor_sdk/`)
2. Navegar a la carpeta del proyecto:
   ```cmd
   cd UHF-SIE
   ```
3. **IMPORTANTE**: Copiar DLLs necesarias al directorio raíz:
   ```cmd
   :: CF601 USB-OPEN
   copy "vendor_sdk\UHF Desk Reader SDK\Software V1.1.2\hidapi.dll" .
   
   :: CF816 TCP/IP (opcional - el script las encuentra automáticamente)
   :: copy "vendor_sdk\CF815.CF816.CF817 SDK\SDK\VC\x32\UHFReader288.dll" .
   ```
   
   **Nota**: El sistema busca las DLLs automáticamente en `vendor_sdk/`, pero copiarlas al raíz simplifica la configuración.

### 3. Crear Entorno Virtual

```cmd
py -3.13-32 -m venv .venv32
```

### 4. Activar Entorno Virtual

```cmd
.venv32\Scripts\activate
```

### 5. Instalar Dependencias

```cmd
pip install -r requirements.txt
```

### 6. Ejecutar el Servicio

**Opción A: Script Automático**
```cmd
start_python_32.bat
```

**Opción B: Manual**
```cmd
.venv32\Scripts\activate
pip install -r requirements.txt
python app.py
```

Nota: Si ejecutas manualmente, presiona `CTRL+C` para detener el servicio.

El servicio estará disponible en: `http://127.0.0.1:5005`

Verificar salud:
```cmd
curl http://127.0.0.1:5005/health
```

### 7. Abrir la Interfaz Web

Abrir `index.html` en tu navegador (Chrome/Edge recomendado).

## 🔌 Uso del Dashboard

### CF601

**Modo COM (Serial - Recomendado):**

1. **Seleccionar modo**: "COM (Serial)" en el selector
2. **Seleccionar puerto**: El sistema detecta automáticamente los puertos disponibles
3. **Velocidad**: 115200 baud (recomendado)
4. **Conectar**: Click en "Conectar Serial"
5. **Lectura**: Click en "Iniciar Lectura" / "Detener Lectura"

**Modo USB-OPEN (Limitaciones conocidas):**

1. **Seleccionar modo**: "USB-OPEN" en el selector
2. **Conectar**: Click en "Conectar USB-OPEN"
3. **Nota**: Puede tener problemas en Windows con Python (ver "Error -255" en Solución de Problemas)

### CF816 (TCP/IP)

1. **Configurar IP y Puerto**: 
   - IP: `192.168.1.64` (ajustar según dispositivo)
   - Puerto: `27011` (ajustar según configuración)
2. **Conectar**: Click en "Conectar CF816"
3. **Health**: Verificar conexión
4. **Potencia**: Ajustar si es necesario
5. **Lectura**: Click en "Iniciar Lectura CF816" / "Detener Lectura CF816"

### Logs

- **Consola**: Panel "Logs del Sistema" (lado derecho)
- **Logs Detallados**: Panel inferior con información completa
- **Exportar**: Botón "Exportar Logs" para guardar en archivo

### Reiniciar el Servicio

**Para aplicar cambios o resolver problemas:**

1. **Detener el servicio**:
   ```cmd
   stop_python.bat
   ```

2. **Iniciar nuevamente**:
   ```cmd
   start_python_32.bat
   ```

**O manualmente:**

1. **Detener**: Buscar y cerrar el proceso Python que usa el puerto 5005
   ```cmd
   netstat -ano | findstr :5005
   taskkill /PID <numero_pid> /F
   ```

2. **Iniciar**: Ejecutar `start_python_32.bat` nuevamente

### Verificar Instalación

**Comprobar que todo está correcto:**

1. **Verificar que pyserial está instalado**:
   ```cmd
   .venv32\Scripts\activate
   pip list | findstr pyserial
   ```
   Debe mostrar: `pyserial     3.5`

2. **Verificar logs del servicio**:
   ```cmd
   type logs\python_service_32.out.log
   ```
   Debe mostrar: `[DEBUG] pyserial disponible: True`

3. **Verificar que el servidor responde**:
   ```cmd
   curl http://127.0.0.1:5005/ports
   ```
   Debe responder: `{"ports":["COM4"],"success":true}` (o los puertos que tengas)

## 📡 API Endpoints

### Health Check
```
GET /health
```

### CF601 - USB-OPEN

**Abrir Dispositivo**
```
POST /open
```

**Iniciar Inventario**
```
POST /inventory/start
```

**Obtener Tag**
```
GET /get-tag
```

**Detener Inventario**
```
POST /inventory/stop
```

**Obtener/Establecer Potencia**
```
GET /rf/power
POST /rf/power
Body: {"power": 20}  # 0-30
```

**Cerrar Dispositivo**
```
POST /close
```

### CF816 - TCP/IP

**Abrir Conexión**
```
POST /cf816/net/open
Body: {"ip": "192.168.1.64", "port": 27011, "timeoutMs": 200}
```

**Iniciar Inventario**
```
POST /cf816/inventory/start
```

**Obtener Tag**
```
GET /cf816/get-tag
```

**Detener Inventario**
```
POST /cf816/inventory/stop
```

**Obtener/Establecer Potencia**
```
GET /cf816/rf/power
POST /cf816/rf/power
Body: {"power": 20}  # 0-30
```

**Cerrar Conexión**
```
POST /cf816/close
```

## 📊 Datos Capturados

### CF601 (USB-OPEN)
- **EPC**: Electronic Product Code (hex)
- **RSSI**: Fuerza de señal recibida (dbm)
- **Antena**: Puerto de antena activa
- **Canal**: Canal de frecuencia
- **Timestamp**: Momento de lectura

### CF816 (TCP/IP)
- **EPC**: Electronic Product Code (hex)
- **CardNum**: Número de tag leído

## 🚨 Solución de Problemas

### "WinError 193" al cargar DLL

**Causa**: Python 64-bit intentando cargar DLL 32-bit

**Solución**:
```cmd
# Verificar arquitectura de Python
python -c "import platform; print(platform.architecture())"

# Debe mostrar: ('32bit', 'WindowsPE')
# Si muestra 64bit, reinstalar Python 32-bit
```

### "No se encontró UHFPrimeReader.dll"

**Causa**: DLL no está en las rutas esperadas

**Solución**:
1. Copiar `hidapi.dll` y `UHFPrimeReader.dll` a la carpeta del proyecto (junto a `app.py`)
2. O verificar que la carpeta `vendor_sdk/` esté completa

### "OpenDevice rc=-255" (CF601 USB-OPEN)

**Causa**: Error común al intentar conectar CF601 vía USB-OPEN. Indica problemas de comunicación con el dispositivo.

**Posibles Causas**:
1. **Dispositivo no en modo USB-OPEN**: El CF601 debe configurarse en modo USB-OPEN (no COM) mediante su software oficial o jumper
2. **Controlador USB no instalado**: Windows no reconoce el CF601 como dispositivo HID
3. **hidapi.dll no encontrada**: La DLL auxiliar no está en el directorio correcto
4. **Dispositivo no conectado físicamente**
5. **Parámetros incorrectos de conexión**: La DLL requiere configuración específica del fabricante

**Soluciones (en orden)**:
1. **Verificar modo del dispositivo**: 
   - Usar el software oficial del fabricante para confirmar modo "USB-OPEN"
   - Verificar configuración física (jumper/dip switch) si aplica
2. **Verificar instalación USB**: 
   - Windows debe reconocer el dispositivo en "Administrador de dispositivos"
   - Buscar por "VID/PID" del fabricante Chafon
   - Si aparece como "Unknown device", instalar controlador desde el SDK
3. **Copiar hidapi.dll manualmente**:
   ```cmd
   copy "vendor_sdk\UHF Desk Reader SDK\Software V1.1.2\hidapi.dll" "vendor_sdk\UHF Desk Reader SDK\API\"
   ```
   Verificar que exista junto a `UHFPrimeReader.dll`
4. **Revisar logs**:
   ```cmd
   type logs\python_service_32.err.log
   type logs\python_service_32.out.log
   ```
5. **Alternativa - Modo COM**: Si USB-OPEN no funciona, probar conexión serial
   - Cambiar modo a COM y ajustar parámetros en `app.py`
   - Ver documentación del SDK para ejemplo COM

**Nota Crítica**: `-255` parece ser una limitación del SDK en Windows para Python/ctypes. Los ejemplos oficiales del SDK (C#, Delphi, Java) usan `UHF_Reader_API.dll` (wrapper .NET) o implementaciones nativas que no están disponibles en Python. El SDK Linux/ARM expone `OpenHidConnection` directamente, pero la DLL Windows x86 no.

**Solución Temporal**: Si USB-OPEN no funciona con Python, usar el software oficial del fabricante (`UHF_Desk.exe`) para verificar que el dispositivo funciona correctamente.

### "Health" no responde

**Causa**: Servicio no está ejecutándose

**Solución**:
```cmd
# Verificar puerto 5005
netstat -ano | find "5005"

# Si no hay proceso, reiniciar:
python app.py

# Si el puerto está ocupado, cerrar proceso anterior:
taskkill /PID <numero_pid> /F
```

### CF816 no conecta

**Causa**: Configuración de red incorrecta

**Solución**:
1. Verificar IP del CF816 (usar herramienta de fabricante)
2. Verificar que el puerto sea correcto (por defecto 6000 o 27011)
3. Ping desde Windows: `ping 192.168.1.64`
4. Verificar firewall (desactivar temporalmente si es necesario)

### "Failed to fetch" en HTML

**Causa**: CORS o servicio no disponible

**Solución**:
1. Verificar que el servicio Python esté ejecutándose
2. Abrir DevTools (F12) y revisar errores de red
3. Verificar `http://127.0.0.1:5005/health` manualmente

## 🔧 Desarrollo

### Estructura del Proyecto

```
UHF-SIE/
├── app.py                      # Microservicio Flask
├── requirements.txt            # Dependencias Python
├── index.html                  # Dashboard HTML5
├── start_python_32.bat        # Script inicio automático
├── stop_python.bat            # Script detener servicio
├── vendor_sdk/                 # SDKs de fabricante
│   ├── UHF Desk Reader SDK/
│   │   └── API/
│   │       ├── UHFPrimeReader.dll  # CF601
│   │       └── hidapi.dll           # USB-OPEN
│   └── CF815.CF816.CF817 SDK/
│       └── SDK/VC/x32/
│           └── UHFReader288.dll     # CF816
└── Legacy/                     # Código Node.js obsoleto
```

### Dependencias Python

- `Flask`: Servidor web
- `flask-cors`: Soporte CORS para HTML local

### Logs

Los logs se guardan en:
- **Salida estándar**: Console cuando `python app.py`
- **Archivos**: `logs/python_service_32.out.log` y `.err.log`

Para ver logs en tiempo real:
```cmd
type logs\python_service_32.out.log
```

## 🔒 Seguridad

- El servicio escucha solo en `127.0.0.1` (local)
- CORS configurado para permitir `file://` (HTML local)
- Firewall puede bloquear puerto 5005 (agregar excepción si es necesario)

## 📞 Soporte

Para problemas específicos de los lectores Chafon, consulta:
- **CF601**: Documentación "UHF Prime Reader.DLL动态库使用手册 V1.3"
- **CF816**: Documentación "UHFReader288.DLL manual V3.0"

## 📄 Licencia

MIT License

## 🎯 Changelog

### v2.0 (Actual)
- Migración a Python 32-bit (Python 3.13 x86)
- Microservicio Flask en puerto 5005
- Soporte CF601 USB-OPEN (UHFPrimeReader.dll)
- Soporte CF816 TCP/IP (UHFReader288.dll)
- Dashboard HTML5 modernizado
- Logs detallados con exportación
- Gestión automática de hidapi.dll
- Detección flexible de DLLs en SDK
- Estructuras de datos completas (RSSI, Antena, Canal)
- Health check y diagnóstico de errores

**Nota**: CF601 USB-OPEN requiere dispositivo físico para pruebas. Error -255 indica configuración específica del hardware.

### v1.0 (Legacy)
- Node.js + Express
- Docker Compose
- Soporte Serial/TCP básico
