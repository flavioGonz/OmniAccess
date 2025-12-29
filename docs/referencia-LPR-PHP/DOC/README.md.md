**Comprendido. Quieres un documento exhaustivo, casi a nivel de manual técnico y de usuario. Un** **README** **que no solo describa el proyecto, sino que lo explique en profundidad, detallando la lógica, las decisiones de diseño y el "por qué" de cada componente.**

**Aquí tienes esa versión. Es un documento largo y detallado, diseñado para que cualquier persona (otro desarrollador, un administrador de sistemas o incluso tú mismo en el futuro) pueda entender el proyecto en su totalidad.**

---

# Manual Técnico y de Arquitectura: Sistema de Gestión LPR para Cámaras Hikvision

## Resumen Ejecutivo

**Este documento detalla la arquitectura, funcionalidades y lógica operativa de un sistema avanzado de software diseñado para la gestión de acceso vehicular mediante tecnología de Reconocimiento de Matrículas (LPR). La aplicación se integra directamente con cámaras LPR de Hikvision, actuando como un centro de mando centralizado para recibir eventos, administrar listas blancas, auditar dispositivos y visualizar la actividad en tiempo real.**

**El sistema está construido sobre una pila tecnológica LAMP (PHP y MySQL), con una interfaz web dinámica y modular. Su arquitectura permite la comunicación bidireccional con dispositivos remotos a través de Internet, manejando tanto los eventos entrantes (webhooks) como las consultas salientes a la API ISAPI de las cámaras.**

---

## 1. Flujo de Trabajo y Arquitectura del Sistema

 **El sistema opera sobre dos flujos de comunicación principales y concurrentes: el** **Flujo de Eventos (entrante)** **y el** **Flujo de Gestión (saliente)**.

### 1.1. Flujo de Eventos: De la Cámara a la Base de Datos

* **Detección (Hardware):** **Una cámara LPR de Hikvision configurada en campo detecta una matrícula. El software interno de la cámara captura la imagen, extrae los caracteres de la matrícula y empaqueta esta información.**
* **Notificación (Webhook POST):** **La cámara, configurada para "Notificar al Centro de Vigilancia", inicia una conexión HTTP POST hacia una URL pública predefinida. Esta URL apunta al** **webhook.php** **en el servidor de producción. La petición se envía en formato** **multipart/form-data** **y contiene dos partes principales:**

  * **Un archivo** **XML** **con los metadatos del evento: matrícula, fecha/hora, tipo de evento, y crucialmente, la** **dirección MAC** **del dispositivo emisor.**
  * **Un archivo de** **imagen** **(generalmente JPG) de la captura de la matrícula.**
