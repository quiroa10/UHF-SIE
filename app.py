from flask import Flask, request, jsonify
from flask_cors import CORS
from ctypes import *
import os
import threading
import platform
try:
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Log del estado de pyserial
print(f"[DEBUG] pyserial disponible: {SERIAL_AVAILABLE}")

# Resolver ruta de la DLL desde el SDK incluido en el repo
ROOT = os.path.abspath(os.path.dirname(__file__))
# Crear carpeta de logs si no existe
os.makedirs(os.path.join(ROOT, 'logs'), exist_ok=True)
DLL_CANDIDATES = [
    # Primero buscar en el directorio actual (más fácil para el cliente)
    os.path.join(ROOT, 'UHFPrimeReader.dll'),
    # Luego buscar en rutas del SDK
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'API', 'UHFPrimeReader.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'Software V1.1.2', 'UHFPrimeReader.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'Sample', 'Delphi', 'UHFPrimeReader.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'Sample', 'python', 'UHFPrimeReader.dll'),
]

# Candidatos para hidapi.dll (necesario para USB-OPEN)
HIDAPI_CANDIDATES = [
    os.path.join(ROOT, 'hidapi.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'Software V1.1.2', 'hidapi.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'API', 'hidapi.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'UHF Desk Reader SDK', 'Sample', 'Delphi', 'hidapi.dll'),
]

def resolve_dll():
    print("[DEBUG] Buscando UHFPrimeReader.dll en:")
    for p in DLL_CANDIDATES:
        exists = os.path.exists(p)
        print(f"  - {p} {'[OK]' if exists else '[NO]'}")
        if exists:
            print(f"[DEBUG] DLL encontrada en: {p}")
            return p
    return None

def setup_hidapi():
    """Configura hidapi.dll para que esté disponible para UHFPrimeReader.dll"""
    import shutil
    # Buscar hidapi.dll
    for p in HIDAPI_CANDIDATES:
        if os.path.exists(p):
            print(f"[DEBUG] hidapi.dll encontrada en: {p}")
            # Copiar al directorio de UHFPrimeReader.dll si no está ahí
            dll_dir = os.path.dirname(DLL_PATH)
            local_hidapi = os.path.join(dll_dir, 'hidapi.dll')
            if not os.path.exists(local_hidapi):
                try:
                    shutil.copy2(p, local_hidapi)
                    print(f"[DEBUG] Copiado hidapi.dll a: {local_hidapi}")
                except Exception as e:
                    print(f"[WARN] No se pudo copiar hidapi.dll: {e}")
            # Agregar al PATH de Windows si es necesario
            if platform.system() == 'Windows':
                try:
                    import ctypes
                    kernel32 = ctypes.windll.kernel32
                    kernel32.AddDllDirectoryW(dll_dir.encode('utf-8'))
                except Exception as e:
                    print(f"[WARN] No se pudo agregar {dll_dir} al PATH: {e}")
            return
    print("[WARN] hidapi.dll no encontrada - CF601 USB-OPEN puede fallar")

DLL_PATH = resolve_dll()
if not DLL_PATH:
    print("\n[ERROR] No se encontró UHFPrimeReader.dll")
    print("\nSoluciones:")
    print("1. Copia UHFPrimeReader.dll al directorio del proyecto")
    print("2. O asegúrate de tener la carpeta vendor_sdk/ completa")
    raise RuntimeError('No se encontró UHFPrimeReader.dll en el SDK')

# Configurar hidapi.dll ANTES de cargar UHFPrimeReader.dll
setup_hidapi()

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

# Estructuras necesarias para consultar parámetros
class DeviceFullInfo(Structure):
    _fields_ = [
        ('DEVICEARRD', c_ubyte), ('RFIDPRO', c_ubyte), ('WORKMODE', c_ubyte),
        ('INTERFACE', c_ubyte), ('BAUDRATE', c_ubyte), ('WGSET', c_ubyte),
        ('ANT', c_ubyte), ('REGION', c_ubyte),
        ('STRATFREI', c_ubyte*2), ('STRATFRED', c_ubyte*2), ('STEPFRE', c_ubyte*2),
        ('CN', c_ubyte), ('RFIDPOWER', c_ubyte), ('INVENTORYAREA', c_ubyte),
        ('QVALUE', c_ubyte), ('SESSION', c_ubyte), ('ACSADDR', c_ubyte),
        ('ACSDATALEN', c_ubyte), ('FILTERTIME', c_ubyte), ('TRIGGLETIME', c_ubyte),
        ('BUZZERTIME', c_ubyte), ('INTERNELTIME', c_ubyte)
    ]

# Estructura de tag con RSSI/antena/canal
class TagInfo(Structure):
    _fields_ = [
        ('m_no', c_ushort),
        ('m_rssi', c_short),
        ('m_ant', c_ubyte),
        ('m_channel', c_ubyte),
        ('m_crc', c_ubyte*2),
        ('m_pc', c_ubyte*2),
        ('m_len', c_ubyte),
        ('m_code', c_ubyte*255)
    ]

# Argumentos de funciones usadas
lib.GetDevicePara.argtypes = [c_int, POINTER(DeviceFullInfo)]
lib.SetRFPower.argtypes = [c_int, c_ubyte, c_ubyte]
lib.InventoryContinue.argtypes = [c_int, c_ubyte, POINTER(c_int)]
lib.GetTagUii.argtypes = [c_int, POINTER(TagInfo), c_int]

# Estado simple en memoria
hComm = c_int(0)
_is_open = False
_inv_running = False
_lock = threading.Lock()

def sys_meta(step=None, rc=None):
    return {
        'arch': platform.architecture()[0],
        'dll_path': DLL_PATH,
        'hComm': hComm.value,
        'step': step,
        'rc': rc
    }

@app.get('/ports')
def get_ports():
    """Lista puertos COM disponibles"""
    if not SERIAL_AVAILABLE:
        return jsonify(success=False, ports=[], message='pyserial no disponible. Ejecuta: pip install pyserial')
    try:
        ports = [p.device for p in serial.tools.list_ports.comports()]
        return jsonify(success=True, ports=ports)
    except Exception as e:
        return jsonify(success=False, ports=[], message=f'Error listando puertos: {str(e)}')

@app.post('/open')
def open_device():
    global _is_open
    with _lock:
        if _is_open:
            return jsonify(success=True, message='Ya abierto', **sys_meta(step='open'))
        # Permitir parámetros opcionales para COM o USB-OPEN
        data = request.get_json(silent=True) or {}
        com_port = data.get('comPort', 'COM1')  # Default COM1 para prueba
        baudrate = int(data.get('baudrate', 4))  # 4 = 115200 según ejemplos
        
        try:
            strComPort = c_char_p(com_port.encode('utf-8'))
            Baudrate = c_ubyte(baudrate)
            rc = lib.OpenDevice(byref(hComm), strComPort, Baudrate)
            if rc != 0:
                return jsonify(success=False, message=f'OpenDevice rc={rc} (puerto={com_port}, baud={baudrate})', **sys_meta(step='open', rc=rc)), 500
        except Exception as e:
            return jsonify(success=False, message=f'OpenDevice exception: {str(e)}', **sys_meta(step='open', rc=-1)), 500
        _is_open = True
        return jsonify(success=True, message=f'Abierto {com_port}', **sys_meta(step='open', rc=rc))

@app.post('/inventory/start')
def inventory_start():
    global _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=False, message='No abierto', **sys_meta(step='inventory_start')), 400
        if _inv_running:
            return jsonify(success=True, message='Inventario ya iniciado', **sys_meta(step='inventory_start'))
        print(f"[DEBUG] Llamando InventoryContinue con hComm={hComm.value}")
        rc = lib.InventoryContinue(hComm.value, c_ubyte(0), byref(c_int(0)))
        print(f"[DEBUG] InventoryContinue devolvió rc={rc}")
        if rc != 0:
            return jsonify(success=False, message=f'InventoryContinue rc={rc}', **sys_meta(step='inventory_start', rc=rc)), 500
        _inv_running = True
        return jsonify(success=True, message='Inventario iniciado', **sys_meta(step='inventory_start', rc=rc))

