# Configuración de Action URLs (Akuvox)

Para una gestión eficiente, se recomienda utilizar una **URL Universal** en todos los disparadores del equipo Akuvox, cambiando únicamente el parámetro `event`.

## URL Base Universal
`http://<SERVER_IP>:10000/api/webhooks/akuvox?mac=$mac&ip=$ip&time=$time`

---

## Configuración Recomendada (Top 6 Eventos)

Copie y pegue las siguientes URLs en la sección **Phone > Action URL** de su dispositivo Akuvox:

| Evento en Akuvox | URL a configurar |
| :--- | :--- |
| **Face Success** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=face_valid&mac=$mac&user=$name&time=$time` |
| **Face Failed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=face_invalid&mac=$mac&time=$time` |
| **Card Success** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=card_valid&mac=$mac&card=$card_sn&time=$time` |
| **Card Failed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=card_invalid&mac=$mac&card=$card_sn&time=$time` |
| **Code Success** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=code_valid&mac=$mac&code=$code&time=$time` |
| **Code Failed** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=code_invalid&mac=$mac&code=$code&time=$time` |
| **Open Door (Relay)**| `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=door_open&mac=$mac&id=$relay_id&time=$time` |
| **Close Door (Relay)**| `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=door_close&mac=$mac&id=$relay_id&time=$time` |
| **Tamper Alarm** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=tamper&mac=$mac&time=$time` |
| **Incoming Call** | `http://<SERVER_IP>:10000/api/webhooks/akuvox?event=calling&mac=$mac&to=$remote&time=$time` |

---

## Parámetros Adicionales Soportados

Si desea capturar más información, el servidor está preparado para procesar:
- `code`: Código PIN ingresado (usar con `event=code_valid`).
- `to`: Número de extensión o SIP al que se está llamando (usar con `event=calling`).
- `temp`: Temperatura detectada (en modelos con sensor térmico).

## Variables Akuvox Comunes
- `$mac`: Dirección MAC del equipo.
- `$ip`: Dirección IP del equipo.
- `$name`: Nombre del usuario reconocido.
- `$card_sn`: Número de serie de la tarjeta RFID.
- `$code`: Código PIN ingresado.
- `$time`: Estampa de tiempo del evento.
- `$relay_id`: ID del relé activado (A, B, etc).
