"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Code,
    Database,
    Webhook,
    GitBranch,
    Zap,
    FileCode,
    Server,
    Lock,
    RefreshCw,
    Upload,
    Download,
    Trash2,
    Play,
    Users,
    CreditCard,
    Image as ImageIcon
} from "lucide-react";

export default function AkuvoxDocsPage() {
    const [selectedTab, setSelectedTab] = useState("overview");

    return (
        <div className="min-h-screen bg-neutral-950 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">
                        Akuvox Access Control Driver
                    </h1>
                    <p className="text-neutral-400 text-sm">
                        Documentación técnica completa del driver HTTP API para dispositivos Akuvox
                    </p>
                </div>

                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
                    <TabsList className="bg-neutral-900 border border-neutral-800">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
                            <Server className="mr-2" size={16} />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="apis" className="data-[state=active]:bg-purple-600">
                            <Code className="mr-2" size={16} />
                            APIs HTTP
                        </TabsTrigger>
                        <TabsTrigger value="webhook" className="data-[state=active]:bg-purple-600">
                            <Webhook className="mr-2" size={16} />
                            Webhook Events
                        </TabsTrigger>
                        <TabsTrigger value="sync" className="data-[state=active]:bg-purple-600">
                            <RefreshCw className="mr-2" size={16} />
                            Sincronización
                        </TabsTrigger>
                        <TabsTrigger value="auth" className="data-[state=active]:bg-purple-600">
                            <Lock className="mr-2" size={16} />
                            Autenticación
                        </TabsTrigger>
                    </TabsList>

                    {/* OVERVIEW TAB */}
                    <TabsContent value="overview" className="space-y-6">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <GitBranch size={20} />
                                    Arquitectura del Driver
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Componentes Principales</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-3">
                                                <FileCode className="text-emerald-400 mt-1" size={16} />
                                                <div>
                                                    <p className="text-xs font-bold text-white">AkuvoxDriver.ts</p>
                                                    <p className="text-[10px] text-neutral-500">Driver principal HTTP API</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Webhook className="text-orange-400 mt-1" size={16} />
                                                <div>
                                                    <p className="text-xs font-bold text-white">route.ts (webhook)</p>
                                                    <p className="text-[10px] text-neutral-500">Receptor de eventos de acceso</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-3">
                                                <Database className="text-purple-400 mt-1" size={16} />
                                                <div>
                                                    <p className="text-xs font-bold text-white">Prisma ORM</p>
                                                    <p className="text-[10px] text-neutral-500">Persistencia de datos</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <ImageIcon className="text-blue-400 mt-1" size={16} />
                                                <div>
                                                    <p className="text-xs font-bold text-white">Face Recognition</p>
                                                    <p className="text-[10px] text-neutral-500">Procesamiento de imágenes</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Flujo de Datos</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600 text-white">1</Badge>
                                            <p className="text-xs text-neutral-300">Usuario presenta credencial (TAG/Face) → Dispositivo valida</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600 text-white">2</Badge>
                                            <p className="text-xs text-neutral-300">Dispositivo envía evento al webhook (opcional)</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600 text-white">3</Badge>
                                            <p className="text-xs text-neutral-300">Sistema sincroniza usuarios/caras desde DB → Dispositivo</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600 text-white">4</Badge>
                                            <p className="text-xs text-neutral-300">Driver gestiona usuarios con ID determinista</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-purple-600 text-white">5</Badge>
                                            <p className="text-xs text-neutral-300">Apertura de puerta mediante API o credenciales especiales</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* APIS TAB */}
                    <TabsContent value="apis" className="space-y-6">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white">Endpoints HTTP API Utilizados</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Add User */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Users className="text-emerald-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Agregar Usuario</h3>
                                        </div>
                                        <Badge className="bg-emerald-600 text-white">POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/user/add
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Crea un usuario con credenciales (TAGs, PIN, Face)</p>
                                    <details className="text-xs">
                                        <summary className="text-purple-400 cursor-pointer mb-2">Ver Payload</summary>
                                        <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                            {`{
  "target": "user",
  "action": "add",
  "data": {
    "item": [{
      "ID": "123456",
      "Name": "Juan Pérez",
      "UserCode": "123456",
      "Type": "0",
      "Group": "Default",
      "Role": "-1",
      "CardCode": "1234567890",
      "PrivatePIN": "1234",
      "ScheduleRelay": "1001-1;1001-2;"
    }]
  }
}`}
                                        </pre>
                                    </details>
                                </div>

                                {/* Add Face */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon className="text-blue-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Agregar Cara</h3>
                                        </div>
                                        <Badge className="bg-blue-600 text-white">POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/face/add
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Agrega una imagen facial a un usuario existente</p>
                                    <details className="text-xs">
                                        <summary className="text-purple-400 cursor-pointer mb-2">Ver Payload</summary>
                                        <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                            {`{
  "target": "face",
  "action": "add",
  "data": {
    "ID": "123456",
    "Image": "base64_encoded_image_data..."
  }
}`}
                                        </pre>
                                    </details>
                                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                                        <p className="text-[10px] text-yellow-400">
                                            <strong>Nota:</strong> La imagen debe estar en formato Base64 y cumplir con los requisitos de calidad del dispositivo.
                                        </p>
                                    </div>
                                </div>

                                {/* Get Users */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Download className="text-blue-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Obtener Usuarios</h3>
                                        </div>
                                        <Badge className="bg-blue-600 text-white">POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/user/get
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Obtiene lista de usuarios del dispositivo (paginado)</p>
                                    <details className="text-xs">
                                        <summary className="text-purple-400 cursor-pointer mb-2">Ver Payload</summary>
                                        <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                            {`{
  "target": "user",
  "action": "get",
  "data": {
    "offset": 0,
    "num": 200
  }
}`}
                                        </pre>
                                    </details>
                                </div>

                                {/* Delete User */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="text-red-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Eliminar Usuario</h3>
                                        </div>
                                        <Badge className="bg-red-600 text-white">POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/user/delete
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Elimina un usuario del dispositivo</p>
                                    <details className="text-xs">
                                        <summary className="text-purple-400 cursor-pointer mb-2">Ver Payload</summary>
                                        <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                            {`// Por ID interno
{
  "target": "user",
  "action": "delete",
  "data": {
    "ID": ["123456"]
  }
}

// Por UserCode
{
  "target": "user",
  "action": "delete",
  "data": {
    "UserCode": ["123456"]
  }
}`}
                                        </pre>
                                    </details>
                                </div>

                                {/* Open Door */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Play className="text-purple-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Abrir Puerta</h3>
                                        </div>
                                        <Badge className="bg-purple-600 text-white">GET</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /fcgi/do?action=OpenDoor&UserName=api&Password=Api*2011&DoorNum=1
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Activa el relé para abrir la puerta</p>
                                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                                        <p className="text-[10px] text-blue-400">
                                            <strong>Credenciales especiales:</strong> Se usan credenciales dedicadas (api/Api*2011) solo para control de relés.
                                        </p>
                                    </div>
                                </div>

                                {/* Get Door Logs */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Download className="text-orange-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Obtener Logs de Auditoría</h3>
                                        </div>
                                        <Badge className="bg-orange-600 text-white">GET/POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/doorlog/get
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Obtiene el historial de eventos de acceso del dispositivo</p>
                                    <details className="text-xs">
                                        <summary className="text-purple-400 cursor-pointer mb-2">Ver Respuesta</summary>
                                        <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                            {`{
  "retcode": 0,
  "action": "get",
  "message": "OK",
  "data": {
    "num": 2,
    "item": [
      {
        "ID": "1",
        "Type": "4",      // 0=Unknown, 1=Card, 2=Password, 3=Public, 4=Face
        "Name": "Juan Pérez",
        "Status": "0",    // 0=Success, 1=Failed
        "Code": "1234567890",
        "Date": "20241230",
        "Time": "10:30:45"
      },
      {
        "ID": "2",
        "Type": "1",
        "Name": "María García",
        "Status": "0",
        "Code": "9876543210",
        "Date": "20241230",
        "Time": "11:15:22"
      }
    ]
  }
}`}
                                        </pre>
                                    </details>
                                    <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                                        <h4 className="text-[10px] font-bold text-orange-400 mb-2">Tipos de Evento:</h4>
                                        <ul className="text-[9px] text-orange-300 space-y-1">
                                            <li><strong>0:</strong> Unknown (Desconocido)</li>
                                            <li><strong>1:</strong> Card (Tarjeta RFID)</li>
                                            <li><strong>2:</strong> Password (Código PIN)</li>
                                            <li><strong>3:</strong> Public (Código Público)</li>
                                            <li><strong>4:</strong> Face (Reconocimiento Facial)</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Export Door Logs */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Download className="text-cyan-400" size={16} />
                                            <h3 className="text-sm font-bold text-white">Exportar Logs (XML)</h3>
                                        </div>
                                        <Badge className="bg-cyan-600 text-white">GET/POST</Badge>
                                    </div>
                                    <code className="text-[10px] text-purple-400 bg-black/40 px-2 py-1 rounded block mb-2">
                                        /api/doorlog/export
                                    </code>
                                    <p className="text-xs text-neutral-400 mb-3">Descarga todos los logs en formato XML</p>
                                    <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded">
                                        <p className="text-[10px] text-cyan-400">
                                            <strong>Retorna:</strong> Archivo DoorLog.xml con todos los eventos de acceso registrados en el dispositivo.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Card: Credenciales y Métodos de Acceso */}
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white">Credenciales y Métodos de Acceso</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Face Recognition */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ImageIcon className="text-blue-400" size={20} />
                                        <h3 className="text-sm font-bold text-white">Reconocimiento Facial</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-blue-400 mb-2">Campo en Usuario:</h4>
                                            <code className="text-[10px] text-purple-400">FaceUrl</code>
                                            <p className="text-[10px] text-neutral-400 mt-1">URL o ruta de la imagen facial en Base64</p>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-blue-400 mb-2">Formato de Imagen:</h4>
                                            <ul className="text-[10px] text-neutral-300 space-y-1 list-disc list-inside">
                                                <li>Formato: JPG recomendado</li>
                                                <li>Tamaño máximo: ~200KB</li>
                                                <li>Codificación: Base64</li>
                                                <li>Resolución: Mínimo 640x480</li>
                                            </ul>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-blue-400 mb-2">Proceso de Sincronización:</h4>
                                            <ol className="text-[10px] text-neutral-300 space-y-1 list-decimal list-inside">
                                                <li>Crear usuario con <code className="text-purple-400">/api/user/add</code></li>
                                                <li>Descargar imagen desde servidor</li>
                                                <li>Convertir imagen a Base64</li>
                                                <li>Enviar mediante <code className="text-purple-400">/api/face/add</code></li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>

                                {/* RFID Cards */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CreditCard className="text-emerald-400" size={20} />
                                        <h3 className="text-sm font-bold text-white">Tarjetas RFID</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-emerald-400 mb-2">Campo en Usuario:</h4>
                                            <code className="text-[10px] text-purple-400">CardCode</code>
                                            <p className="text-[10px] text-neutral-400 mt-1">Número de serie de la tarjeta RFID</p>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-emerald-400 mb-2">Múltiples Tarjetas:</h4>
                                            <p className="text-[10px] text-neutral-300 mb-2">Un usuario puede tener varias tarjetas separadas por punto y coma:</p>
                                            <code className="text-[9px] text-emerald-400 bg-black/60 px-2 py-1 rounded block">
                                                "CardCode": "1234567890;9876543210;1122334455"
                                            </code>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-emerald-400 mb-2">Ejemplo de Sincronización:</h4>
                                            <pre className="bg-black/60 p-2 rounded text-[9px] text-neutral-300 overflow-x-auto">
                                                {`{
  "target": "user",
  "action": "add",
  "data": {
    "item": [{
      "ID": "123456",
      "Name": "Juan Pérez",
      "UserCode": "123456",
      "CardCode": "1234567890",
      "ScheduleRelay": "1001-1;1001-2;"
    }]
  }
}`}
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Codes (PIN) */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Lock className="text-yellow-400" size={20} />
                                        <h3 className="text-sm font-bold text-white">Códigos de Seguridad (PIN)</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-yellow-400 mb-2">Campo en Usuario:</h4>
                                            <code className="text-[10px] text-purple-400">PrivatePIN</code>
                                            <p className="text-[10px] text-neutral-400 mt-1">Código PIN personal del usuario</p>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-yellow-400 mb-2">Múltiples PINs:</h4>
                                            <p className="text-[10px] text-neutral-300 mb-2">Un usuario puede tener varios códigos PIN separados por punto y coma:</p>
                                            <code className="text-[9px] text-yellow-400 bg-black/60 px-2 py-1 rounded block">
                                                "PrivatePIN": "01016566;01011212;12345"
                                            </code>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-yellow-400 mb-2">Formato del PIN:</h4>
                                            <ul className="text-[10px] text-neutral-300 space-y-1 list-disc list-inside">
                                                <li>Longitud: 4-8 dígitos</li>
                                                <li>Solo números (0-9)</li>
                                                <li>Puede incluir ceros a la izquierda</li>
                                                <li>Ejemplo: "0123", "1234", "01016566"</li>
                                            </ul>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-yellow-400 mb-2">Código Público:</h4>
                                            <p className="text-[10px] text-neutral-300 mb-2">Existe también un código público compartido por todos:</p>
                                            <code className="text-[9px] text-yellow-400 bg-black/60 px-2 py-1 rounded block">
                                                GET/POST: /api/publiccode/get
                                            </code>
                                            <p className="text-[9px] text-neutral-400 mt-1">Permite acceso sin identificación individual</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Schedule & Relay */}
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap className="text-purple-400" size={20} />
                                        <h3 className="text-sm font-bold text-white">Horarios y Relés</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-purple-400 mb-2">Campo ScheduleRelay:</h4>
                                            <p className="text-[10px] text-neutral-300 mb-2">Define qué relés puede activar el usuario y en qué horarios:</p>
                                            <code className="text-[9px] text-purple-400 bg-black/60 px-2 py-1 rounded block">
                                                "ScheduleRelay": "1001-1;1001-2;1002-1"
                                            </code>
                                            <p className="text-[9px] text-neutral-400 mt-2">Formato: <code>ScheduleID-RelayNum</code></p>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded">
                                            <h4 className="text-xs font-bold text-purple-400 mb-2">Schedules Predefinidos:</h4>
                                            <ul className="text-[10px] text-neutral-300 space-y-1">
                                                <li><code className="text-purple-400">1001</code> - Always (Siempre, 00:00-23:59)</li>
                                                <li><code className="text-purple-400">1002</code> - Never (Nunca)</li>
                                                <li><code className="text-purple-400">Custom</code> - Horarios personalizados por día/hora</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* WEBHOOK TAB */}
                    <TabsContent value="webhook" className="space-y-6">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white">Eventos Webhook</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Configuración del Webhook</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-neutral-500 mb-1">URL Base del Webhook:</p>
                                            <code className="text-xs text-emerald-400 bg-black/40 px-2 py-1 rounded block">
                                                http://TU_SERVIDOR:10000/api/webhooks/akuvox
                                            </code>
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500 mb-1">Método:</p>
                                            <Badge className="bg-purple-600">GET</Badge>
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500 mb-1">Parámetros:</p>
                                            <Badge className="bg-neutral-700">Query String</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">📋 Ejemplos Reales de Eventos</h3>
                                    <p className="text-xs text-neutral-400 mb-4">Eventos HTTP GET enviados por los dispositivos Akuvox</p>

                                    <div className="space-y-4">
                                        {/* Face Valid */}
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-emerald-600 text-white">✓ FACE VALID</Badge>
                                                <span className="text-xs text-emerald-400 font-bold">Reconocimiento Facial Exitoso</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada en Akuvox:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=face_valid&mac=$mac&user=$name&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request Real:</p>
                                                    <code className="text-[9px] text-emerald-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=face_valid&mac=00:1A:2B:3C:4D:5E&user=Juan%20Perez&time=1703945123
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Face Invalid */}
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-red-600 text-white">✗ FACE INVALID</Badge>
                                                <span className="text-xs text-red-400 font-bold">Cara No Reconocida</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=face_invalid&mac=$mac&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-red-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=face_invalid&mac=00:1A:2B:3C:4D:5E&time=1703945456
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Valid */}
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-emerald-600 text-white">✓ CARD VALID</Badge>
                                                <span className="text-xs text-emerald-400 font-bold">Tarjeta RFID Autorizada</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=card_valid&mac=$mac&card=$card_sn&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-emerald-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=card_valid&mac=00:1A:2B:3C:4D:5E&card=1234567890&time=1703945789
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Invalid */}
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-red-600 text-white">✗ CARD INVALID</Badge>
                                                <span className="text-xs text-red-400 font-bold">Tarjeta No Autorizada</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=card_invalid&mac=$mac&card=$card_sn&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-red-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=card_invalid&mac=00:1A:2B:3C:4D:5E&card=9999999999&time=1703946012
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Code Valid */}
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-emerald-600 text-white">✓ CODE VALID</Badge>
                                                <span className="text-xs text-emerald-400 font-bold">PIN Correcto</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=code_valid&mac=$mac&code=$code&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-emerald-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=code_valid&mac=00:1A:2B:3C:4D:5E&code=1234&time=1703946234
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Code Invalid */}
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-red-600 text-white">✗ CODE INVALID</Badge>
                                                <span className="text-xs text-red-400 font-bold">PIN Incorrecto</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=code_invalid&mac=$mac&code=$code&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-red-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=code_invalid&mac=00:1A:2B:3C:4D:5E&code=9999&time=1703946456
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Door Open */}
                                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-blue-600 text-white">🚪 DOOR OPEN</Badge>
                                                <span className="text-xs text-blue-400 font-bold">Puerta Abierta (Relé Activado)</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=door_open&mac=$mac&id=$relay_id&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-blue-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=door_open&mac=00:1A:2B:3C:4D:5E&id=A&time=1703946678
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Door Close */}
                                        <div className="bg-neutral-500/5 border border-neutral-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-neutral-600 text-white">🔒 DOOR CLOSE</Badge>
                                                <span className="text-xs text-neutral-400 font-bold">Puerta Cerrada</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=door_close&mac=$mac&id=$relay_id&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-neutral-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=door_close&mac=00:1A:2B:3C:4D:5E&id=A&time=1703946890
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tamper Alarm */}
                                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-orange-600 text-white">⚠️ TAMPER</Badge>
                                                <span className="text-xs text-orange-400 font-bold">Alarma de Manipulación</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=tamper&mac=$mac&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-orange-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=tamper&mac=00:1A:2B:3C:4D:5E&time=1703947012
                                                    </code>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Incoming Call */}
                                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge className="bg-purple-600 text-white">📞 CALLING</Badge>
                                                <span className="text-xs text-purple-400 font-bold">Llamada Entrante</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">URL Configurada:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        http://TU_SERVIDOR:10000/api/webhooks/akuvox?event=calling&mac=$mac&to=$remote&time=$time
                                                    </code>
                                                </div>
                                                <div className="bg-black/40 p-3 rounded">
                                                    <p className="text-[10px] text-neutral-500 mb-1">Ejemplo de Request:</p>
                                                    <code className="text-[9px] text-purple-400 block break-all">
                                                        GET /api/webhooks/akuvox?event=calling&mac=00:1A:2B:3C:4D:5E&to=101&time=1703947234
                                                    </code>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4">
                                    <h4 className="text-xs font-bold text-blue-400 mb-2">🔧 Variables Akuvox Disponibles</h4>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$mac</code>
                                            <p className="text-neutral-500 mt-1">Dirección MAC del dispositivo</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$ip</code>
                                            <p className="text-neutral-500 mt-1">Dirección IP del dispositivo</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$name</code>
                                            <p className="text-neutral-500 mt-1">Nombre del usuario reconocido</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$card_sn</code>
                                            <p className="text-neutral-500 mt-1">Número de tarjeta RFID</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$code</code>
                                            <p className="text-neutral-500 mt-1">Código PIN ingresado</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$time</code>
                                            <p className="text-neutral-500 mt-1">Timestamp del evento</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$relay_id</code>
                                            <p className="text-neutral-500 mt-1">ID del relé (A, B, etc)</p>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded">
                                            <code className="text-blue-400">$remote</code>
                                            <p className="text-neutral-500 mt-1">Extensión/SIP destino</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-4">
                                    <h4 className="text-xs font-bold text-yellow-400 mb-2">⚠️ Nota Importante</h4>
                                    <p className="text-[10px] text-yellow-300">
                                        Los dispositivos Akuvox tienen soporte limitado para webhooks. La mayoría de modelos NO envían eventos automáticamente.
                                        El sistema funciona principalmente mediante sincronización activa (polling) desde el servidor. Los webhooks deben configurarse
                                        manualmente en <strong>Phone &gt; Action URL</strong> del dispositivo.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* SYNC TAB */}
                    <TabsContent value="sync" className="space-y-6">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white">Proceso de Sincronización</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-4">Flujo de Sincronización DB → Dispositivo</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                                1
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white mb-1">Generar ID Determinista</h4>
                                                <p className="text-[10px] text-neutral-400">Se genera un ID numérico único basado en el ID de la DB usando hash MD5</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                                2
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white mb-1">Crear Usuario Base</h4>
                                                <p className="text-[10px] text-neutral-400">Se envía la información del usuario con TAGs y PIN mediante /api/user/add</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                                3
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white mb-1">Agregar Imagen Facial</h4>
                                                <p className="text-[10px] text-neutral-400">
                                                    Si existe foto, se descarga, convierte a Base64 y se envía mediante /api/face/add
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                                4
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white mb-1">Verificar Sincronización</h4>
                                                <p className="text-[10px] text-neutral-400">Se consulta /api/user/get para validar que el usuario fue creado correctamente</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">ID Determinista</h3>
                                    <p className="text-xs text-neutral-300 mb-3">
                                        El driver genera IDs numéricos únicos y reproducibles para cada usuario:
                                    </p>
                                    <pre className="bg-black/60 p-3 rounded text-[10px] text-neutral-300 overflow-x-auto">
                                        {`private getNumericId(stringId: string): string {
  let hash = 0;
  for (let i = 0; i < stringId.length; i++) {
    const char = stringId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000000).toString();
}`}
                                    </pre>
                                </div>

                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-4">
                                    <h4 className="text-xs font-bold text-emerald-400 mb-2">✅ Ventajas del Sistema</h4>
                                    <ul className="text-[10px] text-emerald-300 space-y-1 list-disc list-inside">
                                        <li>IDs deterministas permiten re-sincronización sin duplicados</li>
                                        <li>Soporte para múltiples credenciales por usuario (TAG + PIN + Face)</li>
                                        <li>Manejo robusto de errores con múltiples estrategias de eliminación</li>
                                        <li>Compatibilidad con diferentes firmwares de Akuvox</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* AUTH TAB */}
                    <TabsContent value="auth" className="space-y-6">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader>
                                <CardTitle className="text-white">Autenticación HTTP</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Métodos Soportados</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-black/40 p-3 rounded border border-neutral-800">
                                            <h4 className="text-xs font-bold text-white mb-2">Basic Auth (Recomendado)</h4>
                                            <p className="text-[10px] text-neutral-400 mb-2">Codificación Base64 de usuario:contraseña</p>
                                            <code className="text-[10px] text-purple-400 block">
                                                Authorization: Basic YXBpOkFwaSoyMDEx
                                            </code>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded border border-neutral-800">
                                            <h4 className="text-xs font-bold text-white mb-2">Digest Auth</h4>
                                            <p className="text-[10px] text-neutral-400 mb-2">Challenge-response con MD5 (fallback)</p>
                                            <code className="text-[10px] text-purple-400 block break-all">
                                                Authorization: Digest username="api"...
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-4">
                                    <h4 className="text-xs font-bold text-blue-400 mb-2">💡 Credenciales por Función</h4>
                                    <div className="space-y-2 text-[10px] text-blue-300">
                                        <div className="flex items-start gap-2">
                                            <Badge className="bg-blue-600 text-white text-[8px]">ADMIN</Badge>
                                            <p>Usuario: <code className="text-blue-400">admin</code> - Para gestión de usuarios y configuración</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Badge className="bg-purple-600 text-white text-[8px]">API</Badge>
                                            <p>Usuario: <code className="text-purple-400">api</code> / Password: <code className="text-purple-400">Api*2011</code> - Solo para control de relés</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Implementación en el Driver</h3>
                                    <p className="text-xs text-neutral-300 mb-3">
                                        El driver implementa automáticamente ambos métodos con fallback:
                                    </p>
                                    <ul className="text-[10px] text-neutral-300 space-y-1 list-disc list-inside">
                                        <li>Intenta primero con Basic Auth</li>
                                        <li>Si recibe 401, parsea WWW-Authenticate</li>
                                        <li>Calcula Digest Auth automáticamente</li>
                                        <li>Reintenta con las credenciales correctas</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