@app.get('/get-tag')
def get_tag():
    if not _is_open:
        return jsonify(success=False, message='No abierto', **sys_meta(step='get_tag')), 400
    tag = TagInfo()
    rc = lib.GetTagUii(hComm.value, byref(tag), 200)
    if rc != 0:
        # sin datos o timeout (rc puede ser != 0 normal si no hay tags)
        return jsonify(success=True, tag=None, **sys_meta(step='get_tag', rc=rc))
    epc_len = int(tag.m_len)
    if epc_len > 0:
        epc_hex = ''.join(f'{b:02X}' for b in list(tag.m_code)[:epc_len])
        print(f"[DEBUG] TAG leído: epc={epc_hex}, rssi={tag.m_rssi}, ant={tag.m_ant}")
        return jsonify(
            success=True,
            tag={
                'epc': epc_hex,
                'rssi': int(tag.m_rssi),
                'antenna': int(tag.m_ant),
                'channel': int(tag.m_channel)
            },
            **sys_meta(step='get_tag', rc=rc)
        )
    return jsonify(success=True, tag=None, **sys_meta(step='get_tag', rc=rc))

@app.post('/inventory/stop')
def inventory_stop():
    global _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=True, **sys_meta(step='inventory_stop'))
        try:
            lib.InventoryStop(hComm.value, 500)
        finally:
            _inv_running = False
        return jsonify(success=True, message='Inventario detenido', **sys_meta(step='inventory_stop'))

