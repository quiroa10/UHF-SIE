# Sistema de Integración Chafon RFID

Sistema de integración para lectores RFID UHF Chafon CF601 y CF816 con interfaz web y API REST.

## 🚀 Características

- **Conexión CF601**: USB-Serial (COM) para lector de escritorio
- **Conexión CF816**: TCP/IP para lector fijo multiantena
- **Interfaz Web**: Dashboard moderno para control y monitoreo
- **API REST**: Endpoints para integración con otros sistemas
- **Docker**: Contenedor listo para despliegue
- **Logs en Tiempo Real**: Monitoreo de actividad de los dispositivos

## 📋 Requisitos

- Docker y Docker Compose
- Lectores Chafon CF601 y/o CF816
- Navegador web moderno

## 🛠️ Instalación y Uso

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd chafon-rfid-reader
```

### 2. Construir y Ejecutar con Docker

```bash
# Construir la imagen
docker-compose build

# Ejecutar el contenedor
docker-compose up -d
```

### 3. Acceder al Dashboard

Abre tu navegador y ve a: `http://localhost:3000`

El dashboard te permitirá:
- Conectar y desconectar los lectores CF601 y CF816
- Configurar puertos COM y direcciones IP
- Iniciar/detener la lectura de etiquetas
- Ver logs en tiempo real
- Monitorear el estado de los dispositivos

## 🔌 Configuración de Dispositivos

### CF601 (Lector USB)

1. Conecta el CF601 a tu computadora via USB
2. Configura el dispositivo en modo USB-Serial (COM)
3. En el dashboard, selecciona el puerto COM correcto
4. Configura la velocidad de baudios (típicamente 9600)
5. Haz clic en "Conectar CF601"

### CF816 (Lector Ethernet)

1. Conecta el CF816 a tu red local via Ethernet
2. Configura la IP del dispositivo (ej: 192.168.1.100)
3. En el dashboard, ingresa la IP y puerto (típicamente 4001)
4. Haz clic en "Conectar CF816"

## 📡 API Endpoints

### Estado del Sistema
```
GET /api/status
```

### CF601
```
POST /api/hardware/connect/cf601
{
  "port": "COM3",
  "baudRate": 9600
}

POST /api/hardware/disconnect/cf601
```

### CF816
```
POST /api/hardware/connect/cf816
{
  "ip": "192.168.1.100",
  "port": 4001
}

POST /api/hardware/disconnect/cf816
```

### Control General
```
POST /api/hardware/start-all
POST /api/hardware/stop-all
POST /api/hardware/disconnect-all
```

### Datos y Logs
```
GET /api/data
GET /api/logs
GET /api/ports
```

## 📊 Datos Capturados

### CF601
- **EPC**: Electronic Product Code
- **TID**: Tag Identifier (si disponible)
- **Timestamp**: Momento de lectura
- **Raw Data**: Datos crudos recibidos

### CF816
- **EPC**: Electronic Product Code
- **TID**: Tag Identifier (si disponible)
- **RSSI**: Fuerza de señal recibida
- **Antenna**: Puerto de antena (1-8)
- **Timestamp**: Momento de lectura
- **Raw Data**: Datos crudos recibidos

## 🐳 Docker

El sistema está configurado para funcionar en cualquier sistema operativo. Los puertos serie se configurarán automáticamente cuando conectes los dispositivos.

## 🧪 Prueba Rápida

### Probar el Sistema
```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Abrir navegador en: http://localhost:3000
```

## 🔧 Desarrollo

### Instalar Dependencias
```bash
npm install
```

### Ejecutar en Modo Desarrollo
```bash
npm run dev
```

### Estructura del Proyecto
```
src/
├── app.js              # Servidor principal
├── readers/
│   ├── CF601Reader.js  # Clase para CF601
│   └── CF816Reader.js  # Clase para CF816
public/
└── index.html          # Dashboard web
```

## 🚨 Solución de Problemas

### CF601 no se conecta
- Verifica que el puerto COM esté disponible
- Confirma que el dispositivo esté en modo USB-Serial
- Revisa los logs del sistema

### CF816 no se conecta
- Verifica la conectividad de red
- Confirma la IP y puerto del dispositivo
- Revisa la configuración de firewall

### Docker no puede acceder a puertos serie
- En Linux, agrega tu usuario al grupo dialout
- En Windows, usa el formato `//./COM1`
- Verifica permisos del contenedor

## 📝 Logs

Los logs están disponibles en:
- Dashboard web (tiempo real)
- API: `GET /api/logs`
- Consola del contenedor Docker

## 🔒 Seguridad

- El contenedor se ejecuta con usuario no-root
- Headers de seguridad habilitados
- CORS configurado para desarrollo

## 📞 Soporte

Para problemas específicos de los lectores Chafon, consulta la documentación oficial del fabricante.

## 📄 Licencia

MIT License
