import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Admin ({perfil, cerrarSesion}) {
    const [solicitudes, setSolicitudes] = useState([])
    const [mensaje, setMensaje] = useState ('')
    const [cargando, setCargando] = useState (false)
    const [solicitudProcesando, setSolicitudProcesando] = useState(null)

    const cargarSolicitudes = async () => {
        setCargando(true)

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
        if(solicitudProcesando !== null) return

        const claveSolicitud = `${tipo}-${solicitudId}`

        setSolicitudProcesando(claveSolicitud)
        setMensaje('')

        try{
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
                await cargarSolicitudes()
                setMensaje('La solicitud ya no estaba pendiente')
                return
            }

            await cargarSolicitudes()

            setMensaje(
                nuevoEstado === 'Aprobado'
                ? 'Solicitud aprobada correctamente'
                : 'Solicitud rechazada correctamente'
            )
        } catch (error){
            console.error('Error inesperado:', error)
            setMensaje('Ocurrio un error al porcesar la solicitud')
        }finally {
            setSolicitudProcesando(null)
        }
    }

    useEffect(() => {
        cargarSolicitudes()
    }, [])

    return (
        <div className="admin-pagina">
            <div className="admin-panel">

                <header className="admin-header">
                    <div>
                        <h1>EcoCycle</h1>

                        <h2>Panel de administracion</h2>
                    </div>

                    <button 
                        className="admin-boton-salir"
                        onClick={cerrarSesion}
                    >
                        Cerrar sesion
                    </button>
                </header>

                <section className="admin-bienvenida">
                    <h2>Bienvenida, {perfil.nombre}</h2>

                    <p>
                        Desde aqui puedes revisar y gestionar 
                        las solicitudes de recicladores y comercio aliados
                    </p>
                </section>

                {mensaje && (
                    <p>
                        <strong>{mensaje}</strong>
                    </p>
                )}

                <section className="admin-estadisticas">
                    <div className="admin-estadistica-card">
                        <h2>Solicitudes pendientes</h2>
                        <h2>{solicitudes.length}</h2>
                        <span>por revisar</span>
                    </div>

                    <div className="admin-estadistica-card">
                        <p>Recicladores pendientes</p>
                        <h2>
                            {solicitudes.filter(
                                solicitud => solicitud.tipo === 'reciclador'
                            ).length}
                        </h2>
                        <span>Esperando aprobacion</span>
                    </div>

                    <div className="admin-estadistica-card">
                        <p>Comercio pendientes</p>
                        <h2>
                            {solicitudes.filter(
                                solicitud => solicitud.tipo === 'comercio_aliado'
                            ).length}
                        </h2>
                        <span>Esperando aprobacion</span>
                    </div>
                </section>

                {cargando &&(
                    <p>
                        Cargando solcitudes...
                    </p>
                )}

                {!cargando && solicitudes.length === 0 &&(
                    <div className="admin-sin-solicitudes">
                        <h3>Todo al dia</h3>
                        <p>
                            No hay solicitudes pendientes de aprobacion.
                            Cuando se registre un reciclador o comerci aliado, 
                            aparecera aqui.
                        </p>
                    </div>
                )}

                {solicitudes.map((solicitud) => (
                    <div
                        className="admin-solicitudes-card" 
                        key={`${solicitud.tipo}-${solicitud.solicitud_id}`}
                    >
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

                        <button
                            className="admin-boton-aprobar"
                            disabled={solicitudProcesando !== null}
                            onClick={()=> gestionarSolicitud(
                                solicitud.tipo,
                                solicitud.solicitud_id,
                                'Aprobado'
                            )}
                        >
                            {solicitudProcesando === `${solicitud.tipo}-${solicitud.solicitud_id}`
                            ?'Procesando...'
                            :'Aprobar'}
                        </button>

                        <button 
                            className="admin-boton-rechazar"
                            disabled={solicitudProcesando !== null}
                            onClick={()=> gestionarSolicitud(
                                solicitud.tipo,
                                solicitud.solicitud_id,
                                'Rechazado'
                            )}
                        >
                            {solicitudProcesando === `${solicitud.tipo}-${solicitud.solicitud_id}`
                            ?'Procesando...'
                            :'Rechazar'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Admin