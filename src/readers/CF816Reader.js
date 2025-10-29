const net = require('net');

class CF816Reader {
  constructor() {
    this.client = null;
    this.connected = false;
    this.isReading = false;
    this.logs = [];
    this.readData = [];
    this.config = {
      host: null,
      port: 4001,
      timeout: 5000
    };
  }

  async connect(host, port = 4001) {
    try {
      this.addLog(`Intentando conectar CF816 en ${host}:${port}...`, 'info');
      
      // Cerrar conexión existente si existe
      if (this.client) {
        await this.disconnect();
      }

      this.config.host = host;
      this.config.port = port;

      this.client = new net.Socket();
      this.client.setTimeout(this.config.timeout);

      // Configurar eventos
      this.setupEventHandlers();

      // Conectar
      await new Promise((resolve, reject) => {
        this.client.connect(port, host, () => {
          this.connected = true;
          this.addLog(`✅ CF816 conectado exitosamente en ${host}:${port}`, 'success');
          resolve();
        });

        this.client.on('error', (err) => {
          this.addLog(`❌ Error conectando CF816: ${err.message}`, 'error');
          this.connected = false;
          reject(err);
        });
      });

      return {
        success: true,
        message: `CF816 conectado en ${host}:${port}`,
        host: host,
        port: port
      };

    } catch (error) {
      this.addLog(`❌ Error conectando CF816: ${error.message}`, 'error');
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        this.isReading = false;
        this.client.destroy();
        this.client = null;
        this.connected = false;
        this.addLog('✅ CF816 desconectado exitosamente', 'success');
        
        return {
          success: true,
          message: 'CF816 desconectado'
        };
      } else {
        this.addLog('⚠️ CF816 ya estaba desconectado', 'warning');
        return {
          success: true,
          message: 'CF816 ya estaba desconectado'
        };
      }
    } catch (error) {
      this.addLog(`❌ Error desconectando CF816: ${error.message}`, 'error');
      throw error;
    }
  }

  setupEventHandlers() {
    if (!this.client) return;

    this.client.on('data', (data) => {
      this.processData(data);
    });

    this.client.on('close', () => {
      this.addLog('🔌 Conexión CF816 cerrada', 'info');
      this.connected = false;
      this.isReading = false;
    });

    this.client.on('error', (err) => {
      this.addLog(`❌ Error en conexión CF816: ${err.message}`, 'error');
      this.connected = false;
    });

    this.client.on('timeout', () => {
      this.addLog('⏰ Timeout en conexión CF816', 'warning');
    });
  }

  processData(rawData) {
    try {
      const data = rawData.toString().trim();
      
      if (!data) return;

      this.addLog(`📡 Datos recibidos CF816: ${data}`, 'info');

      // Procesar datos según el protocolo EPC Gen2
      const processedData = {
        timestamp: new Date().toISOString(),
        rawData: data,
        epc: this.extractEPC(data),
        tid: this.extractTID(data),
        rssi: this.extractRSSI(data),
        antenna: this.extractAntenna(data),
        reader: 'CF816',
        dataLength: data.length
      };

      this.readData.push(processedData);
      
      // Mantener solo los últimos 100 registros
      if (this.readData.length > 100) {
        this.readData = this.readData.slice(-100);
      }

      this.addLog(`✅ Datos procesados: EPC=${processedData.epc}, RSSI=${processedData.rssi}, Antena=${processedData.antenna}`, 'success');

    } catch (error) {
      this.addLog(`❌ Error procesando datos CF816: ${error.message}`, 'error');
    }
  }

  extractEPC(data) {
    // El EPC generalmente viene en formato hexadecimal
    // Buscar patrones comunes de EPC
    const hexPattern = /^[0-9A-Fa-f]+$/;
    if (hexPattern.test(data)) {
      return data.toUpperCase();
    }
    
    // Si no es hex puro, intentar extraer de otros formatos
    const epcMatch = data.match(/([0-9A-Fa-f]{8,})/);
    return epcMatch ? epcMatch[1].toUpperCase() : data;
  }

  extractTID(data) {
    // TID generalmente viene después del EPC o en un formato específico
    // Por ahora, retornamos null ya que necesitamos ver el formato real
    return null;
  }

  extractRSSI(data) {
    // RSSI generalmente viene como un valor numérico (ej: -47)
    // Buscar patrones de RSSI
    const rssiMatch = data.match(/RSSI[:\s]*(-?\d+)/i);
    if (rssiMatch) {
      return parseInt(rssiMatch[1]);
    }
    
    // Buscar valores negativos que podrían ser RSSI
    const negativeMatch = data.match(/(-?\d+)/);
    if (negativeMatch && parseInt(negativeMatch[1]) < 0) {
      return parseInt(negativeMatch[1]);
    }
    
    return null;
  }

  extractAntenna(data) {
    // Puerto de antena generalmente viene como un número (1-8)
    const antennaMatch = data.match(/ANT[:\s]*(\d+)/i);
    if (antennaMatch) {
      return parseInt(antennaMatch[1]);
    }
    
    // Buscar números del 1-8 que podrían ser antena
    const antennaMatch2 = data.match(/\b([1-8])\b/);
    if (antennaMatch2) {
      return parseInt(antennaMatch2[1]);
    }
    
    return null;
  }

  async startReading() {
    try {
      if (!this.connected) {
        throw new Error('CF816 no está conectado');
      }

      this.isReading = true;
      this.addLog('▶️ Iniciando lectura CF816...', 'info');

      // Enviar comando de inventario
      // Comando básico para iniciar lectura (esto puede variar según el protocolo)
      const inventoryCommand = this.buildInventoryCommand();
      if (inventoryCommand) {
        this.client.write(inventoryCommand);
        this.addLog(`📤 Comando enviado: ${inventoryCommand}`, 'info');
      }
      
      return {
        success: true,
        message: 'Lectura iniciada en CF816'
      };

    } catch (error) {
      this.addLog(`❌ Error iniciando lectura CF816: ${error.message}`, 'error');
      throw error;
    }
  }

  async stopReading() {
    try {
      this.isReading = false;
      this.addLog('⏹️ Deteniendo lectura CF816...', 'info');
      
      // Enviar comando para detener lectura
      const stopCommand = this.buildStopCommand();
      if (stopCommand && this.client) {
        this.client.write(stopCommand);
        this.addLog(`📤 Comando de parada enviado: ${stopCommand}`, 'info');
      }
      
      return {
        success: true,
        message: 'Lectura detenida en CF816'
      };

    } catch (error) {
      this.addLog(`❌ Error deteniendo lectura CF816: ${error.message}`, 'error');
      throw error;
    }
  }

  buildInventoryCommand() {
    // Comandos específicos para Chafon CF816
    // Basado en documentación EPC Gen2
    return 'INVENTORY\r\n';
  }

  buildStopCommand() {
    // Comando para detener inventario
    return 'STOP\r\n';
  }

  buildGetVersionCommand() {
    // Obtener versión del firmware
    return 'VERSION\r\n';
  }

  buildGetStatusCommand() {
    // Obtener estado del dispositivo
    return 'STATUS\r\n';
  }

  buildSetAntennaCommand(antennaNumber) {
    // Configurar antena específica (1-8)
    return `ANTENNA ${antennaNumber}\r\n`;
  }

  buildSetPowerCommand(powerLevel) {
    // Configurar potencia de transmisión (0-30)
    return `POWER ${powerLevel}\r\n`;
  }

  buildGetAntennaCommand() {
    // Obtener configuración de antenas
    return 'GET_ANTENNA\r\n';
  }

  async sendCommand(command) {
    try {
      if (!this.connected || !this.client) {
        throw new Error('CF816 no está conectado');
      }

      this.client.write(command + '\r\n');
      this.addLog(`📤 Comando enviado: ${command}`, 'info');
      
      return {
        success: true,
        message: `Comando enviado: ${command}`
      };

    } catch (error) {
      this.addLog(`❌ Error enviando comando CF816: ${error.message}`, 'error');
      throw error;
    }
  }

  isConnected() {
    return this.connected && this.client && !this.client.destroyed;
  }

  getStatus() {
    return {
      connected: this.connected,
      reading: this.isReading,
      host: this.config.host,
      port: this.config.port,
      dataCount: this.readData.length
    };
  }

  getLogs() {
    return this.logs.slice(-50); // Últimos 50 logs
  }

  getReadData() {
    return this.readData.slice(-20); // Últimos 20 registros
  }

  addLog(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type,
      device: 'CF816'
    };
    
    this.logs.push(logEntry);
    
    // Mantener solo los últimos 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    console.log(`[CF816] ${message}`);
  }
}

module.exports = CF816Reader;
