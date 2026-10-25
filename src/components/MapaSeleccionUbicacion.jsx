import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const ICONO_CENTRO = L.divIcon({
  className: 'ecocycle-marcador-centro',
  html: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 2C8.7 2 2 8.7 2 17c0 11 15 25 15 25s15-14 15-25C32 8.7 25.3 2 17 2z" fill="#34B05A" stroke="#ffffff" stroke-width="2.5"/><circle cx="17" cy="17" r="6" fill="#ffffff"/></svg>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  popupAnchor: [0, -38],
});

function ControlMapa({ ubicacion, onClickMapa }) {
  const mapa = useMap();
  useMapEvents({
    click(evento) {
      onClickMapa({ latitud: evento.latlng.lat, longitud: evento.latlng.lng });
    }
  });
  useEffect(() => {
    if (ubicacion) mapa.setView([ubicacion.latitud, ubicacion.longitud], 17);
  }, [mapa, ubicacion]);
  return null;
}

function normalizarDireccion(dir) {
  return dir.replace(/#/g, '').replace(/\s{2,}/g, ' ').trim();
}

const TIPOS_CIUDAD = ['city', 'town', 'village', 'municipality', 'administrative', 'county', 'state'];

function mensajeErrorUbicacion(error) {
  if (error?.code === 1) return 'Permiso de ubicacion denegado. Puedes buscar la direccion o colocar el marcador manualmente.';
  if (error?.code === 2) return 'No se pudo determinar tu ubicacion. Comprueba que el GPS este activado.';
  if (error?.code === 3) return 'Se agoto el tiempo de espera de la ubicacion. Intenta de nuevo.';
  return 'No fue posible obtener tu ubicacion. Puedes seleccionar el centro manualmente.';
}

export default function MapaSeleccionUbicacion({ onSeleccionar, direccion = '', ciudad = '' }) {
  const [ubicacion, setUbicacion] = useState(null);
  const [confirmada, setConfirmada] = useState(false);
  const [soloUbicacionCiudad, setSoloUbicacionCiudad] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscandoGPS, setBuscandoGPS] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const direccionRef = useRef(direccion);
  const ciudadRef = useRef(ciudad);

  useEffect(() => {
    const cambioDireccion = direccion !== direccionRef.current;
    const cambioCiudad = ciudad !== ciudadRef.current;

    if ((cambioDireccion || cambioCiudad) && confirmada) {
      setConfirmada(false);
      onSeleccionar(null);
      setMensaje('La direccion o ciudad cambio. Vuelve a buscar y confirma la ubicacion.');
    }
    direccionRef.current = direccion;
    ciudadRef.current = ciudad;
  }, [direccion, ciudad, confirmada, onSeleccionar]);

  function actualizarUbicacion(nuevaUbicacion, texto) {
    setUbicacion(nuevaUbicacion);
    setConfirmada(false);
    setSoloUbicacionCiudad(false);
    onSeleccionar(null);
    setMensaje(texto);
  }

  function manejarClickMapa(nuevaUbicacion) {
    actualizarUbicacion(nuevaUbicacion, 'Marcador colocado. Pulsa "Confirmar ubicacion del centro" cuando estes conforme.');
  }

  function confirmarUbicacion() {

    if (!ubicacion || soloUbicacionCiudad) return;
    setConfirmada(true);
    onSeleccionar(ubicacion);
    setMensaje('Ubicacion confirmada y lista para guardar.');
  }


  function usarUbicacionActual() {
    if (!navigator.geolocation) {
      setMensaje('Este dispositivo no permite obtener la ubicacion. Seleccionala manualmente.');
      return;
    }
    setBuscandoGPS(true);
    setMensaje('Obteniendo tu ubicacion...');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actualizarUbicacion(
          { latitud: coords.latitude, longitud: coords.longitude },
          'Ubicacion aproximada obtenida. Verifica el marcador y confirma unicamente si coincide con la direccion real del centro.'
        );
        setBuscandoGPS(false);
      },
      (error) => {
        setMensaje(mensajeErrorUbicacion(error));
        setBuscandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  async function buscarDireccion() {

    if (!direccion.trim() || !ciudad.trim()) {
      setMensaje('Por favor, escribe la direccion y la ciudad antes de buscar.');
      return;
    }

    setBuscando(true);
    setMensaje('');
    setConfirmada(false);
    onSeleccionar(null);

    try {
      const direccionNormalizada = normalizarDireccion(direccion);
      const parametros = new URLSearchParams({

        q: `${direccionNormalizada}, ${ciudad}, Colombia`, format: 'json', limit: '1',
        countrycodes: 'co', addressdetails: '1',
      });
      const headers = { 'Accept-Language': 'es' };
      const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`, { headers });

      if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
      const resultados = await respuesta.json();

      if (resultados.length > 0) {
        const r = resultados[0];
        const esSoloCiudad = TIPOS_CIUDAD.includes(r.type) || r.class === 'place';
        const nuevaUbicacion =
        {
          latitud: Number(r.lat),
          longitud: Number(r.lon)
        };

        setUbicacion(nuevaUbicacion);
        setSoloUbicacionCiudad(esSoloCiudad);
        setMensaje(esSoloCiudad
          ? 'Solo encontramos la ciudad, no la direccion exacta. Pulsa sobre el mapa para colocar el marcador en el lugar correcto.'
          : 'Direccion encontrada. El resultado puede ser aproximado. Verifica el marcador y ajustalo pulsando el mapa si es necesario.');
        return;
      }

      const parametrosCiudad = new URLSearchParams({
        q: `${ciudad}, Colombia`, format: 'json', limit: '1', countrycodes: 'co',
      });
      const respuestaCiudad = await fetch(`https://nominatim.openstreetmap.org/search?${parametrosCiudad}`, { headers });

      if (!respuestaCiudad.ok) throw new Error(`Error HTTP ${respuestaCiudad.status}`);
      const resultadosCiudad = await respuestaCiudad.json();

      if (resultadosCiudad.length > 0) {
        const rc = resultadosCiudad[0];
        setSoloUbicacionCiudad(true);
        setUbicacion({ latitud: Number(rc.lat), longitud: Number(rc.lon) });
        setMensaje(`No encontramos la direccion exacta. El mapa se centró en ${ciudad}. Pulsa el mapa para indicar la ubicacion real del centro.`);
      } else {
        setMensaje('No encontramos esa direccion ni la ciudad. Selecciona la ubicacion manualmente en el mapa.');
      }
    } catch (error) {
      console.error('Error buscando direccion:', error);
      setMensaje('No se pudo consultar la direccion. Verifica tu conexion o selecciona la ubicacion directamente en el mapa.');
    } finally {
      setBuscando(false);
    }
  }

  const mostrarBotonConfirmar = ubicacion && !confirmada && !soloUbicacionCiudad;
  return (
    <div>
      <button
        type="button"
        className="ecocycle-mapa-buscar"
        onClick={buscarDireccion}
        disabled={buscando}
      >
        {buscando ? 'Buscando...' : 'Buscar direccion en el mapa'}
      </button>

      <button
        type="button"
        className="ecocycle-mapa-buscar"
        onClick={usarUbicacionActual}
        disabled={buscandoGPS}
        style={{ marginTop: 10 }}>
        {buscandoGPS ? 'Obteniendo ubicacion...' : 'Usar mi ubicacion actual'}
      </button>

      {mensaje && (
        <p
          role="status"
          style={{ marginTop: 8 }}>
          {mensaje}
        </p>
      )}

      <div style={{ marginTop: 12 }}>

        <MapContainer
          center={[4.6097, -74.0817]}
          zoom={12}
          style={{ height: '300px', width: '100%', borderRadius: '10px' }}>

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ControlMapa
            ubicacion={ubicacion}
            onClickMapa={manejarClickMapa}
          />
          {ubicacion && !soloUbicacionCiudad && (
            <Marker
              position={[ubicacion.latitud, ubicacion.longitud]}
              icon={ICONO_CENTRO} />
          )}

        </MapContainer>
      </div>

      {mostrarBotonConfirmar && (
        <button
          className="eco-boton-confirmar-ubicacion"
          type="button"
          onClick={confirmarUbicacion} style={{ marginTop: 10 }}>
          Confirmar ubicacion del centro
        </button>
      )}

      {ubicacion && confirmada && (
        <p
          style={{ marginTop: 8 }}>
          Ubicacion confirmada: {ubicacion.latitud.toFixed(6)}, {ubicacion.longitud.toFixed(6)}
        </p>
      )}
      {ubicacion && !confirmada && !soloUbicacionCiudad && (
        <p
          style={{ marginTop: 8, color: '#b45309' }}>
          Ubicacion pendiente de confirmacion.
        </p>
      )}
    </div>
  );
}