* **Recepción y Procesamiento (**webhook.php**):** **Este script es el corazón de la ingesta de datos.**

  * **Validación:** **Recibe la petición y parsea el contenido XML y la imagen.**
  * **Identificación del Dispositivo:** **Extrae la dirección MAC del XML y realiza una consulta a la tabla** **devices** **de la base de datos para identificar qué cámara específica generó el evento. Este método es más robusto que usar la IP de origen, que puede ser enmascarada por NAT.**
  * **Persistencia de Imagen:** **Guarda la imagen de la matrícula en el directorio** **plate_images/** **con un nombre de archivo único para evitar colisiones.**
  * **Gestión de Vehículos:**

    * **Consulta la tabla** **vehicles** **usando la matrícula recibida.**
    * **Si el vehículo no existe, lo crea automáticamente.**
    * **Si existe, actualiza su** **updated_at** **timestamp.**
  * **Lógica de Acceso y Estacionamiento:**

    * **Basándose en el** **name** **del dispositivo identificado (que debe contener "Entrada" o "Salida"), el sistema actualiza el estado booleano** **is_inside** **del vehículo.**
    * **Crea o actualiza un registro en la tabla** **parking_sessions**, marcando la hora de entrada (**entry_time**) o de salida (**exit_time**). Esto permite un historial completo de la ocupación.
  * **Registro de Eventos:** **Se inserta un registro completo en la tabla** **events**, vinculando el vehículo, el dispositivo y toda la información del evento.
  * **Respuesta a la Cámara:** **El script finaliza enviando una respuesta XML de confirmación (**`<statusCode>`1 `</statusCode>`**) a la cámara, indicando que el evento fue recibido y procesado con éxito.**

### 1.2. Flujo de Gestión: De la Interfaz de Usuario a la Cámara

* **Interacción del Usuario:** **Un administrador accede a la aplicación a través de** **index.php**, que actúa como un router y carga el módulo solicitado (ej. **dispositivos_lpr.php**).
* **Petición AJAX (Frontend → Backend):** **Al realizar una acción que requiere comunicación con una cámara (ej. hacer clic en "Ver Lista Blanca"), el JavaScript del frontend inicia una petición** **fetch** **(AJAX) a un endpoint PHP específico en el servidor (ej.** **get_camera_whitelist.php**). La petición incluye el ID del dispositivo a consultar.
* **Orquestación del Backend:**

  * **El endpoint PHP (**get_camera_whitelist.php**) recibe el ID del dispositivo.**
  * **Consulta la tabla** **devices** **para obtener la información de conexión de la cámara: su dirección de acceso remoto (**ip**, que contiene el dominio/IP pública y el puerto),** **username**, y **password**.
  * **Llama a una función de ayuda (definida en** **api_helpers.php**) para construir y ejecutar la petición a la API.
* **Comunicación API (Servidor PHP ↔ Cámara):**

  * **La función** **getWhitelistFromCamera** **utiliza la librería** **cURL** **de PHP para iniciar una conexión HTTP hacia la dirección remota de la cámara.**
  * **Se negocia la** **Autenticación Digest** **con la cámara, enviando las credenciales de forma segura.**
  * **Se construye una petición (en este caso, un** **POST** **con cuerpo** **XML**) y se envía al endpoint específico de la API ISAPI de la cámara (ej. **/ISAPI/Traffic/channels/1/searchLPListAudit**).
  * **Manejo de Paginación:** **Como la cámara limita el número de resultados por respuesta (ej. 400), la función entra en un bucle. Realiza múltiples peticiones, ajustando el** **searchResultPosition** **en el XML enviado, hasta que ha recopilado todos los registros.**
  * **La cámara responde a cada petición con un XML.**
* **Procesamiento de la Respuesta:**

  * **La función PHP recibe el XML de la cámara, lo parsea con** **simplexml_load_string**, y extrae la información relevante (la lista de matrículas).
  * **El endpoint (**get_camera_whitelist.php**)** **enriquece estos datos**, cruzando las matrículas recibidas con la base de datos local para añadir el nombre del propietario de cada una.
  * **Finalmente, codifica toda esta información en un único** **JSON** **y lo devuelve como respuesta a la petición AJAX.**
* **Actualización de la Interfaz:** **El JavaScript del frontend recibe el JSON, lo procesa y actualiza dinámicamente el contenido del modal en la página, mostrando la lista completa y enriquecida al usuario sin necesidad de recargar la página.**

---

## 2. Integración Detallada con la API ISAPI de Hikvision

**La comunicación con las cámaras es la funcionalidad más compleja y crítica. Se basa en la ingeniería inversa y adaptación a las particularidades de la API ISAPI de Hikvision.**

### 2.1. Conectividad y Red (Port Forwarding)

**Para que el servidor pueda iniciar una conexión con una cámara en una red remota, se requiere la configuración de** **Port Forwarding** **en el router donde reside la cámara.**

* **Regla de Redirección:** **Se crea una regla que mapea un puerto público del router (ej.** **TCP 8881**) a la IP y puerto privado del servicio web de la cámara (generalmente **192.168.1.50:80**).
* **Configuración en la Aplicación:** **El campo** **ip** **en la tabla** **devices** **debe almacenar la dirección pública completa, incluyendo el puerto (ej:** **dominio-ddns.com:8881**). Esta es la dirección que cURL usará para sus peticiones.
* **Consideraciones de Seguridad:** **Esta configuración expone un servicio a Internet. Es** **mandatorio** **que la cámara tenga un firmware actualizado y una contraseña de administrador extremadamente robusta para mitigar riesgos de ataques.**

### 2.2. Endpoints de la API y Formato de Datos

**Se ha determinado que diferentes modelos/firmwares utilizan diferentes endpoints. La aplicación ha sido estandarizada para usar las siguientes rutas, que han demostrado ser compatibles con los dispositivos probados.**

