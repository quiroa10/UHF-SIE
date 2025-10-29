const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
let HID;
try {
  HID = require('node-hid');
} catch (_) {
  HID = null;
}

class CF601Reader {
  constructor() {
    this.id = Math.random().toString(36).substr(2, 9);
    this.port = null;
    this.parser = null;
    this.connected = false;
    this.logs = [];
    this.readData = [];
    this.isReading = false;
    this.config = {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    };
    this.hasStartedInventory = false;
    this.connectionMode = 'serial'; // 'serial' | 'hid'
    this.hidDevice = null;
  }

  async connect(portPath, baudRate = 9600) {
    try {
      this.addLog(`Intentando conectar CF601 en ${portPath} (${baudRate} baud)...`, 'info');
      
      // Si ya está conectado al mismo puerto y misma velocidad, no reconectar
      if (this.port && this.port.isOpen && this.port.path === portPath && this.config.baudRate === baudRate) {
        this.addLog(`CF601 ya conectado en ${portPath} (${baudRate}) - se omite reconexión`, 'warning');
        return {
          success: true,
          message: `CF601 ya conectado en ${portPath}`,
          port: portPath,
          baudRate
        };
      }

      // Cerrar conexión existente solo si hay una conexión previa diferente
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
      if (this.connectionMode === 'hid' && this.hidDevice) {
        this.isReading = false;
        try { this.hidDevice.close(); } catch (_) {}
        this.hidDevice = null;
        this.connected = false;
        return { success: true, message: 'CF601 (USB-OPEN) desconectado' };
      }
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

  listHIDDevices() {
    if (!HID) return [];
    return HID.devices();
  }

  async connectUSBOpen({ path, vendorId, productId } = {}) {
    if (!HID) throw new Error('node-hid no está disponible');
    try {
      if (this.hidDevice && this.connected) {
        return { success: true, message: 'CF601 (USB-OPEN) ya conectado' };
      }
      const devices = HID.devices();
      let deviceInfo = null;
      if (path) deviceInfo = devices.find(d => d.path === path);
      if (!deviceInfo && vendorId && productId) {
        deviceInfo = devices.find(d => d.vendorId === vendorId && d.productId === productId);
      }
      if (!deviceInfo) {
        deviceInfo = devices.find(d => (d.manufacturer || '').toLowerCase().includes('chafon') || (d.product || '').toLowerCase().includes('rfid')) || devices[0];
      }
      if (!deviceInfo) throw new Error('No se encontró dispositivo HID');

      this.hidDevice = new HID.HID(deviceInfo.path);
      this.connectionMode = 'hid';
      this.connected = true;

      this.hidDevice.on('data', (data) => {
        const hex = data.toString('hex');
        this.addLog(`HID DATA (hex): ${hex}`, 'info');
        const ascii = data.toString('ascii').replace(/[^\x20-\x7E]+/g, '').trim();
        if (ascii) {
          this.processData(ascii);
        }
      });
      this.hidDevice.on('error', (err) => {
        this.addLog(`Error HID CF601: ${err.message}`, 'error');
        this.isReading = false;
        this.connected = false;
        try { this.hidDevice.close(); } catch (_) {}
        this.hidDevice = null;
      });

      return { success: true, message: 'CF601 conectado por USB-OPEN', device: deviceInfo };
    } catch (error) {
      this.connected = false;
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
      this.isReading = false;
      this.hasStartedInventory = false;
    });

    this.port.on('close', () => {
      this.addLog('Puerto CF601 cerrado', 'warning');
      this.connected = false;
      this.isReading = false;
      this.hasStartedInventory = false;
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

      // Si ya está leyendo, no hacer nada
      if (this.isReading) {
        this.addLog('CF601 ya está en modo lectura', 'warning');
        return {
          success: true,
          message: 'CF601 ya está en modo lectura'
        };
      }

      this.isReading = true;
      this.addLog('Iniciando lectura CF601...', 'info');

      // Enviar comandos de inventario al CF601 SOLO UNA VEZ
      if (this.connectionMode === 'hid' && this.hidDevice && !this.hasStartedInventory) {
        const powerCommand = this.buildPowerCommand();
        const inventoryCommand = this.buildInventoryCommand();
        this._hidWrite(powerCommand);
        await new Promise(resolve => setTimeout(resolve, 100));
        this._hidWrite(inventoryCommand);
        this.hasStartedInventory = true;
      } else if (this.port && this.port.isOpen && !this.hasStartedInventory) {
        // Comando para configurar potencia PRIMERO
        const powerCommand = this.buildPowerCommand();
        if (powerCommand) {
          this.port.write(powerCommand);
          this.addLog(`Comando de potencia enviado: ${powerCommand}`, 'info');
        }
        
        // Pequeña pausa antes del comando de inventario
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Comando de inventario para iniciar lectura continua
        const inventoryCommand = this.buildInventoryCommand();
        if (inventoryCommand) {
          this.port.write(inventoryCommand);
          this.addLog(`Comando de inventario enviado: ${inventoryCommand}`, 'info');
        }
        this.hasStartedInventory = true;
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
      this.hasStartedInventory = false;
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
    // Filtrar logs de debug del constructor y otros logs problemáticos
    return this.logs
      .filter(log => !log.message.includes('DEBUG: ANTES de inicializar isReading = false en constructor'))
      .filter(log => !log.message.includes('DEBUG: DESPUÉS de inicializar isReading = false en constructor'))
      .filter(log => !log.message.includes('DEBUG: startReading() llamado'))
      .filter(log => !log.message.includes('DEBUG: isReading establecido a TRUE'))
      .filter(log => !log.message.includes('DEBUG: startReading() terminando'))
      .filter(log => !log.message.includes('DEBUG: isReading reseteado'))
      .slice(-50); // Últimos 50 logs detallados
  }

  buildInventoryCommand() {
    // Comando de inventario para Chafon CF601
    // Según documentación Chafon, el comando correcto es:
    return 'INVENTORY\r\n';
  }

  buildPowerCommand() {
    // Comando para configurar potencia de transmisión
    // Nivel de potencia recomendado para Chafon CF601
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

  _hidWrite(commandStr) {
    if (!this.hidDevice) return;
    const bytes = Buffer.from(commandStr, 'ascii');
    // node-hid requiere primer byte como reportId (0x00 si no se usa)
    const report = Buffer.concat([Buffer.from([0x00]), bytes]);
    try {
      this.hidDevice.write(Array.from(report));
      this.addLog(`HID WRITE: ${bytes.toString('hex')}`, 'info');
    } catch (err) {
      this.addLog(`Error enviando HID: ${err.message}`, 'error');
    }
  }
}

module.exports = CF601Reader;
