# YT-DLP Web

Interfaz web local para descargar un video de YouTube en la máxima calidad disponible y combinar video + audio en MP4.

## Requisitos

- Node.js 18 o posterior
- `yt-dlp`
- `ffmpeg`

## Uso

```bash
npm start
```

Abre <http://localhost:4173> en el navegador.

### Videos que requieren autenticación

Si YouTube solicita iniciar sesión o comprobar que no eres un bot, cierra por completo el navegador y ejecuta la aplicación indicando de cuál debe leer las cookies:

```bash
YTDLP_COOKIES_BROWSER=chrome npm start
```

También puedes usar `safari` o `firefox`. El tiempo máximo sin respuesta de `yt-dlp` es de dos minutos y se puede cambiar, por ejemplo:

```bash
YTDLP_TIMEOUT_MS=300000 npm start
```

Los archivos generados se guardan también en `downloads/`. Usa la herramienta únicamente con contenido propio o que tengas autorización para descargar.

Durante cada descarga, la interfaz muestra un registro detallado de la salida de `yt-dlp`. Se conservan las 300 entradas más recientes del trabajo actual; el historial se reinicia al reiniciar el servidor.

Al finalizar un trabajo, el servidor elimina automáticamente sus segmentos `.part`, metadatos `.ytdl` y archivos intermedios. Si la descarga termina correctamente, conserva únicamente el MP4 final.

La aplicación registra el ID único de cada video en `downloads/.download-index.json`. Si se ingresa nuevamente el mismo video mediante otra variante de su URL, reutiliza el MP4 existente en vez de descargarlo otra vez. Si el archivo se elimina manualmente, el índice se corrige en la siguiente consulta.

## Uso responsable y aviso legal

Esta herramienta se proporciona exclusivamente para usos legítimos, incluyendo la descarga de contenido propio, autorizado, de dominio público, publicado bajo una licencia compatible o cuya descarga esté permitida por la legislación aplicable.

El usuario asume exclusivamente la responsabilidad de:

- verificar que posee los derechos, licencias o autorizaciones necesarios;
- cumplir las leyes de propiedad intelectual y demás normas aplicables;
- respetar los términos de servicio de las plataformas de origen; y
- obtener los permisos necesarios antes de descargar, copiar, almacenar, modificar, compartir o distribuir cualquier contenido.

Los autores y colaboradores no autorizan, fomentan ni promueven la infracción de derechos de autor, la evasión de controles de acceso ni la distribución no autorizada de contenido.

En la máxima medida permitida por la legislación aplicable, el software se proporciona **“tal cual”** y **“según disponibilidad”**, sin garantías expresas o implícitas. Los autores y colaboradores no serán responsables por pérdidas, daños, reclamaciones, sanciones, suspensión de cuentas, pérdida de datos ni otras consecuencias derivadas del uso o de la imposibilidad de uso del software.

El usuario acepta mantener indemnes a los autores y colaboradores frente a reclamaciones de terceros derivadas de una utilización ilícita o no autorizada de la herramienta, en la medida permitida por la legislación aplicable.

Este proyecto es independiente y no está afiliado, patrocinado, autorizado ni respaldado por YouTube, Google ni por los titulares del contenido descargado. Las marcas y nombres comerciales pertenecen a sus respectivos propietarios.

Este aviso no constituye asesoría jurídica ni reemplaza la consulta con un profesional competente.

## Privacidad y cookies

La opción `YTDLP_COOKIES_BROWSER` permite que `yt-dlp` acceda localmente a cookies del navegador. Estas pueden contener información sensible de sesión. No deben compartirse, publicarse, registrarse ni incorporarse al repositorio. El usuario es responsable de protegerlas y de contar con autorización para usar la cuenta asociada.

La aplicación escucha únicamente en `127.0.0.1` de forma predeterminada y está diseñada para uso local. Exponerla a una red o a Internet requiere medidas adicionales de autenticación, autorización, cifrado, limitación de solicitudes y revisión legal.

## Licencia

El código propio de este proyecto se distribuye bajo la [Licencia MIT](LICENSE). `yt-dlp`, FFmpeg y cualquier otra dependencia conservan sus respectivas licencias y condiciones.
