# OmniAccess 🚀

**Sistema Integral de Control de Acceso** con soporte para LPR (Reconocimiento de Matrículas), Reconocimiento Facial, RFID y más.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-Latest-brightgreen)](https://www.prisma.io/)

## 🌟 Características Principales

### 🚗 Reconocimiento de Matrículas (LPR)
- **Integración Hikvision**: Soporte completo para cámaras LPR Hikvision
- **Detección de Atributos**: Marca, modelo, color y tipo de vehículo
- **Sincronización Bidireccional**: Sync entre base de datos local y memoria de cámara
- **Gestión Avanzada**: Control de matrículas con paginación, búsqueda y filtros
- **Importación Masiva**: Importa matrículas desde el hardware con deduplicación automática

### 👤 Reconocimiento Facial & Neural Engine
- **Akuvox & Hikvision**: Integración con terminales y cámaras para reconocimiento facial.
- **Dashboard Facial Táctico**: Interfaz de alta precisión con mapa en vivo y popups de alerta.
- **Buscador de Rostros**: Herramienta de búsqueda manual subiendo fotos de visitantes para verificación instantánea.
- **Detección Neural**: Segundo motor de comparación facial para máxima seguridad y reducción de falsos positivos.
- **Gestión de Planos**: Carga de planos JPG/PNG para ubicación geo-espacial de cámaras y eventos.
- **Alertas en Tiempo Real**: Notificaciones visuales de sujetos en lista negra con popups tácticos.

### 🏢 Gestión de Residentes
- **Usuarios y Unidades**: Sistema completo de gestión de residentes
- **Credenciales Múltiples**: Soporte para PLATE, FACE, TAG, PIN, FINGERPRINT
- **Vehículos**: Registro detallado de vehículos con marca, modelo y color
- **Estacionamientos**: Asignación visual de espacios de parking

### 📊 Dashboards en Tiempo Real
- **Dashboard LPR**: Vista en 3 columnas (Entradas, Capturas, Salidas) para vehículos.
- **Dashboard Facial Táctico**: Monitoreo de rostros con mini-capturas e identidad con scroll horizontal.
- **Mapa Interactivo**: Ubicación de dispositivos y alertas visuales sobre planos de planta.
- **Evidencia Visual**: Capturas automáticas con overlay de información de identidad y porcentaje de match.
- **WebSocket Live**: Actualizaciones bidireccionales constantes para estados de conexión y eventos.

### 🔧 Soporte Multi-Dispositivo
- **Hikvision**: Cámaras LPR y ANPR
- **Akuvox**: Terminales de acceso con facial
- **Dahua**: Cámaras IP y control de acceso
- **Intelbras**: Dispositivos de seguridad
- **ZKTeco**: Lectores biométricos
- **Y más**: Arquitectura extensible para nuevos fabricantes

## 🚀 Instalación Rápida

### Prerrequisitos
- Node.js 18+ 
- PostgreSQL 14+
- MinIO (opcional, para almacenamiento de imágenes)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/flavioGonz/OmniAccess.git
cd OmniAccess
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/omniaccess"

# MinIO / S3 (Opcional)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_NAME="access-control"

# Webhook Server
WEBHOOK_PORT=10000
HOST=0.0.0.0

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Configurar Base de Datos
```bash
npx prisma generate
npx prisma db push
```

### 5. Iniciar Aplicación
```bash
# Terminal 1: Servidor Web
npm run dev:web

# Terminal 2: Servidor de Webhooks
npm run dev:webhooks
```

Accede a: **http://localhost:10001/admin/dashboard**

## 📖 Guía de Uso

### Configurar Dispositivos

1. **Ir a Dispositivos**: `/admin/devices`
2. **Añadir Nuevo Dispositivo**:
   - Nombre: "Cámara Entrada Principal"
   - Tipo: LPR_CAMERA
   - Marca: HIKVISION
   - IP: 192.168.1.50
   - Usuario/Contraseña: admin/password
   - Dirección: ENTRY

3. **Configurar Webhook en Hikvision**:
   - URL: `http://TU_SERVIDOR:10000/api/webhooks/hikvision`
   - Método: POST
   - Content-Type: multipart/form-data

### Gestionar Matrículas

1. **Abrir Control LPR**: Click en "Lista Interna LPR" en el dispositivo
2. **Cargar Matrículas**: Presiona "Leer Hardware"
3. **Filtrar Faltantes**: Usa el botón de filtro naranja 🔶
4. **Importar a Base de Datos**: "Descargar hacia App"
5. **Sincronizar a Cámara**: "Sync hacia Cámara"

### Monitorear Accesos

El Dashboard muestra:
- **Columna Izquierda**: Entradas en tiempo real
- **Columna Central**: Capturas visuales con marca y color del vehículo
- **Columna Derecha**: Salidas en tiempo real

## 🏗️ Arquitectura

```
OmniAccess/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/             # Panel de administración
│   │   ├── api/               # API Routes
│   │   └── actions/           # Server Actions
│   ├── components/            # Componentes React
│   │   ├── ui/               # Componentes UI base (shadcn)
│   │   ├── dashboard/        # Componentes del dashboard
│   │   └── vehicles/         # Gestión de vehículos
│   ├── lib/
│   │   ├── drivers/          # Drivers para dispositivos
│   │   ├── car-logos.ts      # Base de datos de logos
│   │   └── prisma.ts         # Cliente Prisma
│   └── services/             # Servicios de negocio
├── server.js                  # Servidor de Webhooks
├── prisma/
│   └── schema.prisma         # Esquema de base de datos
└── docs/                     # Documentación
```

## 🔌 API de Webhooks

### Hikvision LPR
```http
POST /api/webhooks/hikvision
Content-Type: multipart/form-data

{
  "EventNotificationAlert": {
    "ANPR": {
      "licensePlate": "ABC123",
      "vehicleInfo": {
        "color": "gray",
        "vehicleLogoRecog": 1060
      }
    }
  }
}
```

### Akuvox
```http
GET /api/webhooks/akuvox?event=face_valid&mac=AA:BB:CC:DD:EE:FF&user=John
```

## 🎨 Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Lucide Icons
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL + Prisma ORM
- **Real-time**: Socket.IO
- **Storage**: MinIO (S3-compatible)
- **HTTP Client**: Axios
- **XML Parsing**: fast-xml-parser

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev:web          # Servidor web (puerto 10001)
npm run dev:webhooks     # Servidor de webhooks (puerto 10000)

# Producción
npm run build           # Build de producción
npm start              # Iniciar en producción

# Base de Datos
npx prisma studio      # Explorador visual de BD
npx prisma generate    # Generar cliente Prisma
npx prisma db push     # Aplicar cambios al esquema

# Utilidades
node scripts/migrate-colors.js  # Migrar colores históricos
```

## 🔐 Seguridad

- ✅ Autenticación de dispositivos por IP y credenciales
- ✅ Validación de webhooks con firma HMAC (opcional)
- ✅ Sanitización de entradas
- ✅ Rate limiting en endpoints críticos
- ✅ CORS configurado para producción

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más información.

## 👨‍💻 Autor

**Flavio González**
- GitHub: [@flavioGonz](https://github.com/flavioGonz)

## 🙏 Agradecimientos

- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [Hikvision](https://www.hikvision.com/) - Documentación de API
- [Akuvox](https://www.akuvox.com/) - Soporte técnico
- [Prisma](https://www.prisma.io/) - ORM excepcional

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
