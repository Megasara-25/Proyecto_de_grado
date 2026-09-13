import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Admin ({perfil, cerrarSesion}) {
    const [solicitudes, setSolicitudes] = useState([])
    const [mensaje, setMensaje] = useState ('')
    const [cargando, setCargando] = useState (false)

    const cargarSolicitudes = async () => {
        setCargando(true)
        setMensaje('')

        const {data, error} = await supabase.rpc(
            'obtener_solicitudes_pendientes'
        )

        if(error){
            console.error('Error al cargar solicitudes:', error)

            setMensaje('No fue posible cargar las solicitudes')

            setCargando(false)
            return
        }

        setSolicitudes(data || [])
        setCargando(false)

        console.log('Solicitudes pendientes', data)
    }

    const gestionarSolicitud = async (
        tipo, 
        solicitudId,
        nuevoEstado
    ) => {
        setMensaje('')

        const{data, error} = await supabase.rpc(
            'gestionar_solicitud_ecocycle',

            {
                p_tipo: tipo, 
                p_solicitud_id: solicitudId,
                p_estado: nuevoEstado
            }
        )

        if(error){
            console.error('Error al gestionar solicitud:', error)
            setMensaje('No fue posible actualizar la solicitud')

            return
        }

        if(!data){
            setMensaje('La solicitud ya no estaba pendiente')

            await cargarSolicitudes()
            return
        }

        if(nuevoEstado === 'Aprobado'){
            setMensaje('Solicitud aprobada correctamente')
        }

        if (nuevoEstado === 'Rechazado'){
            setMensaje('Solicitud rechazada correctamente')
        }

        await cargarSolicitudes()
    }

    useEffect(() => {
        cargarSolicitudes()
    }, [])

    return (
        <div className="contenedor">
            <div className="tarjeta">
                <h1>EcoCycle</h1>

                <h2>Panel de administracion</h2>

                <p>
                    Bienvenido, <strong>{perfil.nombre}</strong>
                </p>

                <p>
                    Desde este panel puedes revisar
                    las solicitudes de recicladores 
                    y comercios aliados
                </p>

                {mensaje && (
                    <p>
                        <strong>{mensaje}</strong>
                    </p>
                )}

                <h2>Solicitudes pendientes</h2>

                {cargando &&(
                    <p>
                        Cargando solcitudes...
                    </p>
                )}

                {!cargando && solicitudes.length === 0 &&(
                    <p>
                        No hay solicitudes pendientes
                    </p>
                )}

                {solicitudes.map((solicitud) => (
                    <div key={`${solicitud.tipo}-${solicitud.solicitud_id}`}>
                        <h3>
                            {solicitud.tipo === 'reciclador'
                            ? 'Reciclador'
                            : 'Comercio aliado'}
                        </h3>

                        <p>
                            Responsable:{' '}
                            <strong>
                                {solicitud.nombre}
                            </strong>
                        </p>

                        <p>
                            Correo: {solicitud.correo}
                        </p>

                        <p>
                            Nombre:{' '}
                            <strong>
                                {solicitud.nombre_entidad}
                            </strong>
                        </p>

                        <p>
                            Direccion: {solicitud.direccion}
                        </p>

                        <p>
                            Ciudad: {solicitud.ciudad}
                        </p>

                        <p>
                            Estado:{' '}
                            <strong>
                                {solicitud.estado_validacion}
                            </strong>
                        </p>

                        <button onClick={() => gestionarSolicitud(
                            solicitud.tipo,
                            solicitud.solicitud_id, 'Aprobado'
                        )}>
                            Aprobar
                        </button>

                        <button onClick={() => gestionarSolicitud(
                            solicitud.tipo,
                            solicitud.solicitud_id, 'Rechazado'
                        )}>
                            Rechazar
                        </button>
                    </div>
                ))}

                <button onClick={cerrarSesion}>
                    Cerrar sesion
                </button>
            </div>
        </div>
    )
}

export default Admin