from flask import Flask, request, jsonify
from ctypes import *
import os
import threading

app = Flask(__name__)

# Resolver ruta de la DLL desde el SDK incluido en el repo
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DLL_CANDIDATES = [
    os.path.join(ROOT, 'UHF Desk Reader SDK', 'API', 'UHFPrimeReader.dll'),
    os.path.join(ROOT, 'UHF Desk Reader SDK', 'Software V1.1.2', 'UHFPrimeReader.dll'),
    os.path.join(ROOT, 'UHF Desk Reader SDK', 'Sample', 'python', 'UHFPrimeReader.dll'),
]

def resolve_dll():
    for p in DLL_CANDIDATES:
        if os.path.exists(p):
            return p
    return None

DLL_PATH = resolve_dll()
if not DLL_PATH:
    raise RuntimeError('No se encontró UHFPrimeReader.dll en el SDK')

lib = cdll.LoadLibrary(DLL_PATH)
lib.OpenDevice.restype = c_int32
lib.OpenNetConnection.restype = c_int32
lib.CloseDevice.restype = c_int32
lib.GetDevicePara.restype = c_int32
lib.SetDevicePara.restype = c_int32
lib.SetRFPower.restype = c_int32
lib.Close_Relay.restype = c_int32
lib.Release_Relay.restype = c_int32
lib.GetTagUii.restype = c_int32
lib.InventoryContinue.restype = c_int32
lib.InventoryStop.restype = c_int32

# Estado simple en memoria
hComm = c_int(0)
_is_open = False
_inv_running = False
_lock = threading.Lock()

@app.post('/open')
def open_device():
    global _is_open
    with _lock:
        if _is_open:
            return jsonify(success=True, message='Ya abierto')
        # Para USB-OPEN el SDK soporta OpenDevice con parámetros reservados
        rc = lib.OpenDevice(byref(hComm), 0, 0)
        if rc != 0:
            return jsonify(success=False, message=f'OpenDevice rc={rc}'), 500
        _is_open = True
        return jsonify(success=True, message='Abierto', hComm=hComm.value)

@app.post('/inventory/start')
def inventory_start():
    global _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=False, message='No abierto'), 400
        if _inv_running:
            return jsonify(success=True, message='Inventario ya iniciado')
        rc = lib.InventoryContinue(hComm.value, 1, None)
        if rc != 0:
            return jsonify(success=False, message=f'InventoryContinue rc={rc}'), 500
        _inv_running = True
        return jsonify(success=True, message='Inventario iniciado')

@app.get('/get-tag')
def get_tag():
    if not _is_open:
        return jsonify(success=False, message='No abierto'), 400
    # buffer simple para ejemplo
    buf = (c_ubyte * 512)()
    rc = lib.GetTagUii(hComm.value, byref(buf), 200)
    if rc != 0:
        # no tag o error no fatal
        return jsonify(success=True, tag=None)
    # Convertir a hex
    hex_str = ''.join(f'{b:02x}' for b in list(buf))
    return jsonify(success=True, tag={ 'hex': hex_str })

@app.post('/inventory/stop')
def inventory_stop():
    global _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=True)
        try:
            lib.InventoryStop(hComm.value, 500)
        finally:
            _inv_running = False
        return jsonify(success=True, message='Inventario detenido')

@app.post('/close')
def close_device():
    global _is_open, _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=True, message='Ya cerrado')
        try:
            lib.InventoryStop(hComm.value, 500)
        except Exception:
            pass
        rc = lib.CloseDevice(hComm.value)
        _is_open = False
        _inv_running = False
        return jsonify(success=(rc==0), message='Cerrado', rc=rc)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5005'))
    app.run(host='127.0.0.1', port=port)
