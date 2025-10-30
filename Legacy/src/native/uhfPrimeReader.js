/* eslint-disable */
const path = require('path');
const fs = require('fs');

let ffi, ref;
try {
  ffi = require('ffi-napi');
  ref = require('ref-napi');
} catch (_) {
  // Dependencias no instaladas
}

function resolveDllPath() {
  const candidates = [
    path.join(__dirname, '..', '..', 'vendor_sdk', 'UHF Desk Reader SDK', 'API', 'UHFPrimeReader.dll'),
    path.join(__dirname, '..', '..', 'vendor_sdk', 'UHF Desk Reader SDK', 'Software V1.1.2', 'UHFPrimeReader.dll'),
    path.join(__dirname, '..', '..', 'vendor_sdk', 'UHF Desk Reader SDK', 'Sample', 'python', 'UHFPrimeReader.dll'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createApi() {
  if (!ffi || !ref) return null;
  const dllPath = resolveDllPath();
  if (!dllPath) return null;

  const int32 = ref.types.int32;
  const voidPtr = ref.refType(ref.types.void);

  // Nota: hComm es handle tipo int por los ejemplos
  const lib = ffi.Library(dllPath, {
    OpenDevice: ['int', [ref.refType('int'), 'int', 'int']],
    OpenNetConnection: ['int', [ref.refType('int'), 'string', 'int', 'int']],
    CloseDevice: ['int', ['int']],
    GetDevicePara: ['int', ['int', voidPtr]],
    SetDevicePara: ['int', ['int', voidPtr]],
    SetRFPower: ['int', ['int', 'int', 'int']],
    Close_Relay: ['int', ['int', 'int']],
    Release_Relay: ['int', ['int', 'int']],
    GetTagUii: ['int', ['int', voidPtr, 'int']],
    InventoryContinue: ['int', ['int', 'int', voidPtr]],
    InventoryStop: ['int', ['int', 'int']],
  });

  return { lib };
}

class UHFPrimeReaderApi {
  constructor() {
    this.api = createApi();
    this.hComm = ref ? ref.alloc('int') : null;
  }

  isAvailable() {
    return !!(this.api && this.hComm);
  }

  openDevice(port = 0, baud = 0) {
    const rc = this.api.lib.OpenDevice(this.hComm, port, baud);
    return rc;
  }

  getHandleValue() {
    return this.hComm ? this.hComm.deref() : 0;
  }

  closeDevice() {
    const h = this.getHandleValue();
    if (!h) return 0;
    return this.api.lib.CloseDevice(h);
  }

  setRFPower(power = 20, reserved = 0) {
    const h = this.getHandleValue();
    return this.api.lib.SetRFPower(h, power, reserved);
  }

  inventoryContinue(invCount = 1, invParamPtr = ref ? ref.NULL : null) {
    const h = this.getHandleValue();
    return this.api.lib.InventoryContinue(h, invCount, invParamPtr);
  }

  inventoryStop(timeoutMs = 1000) {
    const h = this.getHandleValue();
    return this.api.lib.InventoryStop(h, timeoutMs);
  }

  getTagUii(tagInfoPtr, timeoutMs = 500) {
    const h = this.getHandleValue();
    return this.api.lib.GetTagUii(h, tagInfoPtr, timeoutMs);
  }
}

module.exports = {
  UHFPrimeReaderApi,
};


