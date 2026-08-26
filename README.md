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
