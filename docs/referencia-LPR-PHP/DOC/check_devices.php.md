# Documentación de `check_devices.php`

## Descripción General

`check_devices.php` es un sencillo script de diagnóstico diseñado para verificar la conexión a la base de datos y listar los dispositivos (cámaras) registrados en la tabla `devices`. Su propósito principal es ofrecer una forma rápida de confirmar que la configuración de la base de datos es correcta y que se pueden recuperar datos de ella.

El script no realiza ninguna comprobación de estado de los dispositivos en la red; simplemente lee y muestra la información almacenada en la base de datos.

## Flujo de Operación

1.  **Configuración y Conexión:**
    *   Carga el archivo `config.php` para obtener las credenciales de la base de datos.
    *   Establece una conexión a la base de datos MySQL utilizando PDO.

2.  **Consulta a la Base de Datos:**
    *   Ejecuta una consulta `SELECT` para obtener el `id`, `name` (nombre) y la `ip` de todos los registros en la tabla `devices`.

3.  **Salida:**
    *   Muestra los resultados dentro de etiquetas `<pre>` para una visualización de texto preformateado.
    *   Si se encuentran dispositivos, los imprime en la pantalla usando `print_r()`.
    *   Si no se encuentra ningún dispositivo, muestra un mensaje indicándolo.
    *   Si ocurre un error durante la conexión o la consulta, captura la excepción y muestra el mensaje de error.

## Salida de Ejemplo

```
Listando dispositivos desde la base de datos...

Array
(
    [0] => Array
        (
            [id] => 1
            [name] => Camara Entrada
            [ip] => 192.168.1.100
        )

    [1] => Array
        (
            [id] => 2
            [name] => Camara Salida
            [ip] => 192.168.1.101
        )

)
```

## Dependencias

*   `config.php`: Para las credenciales de la base de datos.