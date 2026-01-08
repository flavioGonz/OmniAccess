# Configuración de Action URLs (Akuvox)

Para una gestión eficiente, se recomienda utilizar una **URL Universal** en todos los disparadores del equipo Akuvox.

## ⚠️ IMPORTANTE: Akuvox NO envía imágenes en Action URLs

A diferencia de Hikvision, los dispositivos Akuvox **NO envían imágenes de rostros** en sus webhooks Action URL.
Solo envían datos de texto (nombre de usuario, MAC, tarjeta, etc).

Para obtener imágenes de eventos, hay dos opciones:
1. **Doorlog API**: Consultar `/api/doorlog/get` para obtener logs con imágenes
2. **User API**: Obtener la foto de perfil del usuario via `/api/user/get?id=<userId>`

---

## URL Base Universal
`http://<SERVER_IP>:10000/api/webhooks/akuvox?mac=$mac&ip=$ip&time=$time`

---

## Configuración Completa de Action URLs

Copie y pegue las siguientes URLs en la sección **Intercom > Action URL** de su dispositivo Akuvox:

### Eventos de Acceso (Access Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Valid Face Recognition** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=face_valid&mac=$mac&user=$user_name&userid=$userid&FaceUrl=$FaceUrl&PicUrl=$pic_url&time=$time` |
| **Invalid Face Recognition** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=face_invalid&mac=$mac&FaceUrl=$FaceUrl&PicUrl=$pic_url&time=$time` |
| **Valid Card Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=card_valid&mac=$mac&card=$card_sn&user=$user_name&userid=$userid&time=$time` |
| **Invalid Card Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=card_invalid&mac=$mac&card=$card_sn&time=$time` |
| **Valid Code Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=code_valid&mac=$mac&code=$code&user=$user_name&userid=$userid&time=$time` |
| **Invalid Code Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=code_invalid&mac=$mac&code=$code&time=$time` |
| **Valid QR Code Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=qr_valid&mac=$mac&unlocktype=$unlocktype&time=$time` |
| **Invalid QR Code Entered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=qr_invalid&mac=$mac&unlocktype=$unlocktype&time=$time` |

### Eventos de Relé/Puerta (Relay Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Relay A Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_open&mac=$mac&relay=A&status=$relay1status&time=$time` |
| **Relay B Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_open&mac=$mac&relay=B&status=$relay2status&time=$time` |
| **Relay C Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_open&mac=$mac&relay=C&status=$relay3status&time=$time` |
| **Relay D Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_open&mac=$mac&relay=D&status=$relay4status&time=$time` |
| **Relay A Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_close&mac=$mac&relay=A&status=$relay1status&time=$time` |
| **Relay B Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_close&mac=$mac&relay=B&status=$relay2status&time=$time` |
| **Relay C Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_close&mac=$mac&relay=C&status=$relay3status&time=$time` |
| **Relay D Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=relay_close&mac=$mac&relay=D&status=$relay4status&time=$time` |

### Eventos de Input/Sensor (Input Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Input A Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_open&mac=$mac&input=A&status=$input1status&time=$time` |
| **Input B Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_open&mac=$mac&input=B&status=$input2status&time=$time` |
| **Input C Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_open&mac=$mac&input=C&status=$input3status&time=$time` |
| **Input D Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_open&mac=$mac&input=D&status=$input4status&time=$time` |
| **Input A Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_close&mac=$mac&input=A&status=$input1status&time=$time` |
| **Input B Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_close&mac=$mac&input=B&status=$input2status&time=$time` |
| **Input C Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_close&mac=$mac&input=C&status=$input3status&time=$time` |
| **Input D Closed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=input_close&mac=$mac&input=D&status=$input4status&time=$time` |

### Eventos de Llamada (Call Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Make Call** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=call_start&mac=$mac&remote=$remote&time=$time` |
| **Hang Up** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=call_end&mac=$mac&remote=$remote&time=$time` |

### Eventos de Alarma (Alarm Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Tamper Alarm Triggered** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=tamper&mac=$mac&status=$alarmstatus&time=$time` |
| **Break-in Alarm A** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=breakin&mac=$mac&input=A&status=$input1status&time=$time` |
| **Break-in Alarm B** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=breakin&mac=$mac&input=B&status=$input2status&time=$time` |

