# Guía de Instalación en Servidor Remoto - OmniAccess

## 📋 Requisitos del Servidor

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Node.js 18+ y npm
- PostgreSQL 14+
- PM2 (gestor de procesos)
- Git

## 🚀 Instalación Paso a Paso

### 1. Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Git
sudo apt install -y git
```

### 2. Configurar PostgreSQL

#### Opción A: Base de Datos Local (en el mismo servidor)

```bash
# Acceder a PostgreSQL
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE omniaccess;
CREATE USER omniaccess_user WITH ENCRYPTED PASSWORD 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE omniaccess TO omniaccess_user;
\q
```

**Permitir conexiones locales** (editar `/etc/postgresql/14/main/pg_hba.conf`):
```
# Añadir esta línea:
local   omniaccess      omniaccess_user                     md5
```

Reiniciar PostgreSQL:
```bash
sudo systemctl restart postgresql
```

#### Opción B: Base de Datos Remota (en otro servidor por IP)

**En el servidor de PostgreSQL remoto:**

1. **Editar `postgresql.conf`** para permitir conexiones externas:
```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Buscar y modificar:
```conf
# Cambiar de:
# listen_addresses = 'localhost'
# A:
listen_addresses = '*'
```

2. **Editar `pg_hba.conf`** para permitir tu IP:
```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Añadir al final (reemplazar con la IP de tu servidor de aplicación):
```conf
# Permitir conexión desde el servidor de aplicación
host    omniaccess    omniaccess_user    IP_SERVIDOR_APP/32    md5

# O permitir desde toda una red (ejemplo: 192.168.1.0/24)
host    omniaccess    omniaccess_user    192.168.1.0/24        md5
```

3. **Crear base de datos y usuario**:
```bash
sudo -u postgres psql

CREATE DATABASE omniaccess;
CREATE USER omniaccess_user WITH ENCRYPTED PASSWORD 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE omniaccess TO omniaccess_user;
\q
```

4. **Configurar firewall** para permitir PostgreSQL (puerto 5432):
```bash
sudo ufw allow from IP_SERVIDOR_APP to any port 5432
# O para toda la red:
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

5. **Reiniciar PostgreSQL**:
```bash
sudo systemctl restart postgresql
```

**Verificar conexión desde el servidor de aplicación:**
```bash
# Instalar cliente PostgreSQL si no está instalado
sudo apt install -y postgresql-client

# Probar conexión
psql -h IP_SERVIDOR_POSTGRES -U omniaccess_user -d omniaccess

# Si conecta correctamente, verás el prompt de PostgreSQL:
# omniaccess=>
```

### 3. Clonar el Repositorio

```bash
# Ir al directorio de aplicaciones
cd /opt

# Clonar repositorio
sudo git clone https://github.com/flavioGonz/OmniAccess.git
cd OmniAccess

# Dar permisos al usuario actual
sudo chown -R $USER:$USER /opt/OmniAccess
```

### 4. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con nano o vim
nano .env
```

**Configuración para Base de Datos LOCAL:**
```env
# Database (servidor local)
DATABASE_URL="postgresql://omniaccess_user:TU_PASSWORD_SEGURO@localhost:5432/omniaccess"

# MinIO / S3 (Opcional - dejar comentado si no usas)
# S3_ENDPOINT="http://localhost:9000"
# S3_ACCESS_KEY="minioadmin"
# S3_SECRET_KEY="minioadmin"
# S3_BUCKET_NAME="access-control"

# Webhook Server
WEBHOOK_PORT=10000
HOST=0.0.0.0

# Next.js (Cambiar por la IP/dominio del servidor)
NEXT_PUBLIC_API_URL=http://TU_IP_SERVIDOR:10001
```

**Configuración para Base de Datos REMOTA:**
```env
# Database (servidor remoto por IP)
DATABASE_URL="postgresql://omniaccess_user:TU_PASSWORD_SEGURO@IP_SERVIDOR_POSTGRES:5432/omniaccess"

# Ejemplo con IP real:
# DATABASE_URL="postgresql://omniaccess_user:MiPassword123@192.168.1.100:5432/omniaccess"

# MinIO / S3 (Opcional)
# S3_ENDPOINT="http://192.168.1.100:9000"
# S3_ACCESS_KEY="minioadmin"
# S3_SECRET_KEY="minioadmin"
# S3_BUCKET_NAME="access-control"