@app.post('/close')
def close_device():
    global _is_open, _inv_running
    with _lock:
        if not _is_open:
            return jsonify(success=True, message='Ya cerrado', **sys_meta(step='close'))
        try:
            lib.InventoryStop(hComm.value, 500)
        except Exception:
            pass
        rc = lib.CloseDevice(hComm.value)
        _is_open = False
        _inv_running = False
        return jsonify(success=(rc == 0), message='Cerrado', **sys_meta(step='close', rc=rc))

@app.get('/health')
def health():
    return jsonify(
        success=True,
        dll_loaded=True,
        **sys_meta(step='health')
    )

# =====================
# CF816 (TCP/IP) via UHFReader288.dll (x86)
# =====================
CF816_DLL_CANDIDATES = [
    # Primero buscar en el directorio actual
    os.path.join(ROOT, 'UHFReader288.dll'),
    # Luego buscar en rutas del SDK
    os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'SDK', 'VC', 'x32', 'UHFReader288.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'SDK', 'C#', 'x86', 'UHFReader288.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'SDK', 'Java-jni', 'x32', 'UHFReader288.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'Demo', 'c#', 'EXE', 'UHFReader288.dll'),
    os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'Demo', 'JAVA', 'testdemo-jni', 'UHFReader288.dll'),
]

def resolve_cf816_dll():
    print("[DEBUG CF816] Buscando UHFReader288.dll en:")
    for p in CF816_DLL_CANDIDATES:
        exists = os.path.exists(p)
        print(f"  - {p} {'[OK]' if exists else '[NO]'}")
        if exists:
            print(f"[DEBUG CF816] DLL encontrada en: {p}")
            return p
    print("[DEBUG CF816] DLL no encontrada en ninguna ruta")
    return None

def setup_dmdll():
    """Configura dmdll.dll para que esté disponible para UHFReader288.dll"""
    import shutil
    # Buscar dmdll.dll en Demo/c#/EXE
    dmdll_candidates = [
        os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'Demo', 'c#', 'EXE', 'dmdll.dll'),
        os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'TCPIP SET', 'CP208_V1.02', 'win10', '32bit', 'dmdll.dll'),
        os.path.join(ROOT, 'vendor_sdk', 'CF815.CF816.CF817 SDK', 'TCPIP SET', 'CP208_V1.02', 'win7_XP', '32bit', 'dmdll.dll'),
    ]
    for p in dmdll_candidates:
        if os.path.exists(p):
            print(f"[DEBUG CF816] dmdll.dll encontrada en: {p}")
            # Copiar al directorio de UHFReader288.dll si no está ahí
            if CF816_DLL_PATH:
                dll_dir = os.path.dirname(CF816_DLL_PATH)
                local_dmdll = os.path.join(dll_dir, 'dmdll.dll')
                print(f"[DEBUG CF816] Intentando copiar a: {local_dmdll}")
                if not os.path.exists(local_dmdll):
                    try:
                        shutil.copy2(p, local_dmdll)
                        print(f"[DEBUG CF816] Copiado dmdll.dll a: {local_dmdll}")
                    except Exception as e:
                        print(f"[WARN CF816] No se pudo copiar dmdll.dll: {e}")
                else:
                    print(f"[DEBUG CF816] dmdll.dll ya existe en: {local_dmdll}")
                return
            else:
                print("[WARN CF816] CF816_DLL_PATH es None, no se puede copiar dmdll.dll")
                return
    print("[WARN CF816] dmdll.dll no encontrada - CF816 puede fallar")

CF816_DLL_PATH = resolve_cf816_dll()
# Configurar dmdll.dll ANTES de cargar UHFReader288.dll
if CF816_DLL_PATH:
    setup_dmdll()
cf816 = None
hNet = c_int(0)
cf816ComAdr = c_ubyte(0xFF)

