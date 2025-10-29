const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class CF601Reader {
  constructor() {
    this.port = null;
    this.parser = null;
    this.isReading = false;
    this.connected = false;
    this.logs = [];
    this.readData = [];
    this.config = {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    };
  }

  async connect(portPath, baudRate = 9600) {
    try {
      this.addLog(`Intentando conectar CF601 en ${portPath} (${baudRate} baud)...`, 'info');
      
      // Cerrar conexión existente si existe
      if (this.port && this.port.isOpen) {
        await this.disconnect();
      }

      this.config.baudRate = baudRate;
      
      this.port = new SerialPort({
        path: portPath,
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
        parity: this.config.parity,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      // Configurar eventos
      this.setupEventHandlers();

      // Abrir puerto
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.connected = true;
      this.addLog(`CF601 conectado exitosamente en ${portPath}`, 'success');
      
      return {
        success: true,
        message: `CF601 conectado en ${portPath}`,
        port: portPath,
        baudRate: baudRate
      };

    } catch (error) {
      this.addLog(`Error conectando CF601: ${error.message}`, 'error');
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.port && this.port.isOpen) {
        this.isReading = false;
        
        await new Promise((resolve, reject) => {
          this.port.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });

        this.connected = false;
        this.addLog('CF601 desconectado exitosamente', 'success');
        
        return {
          success: true,
          message: 'CF601 desconectado'
        };
      } else {
        this.addLog('CF601 ya estaba desconectado', 'warning');
        return {
          success: true,
          message: 'CF601 ya estaba desconectado'
        };
      }
    } catch (error) {
      this.addLog(`Error desconectando CF601: ${error.message}`, 'error');
      throw error;
    }
  }

  setupEventHandlers() {
    if (!this.port || !this.parser) return;

    this.port.on('open', () => {
      this.addLog('Puerto CF601 abierto', 'info');
    });

    this.port.on('error', (err) => {
      this.addLog(`Error en puerto CF601: ${err.message}`, 'error');
      this.connected = false;
    });

    this.port.on('close', () => {
      this.addLog('Puerto CF601 cerrado', 'info');
      this.connected = false;
      this.isReading = false;
    });

    this.parser.on('data', (data) => {
      this.processData(data);
    });
  }

  processData(rawData) {
    try {
      const data = rawData.trim();
      
      if (!data) return;

      this.addLog(`Datos recibidos CF601: ${data}`, 'info');

      // Procesar datos según el protocolo EPC Gen2
      const processedData = {
        timestamp: new Date().toISOString(),
        rawData: data,
        epc: this.extractEPC(data),
        tid: this.extractTID(data),
        rssi: null, // CF601 no proporciona RSSI
        antenna: null, // CF601 no tiene múltiples antenas
        reader: 'CF601',
        dataLength: data.length
      };

      this.readData.push(processedData);
      
      // Mantener solo los últimos 100 registros
      if (this.readData.length > 100) {
        this.readData = this.readData.slice(-100);
      }

      this.addLog(`Datos procesados: EPC=${processedData.epc}`, 'success');

    } catch (error) {
      this.addLog(`Error procesando datos CF601: ${error.message}`, 'error');
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

  async startReading() {
    try {
      if (!this.connected) {
        throw new Error('CF601 no está conectado');
      }

      this.isReading = true;
      this.addLog('Iniciando lectura CF601...', 'info');

      // Enviar comandos de inventario al CF601
      if (this.port && this.port.isOpen) {
        // Comandos específicos para Chafon CF601
        const inventoryCommand = this.buildInventoryCommand();
        if (inventoryCommand) {
          this.port.write(inventoryCommand);
          this.addLog(`Comando enviado: ${inventoryCommand}`, 'info');
        }
        
        // Comando para configurar potencia
        const powerCommand = this.buildPowerCommand();
        if (powerCommand) {
          this.port.write(powerCommand);
          this.addLog(`Comando de potencia enviado: ${powerCommand}`, 'info');
        }
      }
      
      return {
        success: true,
        message: 'Lectura iniciada en CF601'
      };

    } catch (error) {
      this.addLog(`Error iniciando lectura CF601: ${error.message}`, 'error');
      throw error;
    }
  }

  async stopReading() {
    try {
      this.isReading = false;
      this.addLog('Deteniendo lectura CF601...', 'info');
      
      // Enviar comando de parada al CF601
      if (this.port && this.port.isOpen) {
        const stopCommand = this.buildStopCommand();
        if (stopCommand) {
          this.port.write(stopCommand);
          this.addLog(`Comando de parada enviado: ${stopCommand}`, 'info');
        }
      }
      
      return {
        success: true,
        message: 'Lectura detenida en CF601'
      };

    } catch (error) {
      this.addLog(`Error deteniendo lectura CF601: ${error.message}`, 'error');
      throw error;
    }
  }

  isConnected() {
    return this.connected && this.port && this.port.isOpen;
  }

  getStatus() {
    return {
      connected: this.connected,
      reading: this.isReading,
      port: this.port ? this.port.path : null,
      baudRate: this.config.baudRate,
      dataCount: this.readData.length
    };
  }

  getLogs() {
    return this.logs.slice(-50); // Últimos 50 logs
  }

  getReadData() {
    return this.readData.slice(-20); // Últimos 20 registros
  }

  getDetailedLogs() {
    return this.logs.slice(-50); // Últimos 50 logs detallados
  }

  buildInventoryCommand() {
    // Comando de inventario para Chafon CF601
    // Formato típico: 'INVENTORY\r\n' o comando específico del protocolo
    return 'INVENTORY\r\n';
  }

  buildPowerCommand() {
    // Comando para configurar potencia de transmisión
    // Formato típico: 'POWER 20\r\n' (20 = nivel de potencia)
    return 'POWER 20\r\n';
  }

  buildStopCommand() {
    // Comando para detener inventario
    return 'STOP\r\n';
  }

  addLog(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type,
      device: 'CF601'
    };
    
    this.logs.push(logEntry);
    
    // Mantener solo los últimos 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    console.log(`[CF601] ${message}`);
  }
}

module.exports = CF601Reader;