### Eventos de Sistema (System Events)

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Setup Completed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=boot&mac=$mac&model=$model&firmware=$firmware&ip=$ip&time=$time` |

---

## Variables Akuvox Disponibles

### Información del Dispositivo
| Variable | Descripción |
| :--- | :--- |
| `$mac` | Dirección MAC del equipo |
| `$ip` | Dirección IP del equipo |
| `$model` | Modelo del dispositivo (ej: R29, A05, X916) |
| `$firmware` | Versión del firmware |

### Información del Usuario
| Variable | Descripción |
| :--- | :--- |
| `$userid` | ID numérico del usuario |
| `$user_name` | Nombre del usuario registrado |
| `$schedule` | Información del horario del usuario |
| `$active_user` | Usuario activo en el contexto del evento |
| `$active_url` | La Action URL que disparó el evento |

### Información de Acceso
| Variable | Descripción |
| :--- | :--- |
| `$card_sn` | Número de serie de la tarjeta RFID |
| `$code` | Código PIN ingresado |
| `$unlocktype` | Tipo de desbloqueo: "Face", "QR Code", "Null" (inválido) |
| `$qrcode` | Contenido del código QR escaneado |

### Estado de Relés e Inputs
| Variable | Descripción |
| :--- | :--- |
| `$relay1status` | Estado del Relé A (1=Abierto, 0=Cerrado) |
| `$relay2status` | Estado del Relé B |
| `$relay3status` | Estado del Relé C |
| `$relay4status` | Estado del Relé D |
| `$input1status` | Estado del Input A (1=Activado, 0=Inactivo) |
| `$input2status` | Estado del Input B |
| `$input3status` | Estado del Input C |
| `$input4status` | Estado del Input D |
| `$alarmstatus` | Estado de alarma de tamper (1=Activada) |

### Información de Llamadas
| Variable | Descripción |
| :--- | :--- |
| `$remote` | Número SIP/IP de destino de la llamada |

### Otros
| Variable | Descripción |
| :--- | :--- |
| `$time` | Timestamp del evento (Unix) |

---

## Modelos y Características Soportadas

| Modelo | Face | Card | PIN | QR | Relés | Inputs | Digest Auth | POST |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A01** | ✅ | ✅ | ❌ | ❌ | 1 | 1 | ✅ | ❌ |
| **A02** | ✅ | ✅ | ✅ | ✅ | 1 | 1 | ✅ | ❌ |
| **A03** | ✅ | ✅ | ❌ | ❌ | 1 | 1 | ✅ | ❌ |
| **A05** | ✅ | ✅ | ❌ | ❌ | 1 | 1 | ✅ | ❌ |
| **A094** | ✅ | ✅ | ✅ | ✅ | 1 | 1 | ✅ | ❌ |
| **A095** | ✅ | ✅ | ✅ | ✅ | 2 | 2 | ✅ | ❌ |
| **R20** | ❌ | ✅ | ✅* | ❌ | 2 | 2 | ❌ | ❌ |
| **R25** | ❌ | ✅ | ✅ | ❌ | 2 | 2 | ❌ | ❌ |
| **R28V2** | ✅ | ✅ | ✅ | ✅ | 2 | 2 | ❌ | ❌ |
| **R29** | ✅ | ✅ | ✅ | ✅ | 3 | 3 | ✅ | ✅ |
| **X910** | ✅ | ✅ | ✅ | ✅ | 2 | 2 | ✅ | ✅ |
| **X912** | ✅ | ✅ | ✅ | ✅ | 3 | 3 | ✅ | ✅ |
| **X915V2** | ✅ | ✅ | ✅ | ✅ | 3 | 3 | ✅ | ✅ |
| **X916** | ✅ | ✅ | ✅ | ✅ | 4 | 4 | ✅ | ✅ |
| **S532** | ✅ | ✅ | ✅ | ✅ | 2 | 2 | ✅ | ❌ |
| **S535** | ✅ | ✅ | ✅ | ✅ | 3 | 3 | ✅ | ✅ |
| **S539** | ✅ | ✅ | ✅ | ✅ | 4 | 4 | ✅ | ✅ |
| **E12** | ❌ | ❌ | ❌ | ❌ | 1 | 1 | ✅ | ❌ |
| **E13** | ❌ | ❌ | ❌ | ❌ | 1 | 1 | ❌ | ❌ |
| **E16V2** | ❌ | ❌ | ❌ | ❌ | 1 | 1 | ✅ | ❌ |
| **E18** | ❌ | ❌ | ❌ | ❌ | 2 | 2 | ✅ | ❌ |

*R20K variant only

---

## Cómo Obtener Imágenes de Eventos Faciales

Dado que Akuvox no envía imágenes en los webhooks, para obtener la imagen asociada a un evento:

### Opción 1: Consultar el Doorlog API
```
GET http://<DEVICE_IP>/api/doorlog/get
```
Esto devuelve los últimos logs de acceso, potencialmente con imágenes.

### Opción 2: Usar la foto de perfil del usuario
Si el evento incluye `$userid`, puedes obtener la foto registrada:
```
GET http://<DEVICE_IP>/api/user/get?id=<userId>
```

### Opción 3: Foto de perfil almacenada en el servidor
Si sincronizaste las fotos de usuarios previamente, usa la imagen guardada localmente.

---

## Notas de Autenticación

- **Modelos con Digest Auth**: La mayoría de modelos soportan autenticación Digest HTTP.
- **Excepciones**: R20, R25, R28V2 y E13 **NO** soportan Digest, use Basic Auth o Whitelist.
- **POST Method**: Solo algunos modelos premium (R29, X9xx, S535, S539) soportan el método POST.
