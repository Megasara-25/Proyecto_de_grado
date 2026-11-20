# EcoCycle

EcoCycle es un proyecto de grado de la Uniagustiniana que busca incentivar el reciclaje en conjuntos residenciales del barrio Castilla, en Bogotá. La aplicación conecta a ciudadanos, recicladores y comercios aliados mediante un sistema de puntos y recompensas.

El ciudadano selecciona los materiales que quiere entregar y consulta en el mapa qué centros reciben todos los materiales elegidos. El reciclador revisa la entrega y, si la aprueba, se acreditan los EcoPuntos. Luego el ciudadano puede canjearlos por beneficios en los comercios aliados.

Cada canje se confirma en el comercio con un código de seis dígitos, de un solo uso y con una vigencia de tres minutos. Los puntos se descuentan al confirmar el canje. El ciudadano puede consultar sus entregas y canjes, y el comercio puede gestionar sus recompensas y ver cuáles se han canjeado más.

## Instalar EcoCycle en Android

Necesitas un celular con Android 7.0 o posterior y conexión a internet para iniciar sesión, consultar el mapa y sincronizar los datos.

1. Descarga [EcoCycle.apk](https://github.com/Megasara-25/Proyecto_de_grado/releases/download/v1.0.0-sustentacion/EcoCycle.apk) en el celular.
2. Abre el archivo desde **Descargas**.
3. Si Android te pide permiso, autoriza la instalación desde el navegador o gestor de archivos con el que abriste el APK.
4. Pulsa **Instalar** y abre EcoCycle.

El APK es para Android. Desde un iPhone o un computador puedes visitar la [página del proyecto](https://megasara-25.github.io/Landig-Ecocycle/).

## Ejecutar EcoCycle en un computador

Para ejecutar la aplicación desde el código fuente en Windows, macOS o Linux, necesitas Git, Node.js 22.12 o una versión más reciente de la rama 22, npm y un proyecto de Supabase con el esquema y las migraciones de EcoCycle aplicados.

1. Clona el repositorio e instala las dependencias.

   ```bash
   git clone https://github.com/Megasara-25/Proyecto_de_grado.git
   cd Proyecto_de_grado
   git switch feature/landing-responsive-animaciones
   npm ci
   ```

2. Crea un archivo `.env.local` en la raíz del proyecto con la URL y la clave pública `anon` de tu instancia de Supabase. Mantén la clave `service_role` en el servidor.

   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_publica_anon
   ```

3. Inicia la aplicación.

   ```bash
   npm run dev
   ```

4. Abre en el navegador la dirección que aparece en la terminal, normalmente `http://localhost:5173`.

## Compilar el APK

Para generar el APK desde el código necesitas Android Studio compatible con Capacitor 8 y el SDK de Android 36. Después de configurar el proyecto como se indica arriba, ejecuta estos comandos desde la raíz del repositorio.

```bash
npm run build
npx cap sync android
npx cap open android
```

En Android Studio, ejecuta la tarea de Gradle `:app:assembleDebug`. El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Tecnologías

EcoCycle usa React y JavaScript para la interfaz, Vite para el entorno de desarrollo y Capacitor para la versión Android. Supabase gestiona la autenticación, la base de datos PostgreSQL y las actualizaciones en tiempo real. El mapa usa Leaflet con OpenStreetMap y permite abrir las indicaciones en Google Maps.
