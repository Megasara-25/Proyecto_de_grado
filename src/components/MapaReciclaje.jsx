import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const POSICION_INICIAL = [4.6268, -74.1573]

const ICONO_USUARIO = L.divIcon({
  className: 'eco-mapa-icono',
  html: '<div class="eco-mapa-usuario-aro"><span class="eco-mapa-usuario-punto"></span></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22]
})

const ICONO_RECICLADOR = L.divIcon({
  className: 'eco-mapa-icono',
  html: '<div class="eco-mapa-punto-reciclaje" aria-hidden="true">♻</div>',
  iconSize: [37, 37],
  iconAnchor: [18, 18]
})

function CentrarMapa({ posicion, solicitud }) {
  const mapa = useMap()
  useEffect(() => {
    if (posicion) {
      mapa.flyTo(posicion, 15, { duration: 0.6 })
    }
  }, [mapa, posicion, solicitud])
  return null
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const diferenciaLatitud = (lat2 - lat1) * rad
  const diferenciaLongitud = (lon2 - lon1) * rad
  const a = Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(diferenciaLongitud / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function mensajeErrorUbicacion(error) {
  if (error?.code === 1) return 'No autorizaste la ubicacion. Puedes explorar el mapa manualmente'
  if (error?.code === 2) return 'No pudimos deerninar tu ubicacion. Revisa si el GPS esta activado'
  if (error?.code === 3) return 'La ubicacion tardo demasiado. Intenta nuevamente'
  return 'No pudimos obtener tu ubicacion. Puedes explorar el mapa manalmente'
}

function nombrePunto(centro) {
  return typeof centro?.nombre_centro === 'string' && centro.nombre_centro.trim()
    ? centro.nombre_centro.trim()
    : 'Punto de reciclaje'
}

export default function MapaReciclaje({ recicladores = [], onSeleccionarCentro }) {
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null)
  const [consultandoUbicacion, setConsultandoUbicacion] = useState(false)
  const [mensajeUbicacion, setMensajeUbicacion] = useState('')
  const [errorUbicacion, setErrorUbicacion] = useState(false)
  const [solicitudCentrado, setSolicitudCentrado] = useState(0)
  const [idSeleccionado, setIdSeleccionado] = useState(null)

  function solicitarUbicacion() {
    if (!navigator.geolocation) {
      setErrorUbicacion(true)
      setMensajeUbicacion('Tu dispositivo no ofrece geolocalizacion. Puedes explorar el mapa manualmente')
      return
    }
    setConsultandoUbicacion(true)
    setErrorUbicacion(false)
    setMensajeUbicacion('Buscando tu ubicacion...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacionUsuario([coords.latitude, coords.longitude])
        setSolicitudCentrado((valor) => valor + 1)
        setMensajeUbicacion('Ubicacion encontrada. Estas identificado con el marcador azul')
        setConsultandoUbicacion(false)
      },
      (error) => {
        setErrorUbicacion(true)
        setMensajeUbicacion(mensajeErrorUbicacion(error))
        setConsultandoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    solicitarUbicacion()
  }, [])

  const puntosValidos = useMemo(() => recicladores
    .map((item) => {
      const centro = item?.reciclador
      if (!centro || centro.latitud == null || centro.longitud == null) return null
      const latitud = Number(centro.latitud)
      const longitud = Number(centro.longitud)
      if (!Number.isFinite(latitud) || !Number.isFinite(longitud) ||
          Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null
      return { ...centro, latitud, longitud }
    })
    .filter(Boolean), [recicladores])

  const seleccionado = puntosValidos.find((centro) => centro.id === idSeleccionado)
  const distancia = seleccionado && ubicacionUsuario
    ? calcularDistancia(ubicacionUsuario[0], ubicacionUsuario[1], seleccionado.latitud, seleccionado.longitud)
    : null

  const verRuta = seleccionado
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${seleccionado.latitud},${seleccionado.longitud}`)}`
    : null

  function reciclarAqui() {
    if (!seleccionado) return
    onSeleccionarCentro?.({ ...seleccionado, distancia })
  }

  return (
    <section className="eco-mapa" aria-label="Mapa de puntos de reciclaje">
      <header className="eco-mapa-header">
        <h2>Puntos de reciclaje</h2>
        <p>Encuentra donde entregar tus materiales reciclables</p>
      </header>

      <div className="eco-mapa-explicacion">
        <span className="eco-mapa-explicacion-icono" aria-hidden="true"></span>
        <p>
          <strong>¿Como identificar los puntos?</strong>
          Tu ubicacion aparece en azul y loscentros de recoleccion en verde
        </p>
      </div>

      <div className="eco-mapa-toolbar">
        <span className="eco-mapa-recuento">
          {puntosValidos.length} {puntosValidos.length === 1 ? 'punto disponible' : 'puntos disponibles'}
        </span>
        <button
          className="eco-mapa-centrar"
          type="button"
          disabled={consultandoUbicacion}
          onClick={() => {
            if (ubicacionUsuario) setSolicitudCentrado((valor) => valor + 1)
            else solicitarUbicacion()
          }}
        >
          {consultandoUbicacion ? 'Buscando...' : 'Mi ubicacion'}
        </button>
      </div>

      <div className="eco-mapa-marco">
        <MapContainer center={POSICION_INICIAL} zoom={14} scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <CentrarMapa posicion={ubicacionUsuario} solicitud={solicitudCentrado} />
          {ubicacionUsuario && (
            <Marker position={ubicacionUsuario} icon={ICONO_USUARIO}>
              <Tooltip permanent direction="top" offset={[0, -17]} className="eco-mapa-tooltip-usuario">
                Tu estas aqui
              </Tooltip>
            </Marker>
          )}
          {puntosValidos.map((centro) => (
            <Marker
              key={centro.id ?? `${centro.latitud}-${centro.longitud}`}
              position={[centro.latitud, centro.longitud]}
              icon={ICONO_RECICLADOR}
              eventHandlers={{ click: () => setIdSeleccionado(centro.id) }}
            >
              <Tooltip direction="top" offset={[0, -15]}>{nombrePunto(centro)}</Tooltip>
            </Marker>
          ))}
        </MapContainer>
        <div className="eco-mapa-leyenda" aria-label="Leyenda del mapa">
          <span><i className="eco-mapa-leyenda-azul" /> Tu ubicacion</span>
          <span><i className="eco-mapa-leyenda-verde">♻</i> Punto de reciclaje</span>
        </div>
      </div>

      {mensajeUbicacion && (
        <p className="eco-mapa-estado" role={errorUbicacion ? 'alert' : 'status'}>
          {mensajeUbicacion}
        </p>
      )}

      {seleccionado ? (
        <article className="eco-mapa-detalle">
          <div className="eco-mapa-detalle-cabecera">
            <div>
              <span className="eco-mapa-detalle-tipo">Punto de recoleccion</span>
              <h3>{nombrePunto(seleccionado)}</h3>
            </div>
            <button className="eco-mapa-cerrar" type="button" aria-label="Cerrar detalle" onClick={() => setIdSeleccionado(null)}>×</button>
          </div>
          <div className="eco-mapa-datos">
            {seleccionado.direccion && <p> {seleccionado.direccion}</p>}
            {seleccionado.ciudad && <p>Ciudad: {seleccionado.ciudad}</p>}
            {distancia !== null && <p>{distancia.toFixed(2)} km en linea recta, aproximadamente</p>}
          </div>
          <div className="eco-mapa-acciones">
            <a className="eco-mapa-ruta" href={verRuta} target="_blank" rel="noopener noreferrer">Ver ruta</a>
            <button className="eco-mapa-reciclar" type="button" disabled={!onSeleccionarCentro} onClick={reciclarAqui}> Reciclar aqui</button>
          </div>
        </article>
      ) : (
        <div className="eco-mapa-instruccion">Selecciona un marcador verde para ver la informacon del reciclador</div>
      )}
    </section>
  )
}