| **Funcionalidad** | **Endpoint ISAPI** | **Método HTTP** | **Formato del Cuerpo (Request)** | **Formato de la Respuesta (Response)** |
|---|---|---|---|---|
| **Leer Lista Blanca** | **/ISAPI/Traffic/channels/1/searchLPListAudit** | **POST** | **XML (**`<LPSearchCond>`**)** | **XML (**`<LPListAuditSearchResult>`**)** |
| **Escribir en Lista Blanca** | **/ISAPI/AccessControl/vehicleRecord?format=json** | **PUT** | **JSON (**{"vehicleRecord": ...}**)** | **JSON** |
| **Chequeo de Estado** | **/ISAPI/Traffic/channels/1/searchLPListAudit** | **POST** | **XML (**`<LPSearchCond>` **pidiendo 1 resultado)** | **XML** |

#### Lógica de Petición para Leer Lista Blanca (Detallado)

* **Petición:** **Se envía un** **POST** **con** **Content-Type: application/xml**. El cuerpo es un XML que define los parámetros de búsqueda.

  ```xml
  <LPSearchCond>
      <searchID>...</searchID> <!-- Un ID único para la búsqueda -->
      <maxResult>400</maxResult> <!-- El tamaño de página que la cámara soporta -->
      <searchResultPosition>0</searchResultPosition> <!-- El índice de inicio -->
  </LPSearchCond>
  ```

* **Bucle de Paginación:** **El código PHP ejecuta esta petición dentro de un bucle** **while**. Después de cada llamada exitosa que devuelve 400 resultados, incrementa **searchResultPosition** **en 400 y realiza la siguiente llamada. El bucle termina cuando una llamada devuelve menos de 400 resultados.**
* **Parseo de la Respuesta:** **La respuesta XML de la cámara tiene la siguiente estructura:**

  ```xml
  <LPListAuditSearchResult>
      <LicensePlateInfoList>
          <LicensePlateInfo>
              <LicensePlate>ABC123</LicensePlate>
              ...
          </LicensePlateInfo>
          ...
      </LicensePlateInfoList>
  </LPListAuditSearchResult>
  ```

  **El código PHP navega esta estructura (**$xml_object->LicensePlateInfoList->LicensePlateInfo**) para extraer cada matrícula.**

---

## 3. Guía de Módulos y Funcionalidades de la Interfaz

**La aplicación se organiza en torno a un** **index.php** **principal que carga los siguientes módulos:**

### dispositivos_lpr.php **(Panel de Control de Dispositivos)**