# Webhook Server
WEBHOOK_PORT=10000
HOST=0.0.0.0

# Next.js
NEXT_PUBLIC_API_URL=http://TU_IP_SERVIDOR:10001
```

**Formato de DATABASE_URL:**
```
postgresql://[USUARIO]:[PASSWORD]@[HOST]:[PUERTO]/[NOMBRE_BD]
```

Donde:
- `USUARIO`: omniaccess_user (o el que creaste)
- `PASSWORD`: La contraseña que configuraste
- `HOST`: `localhost` (local) o `192.168.1.100` (remota)
- `PUERTO`: `5432` (puerto por defecto de PostgreSQL)
- `NOMBRE_BD`: `omniaccess`

### 5. Instalar Dependencias y Configurar Base de Datos

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Aplicar esquema a la base de datos
npx prisma db push

# (Opcional) Crear usuario admin inicial
# npx prisma db seed
```

### 6. Compilar para Producción

```bash
# Build de Next.js
npm run build
```

### 7. Crear Directorio de Logs

```bash
mkdir -p logs
```

### 8. Iniciar con PM2

```bash
# Iniciar ambos procesos
pm2 start ecosystem.config.json

# Verificar estado
pm2 status

# Ver logs en tiempo real
pm2 logs

# Guardar configuración para auto-inicio
pm2 save

# Configurar PM2 para iniciar al arrancar el servidor
pm2 startup
# Ejecutar el comando que PM2 te muestre
```

### 9. Configurar Firewall

```bash
# Permitir puertos necesarios
sudo ufw allow 10001/tcp  # Web UI
sudo ufw allow 10000/tcp  # Webhooks
sudo ufw enable
```

## 🔄 Actualizar la Aplicación

```bash
cd /opt/OmniAccess

# Detener procesos
pm2 stop all

# Actualizar código
git pull origin main

# Reinstalar dependencias (si hay cambios)
npm install

# Aplicar cambios de base de datos (si hay)
npx prisma generate
npx prisma db push

# Recompilar
npm run build

# Reiniciar procesos
pm2 restart all
```

## 📊 Comandos Útiles de PM2

```bash
# Ver estado de procesos
pm2 status

# Ver logs en tiempo real
pm2 logs

# Ver logs de un proceso específico
pm2 logs omniaccess-web
pm2 logs omniaccess-webhooks

# Reiniciar un proceso
pm2 restart omniaccess-web

# Detener todos los procesos
pm2 stop all

# Eliminar procesos de PM2
pm2 delete all

# Monitoreo en tiempo real
pm2 monit
```

## 🔧 Solución de Problemas

### Error de Conexión a Base de Datos

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -U omniaccess_user -d omniaccess -h localhost

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Puerto 10001 o 10000 ya en uso

```bash
# Ver qué proceso usa el puerto
sudo lsof -i :10001
sudo lsof -i :10000

# Matar proceso si es necesario
sudo kill -9 PID
```

### Permisos de Archivos

```bash
# Dar permisos correctos
sudo chown -R $USER:$USER /opt/OmniAccess
chmod -R 755 /opt/OmniAccess
```

## 🌐 Configurar Nginx como Proxy Reverso (Opcional)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/omniaccess
```

**Contenido del archivo:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Web UI
    location / {
        proxy_pass http://localhost:10001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Webhooks
    location /api/webhooks {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/omniaccess /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

## 🔐 Configurar SSL con Let's Encrypt (Opcional)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Renovación automática ya está configurada
```

## 📈 Monitoreo y Logs

```bash
# Ver logs de aplicación
pm2 logs --lines 100

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Espacio en disco
df -h

# Uso de memoria
free -h

# Procesos activos
htop
```

## 🔄 Backup de Base de Datos

```bash
# Crear backup
pg_dump -U omniaccess_user omniaccess > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -U omniaccess_user omniaccess < backup_20250129.sql
```

## ✅ Verificación Final

1. **Web UI**: http://TU_IP:10001/admin/dashboard
2. **Webhook Hikvision**: http://TU_IP:10000/api/webhooks/hikvision
3. **Webhook Akuvox**: http://TU_IP:10000/api/webhooks/akuvox

---

**¿Necesitas ayuda?** Abre un issue en GitHub: https://github.com/flavioGonz/OmniAccess/issues
