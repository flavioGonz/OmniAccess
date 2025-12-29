# Integración de Dispositivos Akuvox

Este documento detalla la integración completa de los dispositivos de videoportero y control de acceso **Akuvox** con el sistema **SecureAccess**.

## 1. Arquitectura de Conexión

La integración funciona en dos direcciones:
1.  **Comandos (Outbound)**: El servidor envía comandos HTTP al dispositivo para sincronizar usuarios, rostros y abrir puertas.
2.  **Eventos (Inbound)**: El dispositivo envía notificaciones HTTP GET (Webhooks) al servidor cuando ocurre un evento (apertura, tarjeta, rostro).

![Diagrama de Arquitectura](PLACEHOLDER: architecture_diagram_akuvox)

---

## 2. Configuración del Dispositivo

Para que el sistema funcione, cada dispositivo Akuvox debe ser configurado para reportar eventos al servidor.

### 2.1 Configuración de Webhook (Action URL)
Navegue a la interfaz web del dispositivo Akuvox (`http://DEVICE_IP`) y vaya a:
**Phone > Action URL**.

Ahora disponemos de un **Configurador Automático** dentro de la app que genera estas URLs con su IP actual:
1. En la lista de dispositivos, busque el ícono de **Rayo (Zap)**.
2. Copie las URLs generadas.

![Configurador de Action URLs](/docs/akuvox/configurador_urls.png)

#### Tabla de Eventos Soportados:

| Evento | URL Recomendada |
| :--- | :--- |
| **Face Success** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=face_valid&mac=$mac&user=$name&time=$time` |
| **Card Success** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=card_valid&mac=$mac&card=$card_sn&time=$time` |
| **Code Success (PIN)** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=code_valid&mac=$mac&code=$code&time=$time` |
| **Tamper Alarm** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=tamper&mac=$mac&time=$time` |

---

## 3. Funcionalidades de Gestión

### 3.1 Gestión de Memoria Local (Flash)
Permite ver qué identidades están cargadas físicamente en el equipo y sincronizar usuarios específicos.

![Gestión de Memoria Flash](/docs/akuvox/memoria_flash.png)

### 3.2 Apertura Remota
Se ha implementado el comando de apertura remota utilizando las credenciales optimizadas para relés (`api` / `Api*2011`).
- Soporta tanto el modo estándar como el modo de alta seguridad (High Security Mode).

---

## 4. Manejo de Eventos (Webhooks)

El servidor procesa las peticiones entratantes en `/api/akuvox/callback`.

### Parámetros Soportados

| Parámetro | Descripción |
| :--- | :--- |
| `event` | Tipo de evento: `card`, `face`, `relay`, `open`. |
| `mac` | Dirección MAC del dispositivo (Usada para identificar el origen). |
| `card_sn` | Número de serie de la tarjeta (en eventos RFID). |
| `user` | Nombre del usuario reconocido (en eventos faciales). |
| `temp` | Temperatura corporal (si el dispositivo soporta térmica). |

### Lógica de Procesamiento
1.  **Identificación**: Se busca el dispositivo en la BD usando la MAC recibida.
2.  **Validación**:
    *   Si es `card`, se busca la credencial `TAG` o `CARD` en la BD.
    *   Si es `face`, se busca el usuario por nombre o ID asociado.
3.  **Registro**: Se crea un `AccessEvent` con decisión `GRANT` (normalmente el dispositivo ya validó el acceso si envió el evento, o se registra como monitoreo).
4.  **Notificación**: Se emite un evento WebSocket `access_event` para actualizar el Dashboard en tiempo real.

---

## 5. Diagnóstico y Monitoreo

### 5.1 Monitor de Webhooks (Debug)
Si los eventos no parecen estar llegando, puede utilizar el Monitor de Webhooks en tiempo real en la ruta `/admin/debug`. 
Este monitor muestra cada petición RAW que llega al puerto 10000, permitiendo descartar problemas de red o errores de formato.

![Monitor de Webhooks](/docs/akuvox/monitor_webhooks.png)

### 5.2 Historial de Accesos
Los eventos procesados y vinculados a usuarios se guardan en el historial maestro.

---

## 6. Solución de Problemas Frecuentes

### Error: "Self-signed certificate" o Conexión Rechazada
*   Asegúrese de usar `http://` y no `https://` si el dispositivo no tiene certificados válidos o si el servidor Node está en modo HTTP simple.
*   Verifique que el firewall de Windows/Linux permita tráfico en el puerto 10000.

### Las fotos no se sincronizan
*   Verifique que la imagen de perfil del usuario tenga un formato soportado (JPG recomendado) y un tamaño menor a 200KB.
*   El driver actual asume la ruta de la imagen local en el servidor (`public/uploads/...`).

### El dispositivo no reporta eventos
*   Revise los logs del servidor (`Control + Shift + I` en el dashboard no muestra logs de servidor, revise la consola de terminal).
*   Verifique que la **Action URL** esté activa en el dispositivo. Pruebe abrir la URL en un navegador manualmente reemplazando variables para probar conectividad.

---

*Documentación generada automáticamente por SecureAccess Assistant.*
