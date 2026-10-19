import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';

function ControlMapa({ ubicacion, onClickMapa }) {
    const mapa = useMap();

    useMapEvents({
        click(evento) {
            onClickMapa({
                latitud: evento.latlng.lat,
                longitud: evento.latlng.lng,
            });
        },
    });

    useEffect(() => {
        if (ubicacion) {
            mapa.setView([ubicacion.latitud, ubicacion.longitud], 17);
        }
    }, [ubicacion]);

    return null;
}

function normalizarDireccion(dir) {
    return dir
        .replace(/#/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

const TIPOS_CIUDAD = [
    'city', 'town', 'village', 'municipality',
    'administrative', 'county', 'state',
];

export default function MapaSeleccionUbicacion({
    onSeleccionar,
    direccion = '',
    ciudad = '',
}) {
    const [ubicacion, setUbicacion] = useState(null);
    const [confirmada, setConfirmada] = useState(false);
    const [soloUbicacionCiudad, setSoloUbicacionCiudad] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const [mensaje, setMensaje] = useState('');

    const direccionRef = useRef(direccion);
    const ciudadRef = useRef(ciudad);


    useEffect(() => {
        const cambioDireccion = direccion !== direccionRef.current;
        const cambioCiudad = ciudad !== ciudadRef.current;

        if ((cambioDireccion || cambioCiudad) && confirmada) {
            setConfirmada(false);
            onSeleccionar(null);
            setMensaje('La dirección o ciudad cambió. Vuelve a buscar y confirma la ubicación.');
        }

        direccionRef.current = direccion;
        ciudadRef.current = ciudad;

    }, [direccion, ciudad, confirmada, onSeleccionar]);

    function manejarClickMapa(nuevaUbicacion) {
        setUbicacion(nuevaUbicacion);
        setConfirmada(false);
        setSoloUbicacionCiudad(false);
        onSeleccionar(null);
        setMensaje('Marcador colocado. Pulsa "Confirmar ubicación del centro" cuando estés conforme.');
    }

    function confirmarUbicacion() {
        setConfirmada(true);
        onSeleccionar(ubicacion);
        setMensaje(' Ubicación confirmada y lista para guardar.');
    }

    async function buscarDireccion() {
        if (!direccion.trim() || !ciudad.trim()) {
            setMensaje('Por favor, escribe la dirección y la ciudad antes de buscar.');
            return;
        }

        setBuscando(true);
        setMensaje('');
        setConfirmada(false);
        onSeleccionar(null);

        try {
            const direccionNormalizada = normalizarDireccion(direccion);
            const consultaCompleta = `${direccionNormalizada}, ${ciudad}, Colombia`;

            const parametros = new URLSearchParams({
                q: consultaCompleta,
                format: 'json',
                limit: '1',
                countrycodes: 'co',
                addressdetails: '1',
            });

            const HEADERS = {
                'Accept-Language': 'es',
            };

            const respuesta = await fetch(
                `https://nominatim.openstreetmap.org/search?${parametros}`,
                { headers: HEADERS }
            );

            if (!respuesta.ok) {
                throw new Error(`Error HTTP ${respuesta.status}`);
            }

            const resultados = await respuesta.json();

            if (resultados.length > 0) {
                const r = resultados[0];
                const esSoloCiudad =
                    TIPOS_CIUDAD.includes(r.type) || r.class === 'place';

                const nuevaUbicacion = {
                    latitud: Number(r.lat),
                    longitud: Number(r.lon),
                };

                if (esSoloCiudad) {

                    setSoloUbicacionCiudad(true);
                    setUbicacion(nuevaUbicacion);
                    setMensaje(
                        'Solo encontramos la ciudad, no la dirección exacta. ' +
                        'Haz clic en el mapa para colocar el marcador en el lugar correcto.'
                    );
                } else {

                    setUbicacion(nuevaUbicacion);
                    setSoloUbicacionCiudad(false);
                    setMensaje(
                        'Dirección encontrada. El resultado puede ser aproximado. ' +
                        'Verifica el marcador en el mapa y ajústalo si es necesario haciendo clic.'
                    );
                }
                return;
            }
            const parametrosCiudad = new URLSearchParams({
                q: `${ciudad}, Colombia`,
                format: 'json',
                limit: '1',
                countrycodes: 'co',
            });

            const respuestaCiudad = await fetch(
                `https://nominatim.openstreetmap.org/search?${parametrosCiudad}`,
                { headers: HEADERS }
            );

            const resultadosCiudad = await respuestaCiudad.json();

            if (resultadosCiudad.length > 0) {
                const rc = resultadosCiudad[0];
                setSoloUbicacionCiudad(true);
                setUbicacion({ latitud: Number(rc.lat), longitud: Number(rc.lon) });
                setMensaje(
                    'No encontramos la dirección exacta. El mapa se centró en ' +
                    ciudad + '. Haz clic en el mapa para colocar el marcador en la ' +
                    'ubicación real del centro de reciclaje.'
                );
            } else {
                setMensaje(
                    'No encontramos esa dirección ni la ciudad. ' +
                    'Haz clic en el mapa para colocar el marcador manualmente.'
                );
            }

        } catch (error) {
            console.error('Error buscando dirección:', error);
            setMensaje(
                'No se pudo consultar la dirección. ' +
                'Verifica tu conexión o selecciona la ubicación directamente en el mapa.'
            );
        } finally {
            setBuscando(false);
        }
    }

    const mostrarBotonConfirmar = ubicacion && !confirmada && !soloUbicacionCiudad;

    return (
        <div>
            { }
            <button
                type="button"
                className="ecocycle-mapa-buscar"
                onClick={buscarDireccion}
                disabled={buscando}
            >
                {buscando ? 'Buscando...' : 'Buscar dirección en el mapa'}
            </button>

            {mensaje && <p style={{ marginTop: '8px' }}>{mensaje}</p>}

            <div style={{ marginTop: '12px' }}>
                <MapContainer
                    center={[4.6097, -74.0817]}
                    zoom={12}
                    style={{
                        height: '300px',
                        width: '100%',
                        borderRadius: '10px',
                    }}
                >
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
                        />
                    )}
                </MapContainer>
            </div>

            {mostrarBotonConfirmar && (
                <button
                    className='eco-boton-confirmar-ubicacion'
                    type="button"
                    onClick={confirmarUbicacion}
                    style={{ marginTop: '10px' }}
                >
                    Confirmar ubicacion del centro
                </button>
            )}

            {ubicacion && confirmada && (
                <p style={{ marginTop: '8px' }}>
                    Ubicacion confirmada: {ubicacion.latitud.toFixed(6)},{' '}
                    {ubicacion.longitud.toFixed(6)}
                </p>
            )}

            {ubicacion && !confirmada && !soloUbicacionCiudad && (
                <p style={{ marginTop: '8px', color: '#b45309' }}>
                    Ubicacion pendiente de confirmacion.
                </p>
            )}
        </div>
    );
}