def load_cf816_dll():
    global cf816
    print(f"[DEBUG CF816] load_cf816_dll() llamado, cf816 actual: {cf816}")
    if cf816:
        print(f"[DEBUG CF816] cf816 ya cargado, retornando True")
        return True
    if not CF816_DLL_PATH or not os.path.exists(CF816_DLL_PATH):
        print(f"[DEBUG CF816] DLL no encontrada en: {CF816_DLL_PATH}")
        return False
    print(f"[DEBUG CF816] Cargando DLL desde: {CF816_DLL_PATH}")
    try:
        # Cargar DLL con WinDLL para funciones stdcall en Windows
        cf816 = cdll.LoadLibrary(CF816_DLL_PATH)
        # Firmas necesarias
        # int OpenNetPort(int Port, LPCTSTR IPaddr, BYTE* ComAdr, int *Frmhandle);
        cf816.OpenNetPort.restype = c_int
        cf816.OpenNetPort.argtypes = [c_int, c_char_p, POINTER(c_ubyte), POINTER(c_int)]
        cf816.CloseNetPort.restype = c_int
        cf816.CloseNetPort.argtypes = [c_int]
        # SingleTagInventory_G2(BYTE *address, BYTE* EPC, int *EPCLength, int *CardNum, int FrmHandle)
        cf816.SingleTagInventory_G2.restype = c_int
        cf816.SingleTagInventory_G2.argtypes = [POINTER(c_ubyte), POINTER(c_ubyte), POINTER(c_int), POINTER(c_int), c_int]
        # Power
        cf816.ReadRfPower.restype = c_int
        cf816.ReadRfPower.argtypes = [POINTER(c_ubyte), POINTER(c_ubyte), c_int]
        cf816.WriteRfPower.restype = c_int
        cf816.WriteRfPower.argtypes = [POINTER(c_ubyte), c_ubyte, c_int]
        # StopImmediately optional
        cf816.StopImmediately.restype = c_int
        cf816.StopImmediately.argtypes = [POINTER(c_ubyte), c_int]
        
        # InitRFIDCallBack es opcional - intentar cargar
        try:
            cf816.InitRFIDCallBack.restype = None
            cf816.InitRFIDCallBack.argtypes = [c_void_p, c_bool, c_int]
            print("[DEBUG CF816] InitRFIDCallBack configurado")
        except AttributeError:
            print("[WARN CF816] InitRFIDCallBack no encontrada en DLL - continuando sin callback")
        
        print("[DEBUG CF816] DLL cargada exitosamente")
        return True
    except Exception as e:
        print(f"[ERROR CF816] Fallo al cargar DLL: {e}")
        cf816 = None
        return False

@app.post('/cf816/net/open')
def cf816_net_open():
    print(f"[DEBUG CF816 /cf816/net/open] Endpoint llamado")
    try:
        print(f"[DEBUG CF816 /cf816/net/open] Llamando load_cf816_dll()")
        if not load_cf816_dll():
            print(f"[DEBUG CF816 /cf816/net/open] load_cf816_dll() retornó False")
            return jsonify(success=False, message='No se pudo cargar UHFReader288.dll', cf816_dll=CF816_DLL_PATH), 500
        data = request.get_json(silent=True) or {}
        ip = str(data.get('ip', '192.168.1.200')).encode('utf-8')
        port = int(data.get('port', 6000))
        timeout_ms = int(data.get('timeoutMs', 200))  # no usado por OpenNetPort clásico
        # OpenNetPort devuelve FrmHandle y puede actualizar ComAdr
        rc = cf816.OpenNetPort(port, c_char_p(ip), byref(cf816ComAdr), byref(hNet))
        if rc != 0:
            return jsonify(success=False, message=f'OpenNetPort rc={rc}', cf816_dll=CF816_DLL_PATH, frmHandle=hNet.value, comAdr=int(cf816ComAdr.value)), 500
        # Inicializar callback según ejemplos (opcional)
        if hNet.value > 0:
            try:
                cf816.InitRFIDCallBack(None, False, hNet.value)
                print(f"[DEBUG CF816] InitRFIDCallBack llamado")
            except AttributeError:
                print("[WARN CF816] InitRFIDCallBack no disponible")
        return jsonify(success=True, message='CF816 abierto', frmHandle=hNet.value, comAdr=int(cf816ComAdr.value), cf816_dll=CF816_DLL_PATH)
    except Exception as e:
        print(f"[ERROR CF816] Excepción en /cf816/net/open: {e}")
        return jsonify(success=False, message=f'Error: {str(e)}'), 500

@app.post('/cf816/inventory/start')
def cf816_inventory_start():
    if not cf816 or hNet.value == 0:
        return jsonify(success=False, message='CF816 no abierto'), 400
    # Para modo simple usamos inventarios puntuales via SingleTagInventory en /cf816/get-tag
    return jsonify(success=True, message='Inventario listo (modo polling)')