* **Funcionalidad:** **Es el centro de mando para la configuración de hardware. Permite añadir, editar y eliminar cámaras.**
* **Campos Clave:** **Nombre** **(debe contener "Entrada" o "Salida"),** **Dirección IP:Puerto** **(la dirección pública para el acceso API),** **MAC Address** **(para el webhook), y** **Usuario**/**Contraseña** **(para la autenticación API).**
* **Indicador de Estado (LED):** **Al cargar la página, un script AJAX llama a** **check_devices_status.php**. Este endpoint intenta conectar con cada cámara configurada. La interfaz muestra un LED verde si la conexión es exitosa, o rojo si falla, con un tooltip que detalla el error.
* **Auditoría de Lista Blanca:** **Un botón "Ver Lista" por cada dispositivo inicia una llamada AJAX a** **get_camera_whitelist.php**. Este endpoint ejecuta la lógica de paginación para leer la lista completa desde la cámara, la cruza con la base de datos local para añadir nombres de propietarios, y devuelve el resultado para ser mostrado en un modal interactivo con funcionalidad de búsqueda.

### whitelist_manager.php **(Gestión de Lista Blanca)**

* **Funcionalidad:** **Interfaz principal para gestionar los vehículos que tienen acceso permitido.**
* **Añadir Matrícula:** **Un modal permite ingresar una nueva matrícula. Al guardar, se realizan dos acciones:**

  * **Se inserta/actualiza el vehículo en la tabla** **vehicles** **local, con** **is_whitelisted = 1**.
  * **Si se seleccionan cámaras, se inicia una llamada API (usando** **addPlateToCameraWhitelist**) para añadir la matrícula a la lista blanca interna de cada cámara seleccionada.
* **Eliminar Matrícula:** **Un modal de confirmación asegura la acción. Al confirmar, se realiza un "soft delete": el vehículo se mantiene en la base de datos, pero su** **is_whitelisted** **se establece en** **0**. **Nota: La funcionalidad para eliminar la matrícula de la cámara remotamente no está implementada por defecto.**
* **Visualización:** **La tabla principal muestra la lista blanca desde la base de datos local, enriquecida con datos del propietario, lote y la última imagen capturada del vehículo.**

### live_console.html **(Consola de Eventos en Vivo)**

* **Funcionalidad:** **Ofrece una visión en tiempo real de la actividad de las cámaras.**
* **Actualización Automática:** **Un script JavaScript realiza peticiones periódicas (polling) a** **get_live_data.php** **cada pocos segundos.**
* **Visualización:** **Los eventos se muestran en carruseles visuales, con la última captura destacada en el centro. Cada captura muestra la matrícula, la imagen, la decisión de acceso, el nombre del propietario y la cámara que la generó.**
* **Filtros:** **Permite filtrar los eventos mostrados por texto (matrícula, propietario), por cámara específica, por decisión (permitido/denegado) o por fecha.**

---

## 4. Estructura de la Base de Datos y Relaciones

**El esquema está diseñado para ser relacional y escalable.**

* **devices**, **vehicles**, **owners**, y **lots** **son las tablas de entidades principales.**
* **events** **es la tabla transaccional que crece constantemente, registrando cada detección.**
* **parking_sessions** **modela la lógica de negocio de la ocupación, separada de los eventos individuales.**
* **users** **permite la gestión de acceso al sistema.**
* **owner_lot_associations** **gestiona la relación muchos-a-muchos entre propietarios y lotes.**
* **Claves Foráneas (FK):** **El uso de claves foráneas (**vehicle_id**,** **device_id**, **owner_id**) asegura la integridad referencial de los datos.**

**Este diseño permite consultas complejas, como "mostrar todos los eventos de vehículos pertenecientes a propietarios del Lote X, capturados por la cámara de Entrada".**






---





### Versión 2.0 del **README.md** **(Completo y Detallado)**

**Este documento ha sido reescrito desde cero para reflejar la arquitectura actual, las funcionalidades avanzadas y la lógica de negocio de la aplicación.**

# Manual de Arquitectura y Operación: Sistema LPR "ParkVision"

## 1. Visión General del Proyecto

**ParkVision** **es una aplicación web basada en PHP y MySQL diseñada para actuar como un centro de control integral para sistemas de Reconocimiento de Matrículas (LPR) basados en cámaras Hikvision. El sistema va más allá de la simple recepción de eventos, ofreciendo un conjunto de herramientas para la gestión de acceso, auditoría de dispositivos remotos y análisis de datos históricos.**

**La arquitectura del sistema permite una comunicación bidireccional: recibe pasivamente eventos LPR de las cámaras a través de webhooks y, activamente, inicia la comunicación con las cámaras a través de su API ISAPI para tareas de gestión y sincronización.**

## 2. Características Clave y Módulos Principales

**La aplicación se estructura en torno a varios módulos de alta funcionalidad, accesibles a través de una interfaz unificada:**

* **Dashboard (**dashboard**):** **Pantalla de inicio que presenta métricas vitales del sistema en tiempo real:**

  * **Total de vehículos registrados.**
  * **Total de propietarios.**
  * **Total de lotes.**
  * **Ocupación actual (vehículos dentro del recinto).**
* **Consola de Eventos en Vivo (**live_events**):**

  * **Vista de Monitorización:** **Interfaz diseñada para pantallas de vigilancia, sin filtros ni distracciones.**
  * **Carruseles Dinámicos:** **Muestra la última captura general, así como las últimas capturas específicas de las cámaras de "Entrada" y "Salida".**
  * **Actualización Automática:** **El panel se refresca cada 2 segundos, obteniendo los últimos eventos del servidor sin necesidad de intervención del usuario.**
* **Gestión de Listas de Acceso (**access_lists**):**

  * **Interfaz Unificada por Pestañas:** **Centraliza la gestión de la** **Lista Blanca**, **Lista Negra** **y** **Proveedores**.
  * **Clasificación de Vehículos:** **Permite asignar cada matrícula a un tipo de lista, lo que determina su estado de acceso (**is_whitelisted**).**
  * **Sincronización con Cámaras:** **Permite añadir matrículas de la Lista Blanca no solo a la base de datos local, sino también a la memoria interna de las cámaras seleccionadas a través de la API.**
  * **Gestión con FAB (Botón de Acción Flotante):** **Las acciones principales (Añadir, Buscar/Filtrar) se realizan a través de un FAB para una interfaz más limpia.**
* **Gestión de Dispositivos LPR (**dispositivos_lpr**):**

  * **Panel de Control de Hardware:** **Permite configurar todas las cámaras, definiendo su IP pública para acceso API, MAC Address para identificación por webhook y credenciales.**
  * **Monitor de Estado en Tiempo Real:** **Cada dispositivo en la lista muestra un "LED" de estado (verde/rojo) que indica si la cámara está en línea y si la API es accesible. El estado se actualiza periódicamente.**
  * **Auditoría de Lista Blanca Remota:** **Herramienta para leer la lista blanca directamente desde la memoria de cualquier cámara, implementando un sistema de** **paginación** **para manejar grandes volúmenes de registros. Los datos se cruzan con la base de datos local para mostrar qué matrículas están registradas en el sistema.**
  * **Sincronización (Importación desde Cámara):** **Permite importar a la base de datos local las matrículas que existen en la cámara pero no en el sistema.**
* **Historial de Eventos (**event_history**):**

  * **Módulo de Búsqueda Avanzada:** **Permite consultar el histórico de todos los eventos LPR.**
  * **Filtros Múltiples:** **Se puede filtrar por matrícula, nombre del propietario, lote, tipo de cámara (entrada/salida) y rango de fechas.**
  * **Interfaz Limpia con FAB:** **Los filtros se encuentran dentro de un modal accesible a través de un FAB, manteniendo la tabla de resultados como elemento principal.**

## 3. Arquitectura y Flujo de Datos

**(Esta sección se mantiene similar a la anterior, ya que describe correctamente el flujo general)**
...

## 4. Integración Detallada con la API ISAPI de Hikvision

**(Esta sección también es crucial y se mantiene, ya que documenta el núcleo de la integración remota)**
...

## 5. Guía de Archivos y Scripts

**El proyecto está organizado con una clara separación entre la interfaz, la lógica de negocio y los endpoints de la API.**

#### Archivos Principales

* **index.php**: Actúa como el controlador frontal y router principal. Carga el header, footer, y el módulo de la página solicitada. Incluye el JavaScript global (reloj, controlador de FAB).
* **config.php**: Archivo de configuración central. Define constantes de la base de datos, la zona horaria e inicializa las sesiones y funciones de seguridad (CSRF).
* **style.css**: Hoja de estilos única y completa que define el tema visual de toda la aplicación.
* **webhook.php**: Endpoint dedicado a la recepción de eventos de las cámaras.

#### Módulos de Interfaz (Cargados por **index.php**)

* **live_console.html**: La vista de monitorización en tiempo real.
* **manage_access_lists.php**: El módulo unificado para la gestión de listas (Blanca, Negra, etc.).
* **dispositivos_lpr.php**: El panel de control para la configuración y auditoría de cámaras.
* **event_history.php**: El módulo para la búsqueda en el historial de eventos.
* **(Otros módulos como** **manage_owners_vehicles.php**, **manage_lots.php**, etc.)

#### Endpoints de API y Helpers

* **api_helpers.php**: Librería de funciones críticas para la comunicación con la API ISAPI. Contiene **getWhitelistFromCamera()**, que incluye la lógica de paginación.
* **get_live_data.php**: Provee el stream de datos JSON para la consola en vivo.
* **check_devices_status.php**: Endpoint llamado por AJAX para comprobar el estado de conexión de todas las cámaras y alimentar los LEDs.
* **get_camera_whitelist.php**: Endpoint para leer la lista blanca de una cámara específica y enriquecerla con datos locales.
* **sync_camera_whitelist.php**: Endpoint que realiza la sincronización (importación) de la lista de una cámara a la base de datos local.

## 6. Estructura de la Base de Datos

**El esquema de MySQL se ha expandido para soportar las nuevas funcionalidades.**

* **vehicles**:

  * **list_type** **(VARCHAR): Columna clave para la gestión unificada. Almacena** **'whitelist'**, **'blacklist'**, o **'supplier'**.
* **is_whitelisted** **(TINYINT): Un campo derivado que se establece en** **1** **si** **list_type** **es** **'whitelist'**. Se mantiene para optimizar las decisiones de acceso rápidas en el webhook.
* **El resto de las tablas (**devices**,** **events**, **owners**, etc.) se mantienen como en la documentación anterior, formando la base relacional del sistema.