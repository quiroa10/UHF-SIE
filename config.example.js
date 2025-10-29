module.exports = {
  // Configuración del servidor
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  },

  // Configuración CF601 (USB-Serial)
  cf601: {
    defaultPort: process.env.CF601_DEFAULT_PORT || 'COM4',
    defaultBaudRate: parseInt(process.env.CF601_DEFAULT_BAUDRATE) || 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  },

  // Configuración CF816 (TCP/IP)
  cf816: {
    defaultHost: process.env.CF816_DEFAULT_HOST || '192.168.1.100',
    defaultPort: parseInt(process.env.CF816_DEFAULT_PORT) || 4001,
    timeout: 5000
  },

  // Configuración de logs y datos
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxLogs: parseInt(process.env.MAX_LOGS) || 100,
    maxDataRecords: parseInt(process.env.MAX_DATA_RECORDS) || 100
  }
};
