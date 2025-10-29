const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const CF601Reader = require('./readers/CF601Reader');
const CF816Reader = require('./readers/CF816Reader');
let HID;
try {
  HID = require('node-hid');
} catch (_) {
  HID = null;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Permitir scripts inline para desarrollo
      scriptSrcAttr: ["'unsafe-inline'"], // Permitir event handlers inline
      styleSrc: ["'self'", "'unsafe-inline'"], // Permitir estilos inline
    },
  },
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static('.')); // Servir archivos estáticos desde la raíz del proyecto

// Instancias de lectores
const cf601Reader = new CF601Reader();
const cf816Reader = new CF816Reader();

// Ruta principal para el dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../index.html');
});

// HID: listar dispositivos
app.get('/api/hid/list', (req, res) => {
  if (!HID) {
    return res.status(500).json({ success: false, message: 'node-hid no instalado' });
  }
  try {
    const devices = HID.devices();
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rutas de la API
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      cf601: {
        isConnected: cf601Reader.isConnected(),
        status: cf601Reader.getStatus()
      },
      cf816: {
        isConnected: cf816Reader.isConnected(),
        status: cf816Reader.getStatus()
      }
    }
  });
});

// Rutas para CF601
app.post('/api/hardware/connect/cf601', async (req, res) => {
  try {
    const { port, baudRate = 9600 } = req.body;
    const result = await cf601Reader.connect(port, baudRate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error conectando CF601: ${error.message}`
    });
  }
});

// Conectar CF601 vía USB-OPEN (HID)
app.post('/api/hardware/connect/cf601-usbopen', async (req, res) => {
  try {
    const { path, vendorId, productId } = req.body || {};
    if (!cf601Reader.connectUSBOpen) {
      return res.status(500).json({ success: false, message: 'Función USB-OPEN no disponible en CF601Reader' });
    }
    const result = await cf601Reader.connectUSBOpen({ path, vendorId, productId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: `Error conectando CF601 USB-OPEN: ${error.message}` });
  }
});

app.post('/api/hardware/disconnect/cf601', async (req, res) => {
  try {
    const result = await cf601Reader.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error desconectando CF601: ${error.message}`
    });
  }
});

// Rutas para CF816
app.post('/api/hardware/connect/cf816', async (req, res) => {
  try {
    const { ip, port = 4001 } = req.body;
    const result = await cf816Reader.connect(ip, port);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error conectando CF816: ${error.message}`
    });
  }
});

app.post('/api/hardware/disconnect/cf816', async (req, res) => {
  try {
    const result = await cf816Reader.disconnect();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error desconectando CF816: ${error.message}`
    });
  }
});

// Rutas para control general
app.post('/api/hardware/start-all', async (req, res) => {
  try {
    const results = [];
    
    if (cf601Reader.isConnected()) {
      const cf601Result = await cf601Reader.startReading();
      results.push({ device: 'CF601', result: cf601Result });
    }
    
    if (cf816Reader.isConnected()) {
      const cf816Result = await cf816Reader.startReading();
      results.push({ device: 'CF816', result: cf816Result });
    }
    
    res.json({
      success: true,
      message: 'Lectura iniciada en todos los dispositivos conectados',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error iniciando lectura: ${error.message}`
    });
  }
});

app.post('/api/hardware/stop-all', async (req, res) => {
  try {
    const results = [];
    
    if (cf601Reader.isConnected()) {
      const cf601Result = await cf601Reader.stopReading();
      results.push({ device: 'CF601', result: cf601Result });
    }
    
    if (cf816Reader.isConnected()) {
      const cf816Result = await cf816Reader.stopReading();
      results.push({ device: 'CF816', result: cf816Result });
    }
    
    res.json({
      success: true,
      message: 'Lectura detenida en todos los dispositivos conectados',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error deteniendo lectura: ${error.message}`
    });
  }
});

app.post('/api/hardware/disconnect-all', async (req, res) => {
  try {
    const results = [];
    
    if (cf601Reader.isConnected()) {
      const cf601Result = await cf601Reader.disconnect();
      results.push({ device: 'CF601', result: cf601Result });
    }
    
    if (cf816Reader.isConnected()) {
      const cf816Result = await cf816Reader.disconnect();
      results.push({ device: 'CF816', result: cf816Result });
    }
    
    res.json({
      success: true,
      message: 'Todos los dispositivos desconectados',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error desconectando dispositivos: ${error.message}`
    });
  }
});

// Ruta para obtener puertos COM disponibles
app.get('/api/ports', async (req, res) => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    const comPorts = ports
      .filter(port => port.path.includes('COM') || port.path.includes('tty'))
      .map(port => port.path);
    
    res.json({
      success: true,
      ports: comPorts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error obteniendo puertos: ${error.message}`,
      ports: []
    });
  }
});

// Ruta para obtener logs en tiempo real
app.get('/api/logs', (req, res) => {
  res.json({
    success: true,
    logs: {
      cf601: cf601Reader.getLogs(),
      cf816: cf816Reader.getLogs()
    }
  });
});

// Ruta para obtener logs detallados del servidor
app.get('/api/server-logs', (req, res) => {
  res.json({
    success: true,
    serverLogs: {
      cf601: cf601Reader.getDetailedLogs(),
      cf816: cf816Reader.getDetailedLogs(),
      system: getSystemLogs()
    }
  });
});

// Función para obtener logs del sistema
function getSystemLogs() {
  return [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Sistema funcionando',
      source: 'system'
    }
  ];
}

// Ruta para obtener datos leídos
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    data: {
      cf601: cf601Reader.getReadData(),
      cf816: cf816Reader.getReadData()
    }
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Chafon RFID iniciado en puerto ${PORT}`);
  console.log(`📡 Dashboard disponible en: http://localhost:${PORT}`);
  console.log(`🔌 API disponible en: http://localhost:${PORT}/api`);
});

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor...');
  await cf601Reader.disconnect();
  await cf816Reader.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Cerrando servidor...');
  await cf601Reader.disconnect();
  await cf816Reader.disconnect();
  process.exit(0);
});
