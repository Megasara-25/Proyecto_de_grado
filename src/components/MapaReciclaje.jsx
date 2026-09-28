import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import 'leaflet/dist/leaflet.css'

function MapaReciclaje({recicladores = [], onSeleccionarCentro}) {
    const posicionInicial = [4.6268, -74.1573]
    const [ubicacionUsuario, setUbicacionUsuario] = useState(null)

    useEffect(() => {
        if(!window.navigator.geolocation){
            console.log('La geolocalizacion no esta disponible')
            return
        }

        window.navigator.geolocation.getCurrentPosition(
            (posicion) => {
                const latitud = posicion.coords.latitude
                const longitud = posicion.coords.longitude

                setUbicacionUsuario([ latitud, longitud])

                console.log('Ubicacion del ciudadano obtenida correctamente')
            },
            (error) => {
                console.log('No fue posible obtener la ubicacion:', error.message)
            }
        )
    }, [])

    return(
        <div>
            <MapContainer
            center={posicionInicial} zoom={14} style={{
                height: '400px',
                width: '100%'
            }}>

                <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
                />

                {ubicacionUsuario &&(
                    <Marker position={ubicacionUsuario}>
                        <Popup>
                            <strong>Tu ubicacion</strong>
                            <br />
                            Estas aqui
                        </Popup>
                    </Marker>
                )}

                {recicladores.map((item)=>{
                    const centro = item.reciclador

                    if(!centro || 
                        centro.latitud === null || 
                        centro.longitud === null ||
                        centro.latitud === undefined ||
                        centro.longitud === undefined 
                    ){
                        return null
                    }

                    const latitud = Number(centro.latitud)
                    const longitud = Number(centro.longitud)

                    if(Number.isNaN(latitud) || Number.isNaN(longitud)){
                        return null
                    }

                    return (
                        <Marker
                            key={centro.id}
                            position={[latitud, longitud]}
                        >
                            <Popup>
                                <strong>{centro.nombre_centro}</strong>
                                <br/>
                                {centro.direccion}
                                <br/>
                                {centro.ciudad}
                                <br />
                                <br />

                                <button type="button" onClick={() => onSeleccionarCentro(centro)}>
                                    Seleccionar este centro
                                </button>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}

export default MapaReciclaje