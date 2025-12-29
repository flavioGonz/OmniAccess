# Sistema LPR & Face Access Control - Estado Actual

## ✅ Funcionalidades Implementadas

### 1. Webhook Hikvision
- **Ruta**: `http://[IP_SERVIDOR]:10000/api/webhooks/hikvision`
- **Método**: POST (multipart/form-data)
- **Funcionalidad**:
  - Recibe eventos de cámaras Hikvision
  - Extrae XML con datos de matrícula
  - Guarda imágenes en `/public/uploads/events`
  - Identifica dispositivo por MAC Address
  - Busca credenciales en base de datos
  - Crea eventos de acceso (GRANT/DENY)
  - Emite eventos en tiempo real vía Socket.io
  - Responde con XML formato Hikvision

### 2. Dashboard en Tiempo Real
- **Ruta**: `http://localhost:10001/admin/dashboard`
- **Funcionalidad**:
  - Muestra eventos de acceso en tiempo real
  - Carga últimos 20 eventos históricos al iniciar
  - Actualización automática vía Socket.io (Puerto 10000)
  - Muestra imagen, matrícula, decisión, usuario y dispositivo
  - Estadísticas rápidas (eventos del día, denegados)

### 3. Gestión de Dispositivos
- **Ruta**: `http://localhost:10001/admin/devices`
- **Funcionalidad**:
  - Crear dispositivos (Cámaras LPR / Terminales Faciales)
  - Editar dispositivos existentes
  - Eliminar dispositivos
  - Probar conexión ISAPI (Hikvision)
  - Mostrar estado de conexión
  - Asignar a grupos de acceso

### 4. Gestión de Usuarios
- **Ruta**: `http://localhost:10001/admin/users`
- **Funcionalidad**:
  - Crear usuarios con credenciales (PLATE/FACE)
  - Asignar a unidades
  - Asignar a grupos de acceso
  - Sincronización automática a dispositivos

### 5. Gestión de Unidades
- **Ruta**: `http://localhost:10001/admin/units`
- **Funcionalidad**:
  - Crear unidades (departamentos, edificios, etc.)
  - Asignar usuarios a unidades

### 6. Grupos de Acceso
- **Ruta**: `http://localhost:10001/admin/groups`
- **Funcionalidad**:
  - Crear grupos de acceso
  - Asignar usuarios y dispositivos a grupos
  - Control de acceso basado en grupos

### 7. Historial de Eventos
- **Ruta**: `http://localhost:10001/admin/history`
- **Funcionalidad**:
  - Ver todos los eventos de acceso
  - Filtrar por fecha, usuario, dispositivo
  - Ver imágenes de eventos

## 🔧 Configuración de Cámaras Hikvision

### Paso 1: Acceder a la Cámara
1. Abrir navegador: `http://[IP_CAMARA]`
2. Login con credenciales admin

### Paso 2: Configurar Webhook
1. Ir a: **Configuration → Event → Smart Event → ANPR**
2. Buscar: **HTTP Listening** o **Upload to HTTP**
3. Configurar:
   - **IP de destino**: `[IP_SERVIDOR]` (ej: 192.168.196.191)
   - **Puerto**: `10000`
   - **URL**: `/api/webhooks/hikvision`
   - **Protocolo**: `HTTP`
   - **Método**: `POST`

### Paso 3: Registrar Dispositivo en el Sistema
1. Ir a: `http://localhost:10001/admin/devices`
2. Clic en "Agregar Dispositivo"
3. Completar:
   - **Nombre**: Ej: "Cámara Entrada Principal"
   - **Tipo**: LPR_CAMERA
   - **Marca**: HIKVISION
   - **IP**: [IP de la cámara]
   - **MAC Address**: [MAC de la cámara] (importante para identificación)
   - **Dirección**: ENTRY o EXIT
   - **Usuario**: admin (de la cámara)
   - **Contraseña**: [contraseña de la cámara]
4. Clic en "Probar" para verificar conexión ISAPI

## 📝 Flujo de Trabajo

### Crear un Usuario con Matrícula
1. Ir a: `http://localhost:10001/admin/units`
2. Crear una unidad (ej: "Depto 101")
3. Ir a: `http://localhost:10001/admin/users`
4. Crear usuario:
   - Nombre, email, teléfono
   - Tipo de credencial: PLATE
   - Valor: ABC123 (matrícula)
   - Seleccionar unidad
   - (Opcional) Asignar a grupo de acceso

### Probar el Sistema
1. Abrir dashboard: `http://localhost:10001/admin/dashboard`
2. Hacer que la cámara detecte la matrícula ABC123
3. Ver el evento aparecer en tiempo real:
   - Si la matrícula está registrada: **GRANT** (verde)
   - Si no está registrada: **DENY** (rojo)

## 🐛 Solución de Problemas

### La cámara no envía eventos
1. Verificar que el webhook está configurado correctamente
2. Probar endpoint: `http://[IP_SERVIDOR]:10000/api/webhooks/hikvision`
3. Revisar logs del servidor en la consola
4. Verificar firewall (puerto 10000 abierto)

### No se ven eventos en el dashboard
1. Abrir consola del navegador (F12)
2. Verificar conexión Socket.io (puerto 10000)
3. Revisar que el servidor esté corriendo
4. Refrescar la página

### Error de conexión ISAPI
1. Verificar IP de la cámara
2. Verificar credenciales (usuario/contraseña)
3. Verificar que la cámara es accesible desde el servidor
4. Revisar que el puerto HTTP está habilitado en la cámara

## 📊 Base de Datos

### Modelos Principales
- **Device**: Cámaras y terminales
- **User**: Usuarios del sistema
- **Unit**: Unidades (departamentos, edificios)
- **Credential**: Credenciales (matrículas, rostros)
- **AccessGroup**: Grupos de acceso
- **AccessEvent**: Eventos de acceso (log)

### Tipos de Dispositivos
- **LPR_CAMERA**: Cámara de reconocimiento de matrículas
- **FACE_TERMINAL**: Terminal de reconocimiento facial

### Marcas Soportadas
- HIKVISION (implementado)
- AKUVOX (stub)
- INTELBRAS (stub)
- DAHUA (stub)
- ZKTECO (stub)
- AVICAM (stub)
- MILESIGHT (stub)
- UNIFI (stub)
- UNIVIEW (stub)

## 🚀 Próximos Pasos

1. **Implementar drivers completos** para otras marcas
2. **Agregar reconocimiento facial** (webhook Akuvox)
3. **Implementar horarios de acceso** (Schedule model)
4. **Agregar autenticación** (NextAuth.js)
5. **Crear landing page** pública
6. **Optimizar imágenes** con Sharp
7. **Agregar notificaciones** (email, push)
8. **Dashboard de estadísticas** avanzado
9. **Exportar reportes** (PDF, Excel)
10. **App móvil** (React Native)

## 📞 URLs Importantes

- **Dashboard**: http://localhost:10001/admin/dashboard
- **Dispositivos**: http://localhost:10001/admin/devices
- **Usuarios**: http://localhost:10001/admin/users
- **Unidades**: http://localhost:10001/admin/units
- **Grupos**: http://localhost:10001/admin/groups
- **Historial**: http://localhost:10001/admin/history
- **Webhook Hikvision**: http://[IP]:10000/api/webhooks/hikvision
- **Webhook Akuvox**: http://[IP]:10000/api/webhooks/akuvox