@app.get('/cf816/get-tag')
def cf816_get_tag():
    if not cf816 or hNet.value == 0:
        return jsonify(success=False, message='CF816 no abierto'), 400
    epc_buf = (c_ubyte * 512)()
    epc_len = c_int(0)
    card_num = c_int(0)
    rc = cf816.SingleTagInventory_G2(byref(cf816ComAdr), epc_buf, byref(epc_len), byref(card_num), hNet.value)
    if rc != 0 or card_num.value <= 0 or epc_len.value <= 0:
        return jsonify(success=True, tag=None, **sys_meta(step='cf816_get_tag', rc=rc))
    epc_hex = ''.join(f'{b:02X}' for b in list(epc_buf)[:epc_len.value])
    return jsonify(success=True, tag={'epc': epc_hex}, **sys_meta(step='cf816_get_tag', rc=rc))

@app.post('/cf816/inventory/stop')
def cf816_inventory_stop():
    if not cf816 or hNet.value == 0:
        return jsonify(success=True, message='CF816 no abierto')
    try:
        cf816.StopImmediately(byref(cf816ComAdr), hNet.value)
    except Exception:
        pass
    return jsonify(success=True, message='Inventario detenido (CF816)')

@app.post('/cf816/close')
def cf816_close():
    global hNet
    if not cf816 or hNet.value == 0:
        return jsonify(success=True, message='CF816 ya cerrado')
    rc = cf816.CloseNetPort(hNet.value)
    hNet = c_int(0)
    return jsonify(success=(rc == 0), message='CF816 cerrado', rc=rc)

@app.get('/cf816/rf/power')
def cf816_power_get():
    if not cf816 or hNet.value == 0:
        return jsonify(success=False, message='CF816 no abierto'), 400
    p = c_ubyte(0)
    rc = cf816.ReadRfPower(byref(cf816ComAdr), byref(p), hNet.value)
    if rc != 0:
        return jsonify(success=False, message=f'ReadRfPower rc={rc}', rc=rc), 500
    return jsonify(success=True, power=int(p.value), rc=rc)

@app.post('/cf816/rf/power')
def cf816_power_set():
    if not cf816 or hNet.value == 0:
        return jsonify(success=False, message='CF816 no abierto'), 400
    data = request.get_json(silent=True) or {}
    try:
        power = int(data.get('power'))
    except Exception:
        return jsonify(success=False, message='Parámetro power inválido'), 400
    if power < 0 or power > 30:
        return jsonify(success=False, message='power debe estar entre 0 y 30'), 400
    rc = cf816.WriteRfPower(byref(cf816ComAdr), c_ubyte(power), hNet.value)
    if rc != 0:
        return jsonify(success=False, message=f'WriteRfPower rc={rc}', rc=rc), 500
    return jsonify(success=True, message='Potencia CF816 actualizada', power=power, rc=rc)

@app.get('/rf/power')
def rf_power_get():
    if not _is_open:
        return jsonify(success=False, message='No abierto', **sys_meta(step='rf_power_get')), 400
    info = DeviceFullInfo()
    rc = lib.GetDevicePara(hComm.value, byref(info))
    if rc != 0:
        return jsonify(success=False, message=f'GetDevicePara rc={rc}', **sys_meta(step='rf_power_get', rc=rc)), 500
    return jsonify(success=True, power=int(info.RFIDPOWER), **sys_meta(step='rf_power_get', rc=rc))

@app.post('/rf/power')
def rf_power_set():
    if not _is_open:
        return jsonify(success=False, message='No abierto', **sys_meta(step='rf_power_set')), 400
    data = request.get_json(silent=True) or {}
    try:
        power = int(data.get('power'))
    except Exception:
        return jsonify(success=False, message='Parámetro power inválido', **sys_meta(step='rf_power_set')), 400
    if power < 0 or power > 30:
        return jsonify(success=False, message='power debe estar entre 0 y 30', **sys_meta(step='rf_power_set')), 400
    rc = lib.SetRFPower(hComm.value, c_ubyte(power), c_ubyte(0))
    if rc != 0:
        return jsonify(success=False, message=f'SetRFPower rc={rc}', **sys_meta(step='rf_power_set', rc=rc)), 500
    return jsonify(success=True, message='Potencia actualizada', power=power, **sys_meta(step='rf_power_set', rc=rc))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5005'))
    app.run(host='127.0.0.1', port=port)


