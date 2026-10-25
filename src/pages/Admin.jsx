import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

const OPCIONES = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'solicitudes', nombre: 'Solicitudes' },
  { id: 'perfil', nombre: 'Perfil' }
]

function Admin({ perfil, cerrarSesion }) {
  const [pestana, setPestana] = useState('inicio')
  const [solicitudes, setSolicitudes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [solicitudProcesando, setSolicitudProcesando] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [datosPerfil, setDatosPerfil] = useState(null)
  const [fotoFirmada, setFotoFirmada] = useState('')
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [telefonoEdicion, setTelefonoEdicion] = useState('')
  const [fotoNueva, setFotoNueva] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState('')
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState('')

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true)

    try {
      const { data, error } = await supabase.rpc('obtener_solicitudes_pendientes')
      if (error) throw error
      setSolicitudes(data || [])
    } catch (error) {
      console.error('Error al cargar solicitudes:', error)
      setMensaje('No fue posible cargar las solicitudes')
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarPerfil = useCallback(async () => {

    if (!perfil?.id) return
    const { data, error } = await supabase
      .from('usuario')
      .select('nombre, correo, telefono, fecha_nacimiento, foto_perfil_url')
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Error al consultar perfil:', error)
      setMensajePerfil('No fue posible consultar los datos del perfil')
      return
    }
    setDatosPerfil(data)
    setNombreEdicion(data.nombre || '')
    setTelefonoEdicion(data.telefono || '')

    if (!data.foto_perfil_url) {
      setFotoFirmada('')
      return
    }
    let ruta = data.foto_perfil_url

    if (ruta.includes('/storage/v1/object/')) {
      const marcador = '/foto-perfil/'
      const posicion = ruta.indexOf(marcador)

      if (posicion < 0) {
        setFotoFirmada('')
        return
      }
      ruta = decodeURIComponent(ruta.slice(posicion + marcador.length).split('?')[0])
    }
    const { data: firma, error: errorFirma } = await supabase.storage
      .from('foto-perfil')
      .createSignedUrl(ruta, 3600)

    if (errorFirma) {
      console.error('Error al obtener foto privada:', errorFirma)
      setFotoFirmada('')
      return
    }
    setFotoFirmada(firma?.signedUrl || '')
  }, [perfil?.id])

  useEffect(() => {
    cargarSolicitudes()
    cargarPerfil()
  }, [cargarSolicitudes, cargarPerfil])

  const gestionarSolicitud = async (tipo, solicitudId, nuevoEstado) => {

    if (solicitudProcesando !== null) return
    const clave = `${tipo}-${solicitudId}`
    const accion = nuevoEstado === 'Aprobado' ? 'aprobar' : 'rechazar'

    if (!window.confirm(`¿Confirmas que deseas ${accion} esta solicitud?`)) return
    setSolicitudProcesando(clave)
    setMensaje('')

    try {
      const { data, error } = await supabase.rpc('gestionar_solicitud_ecocycle', {
        p_tipo: tipo,
        p_solicitud_id: solicitudId,
        p_estado: nuevoEstado
      })

      if (error) throw error
      await cargarSolicitudes()

      setMensaje(!data
        ? 'La solicitud ya no estaba pendiente'
        : nuevoEstado === 'Aprobado'
          ? 'Solicitud aprobada correctamente'
          : 'Solicitud rechazada correctamente')
    } catch (error) {
      console.error('Error al gestionar solicitud:', error)
      setMensaje('No fue posible actualizar la solicitud')
    } finally {
      setSolicitudProcesando(null)
    }
  }

  const elegirFoto = (archivo) => {
    if (!archivo) return
    if (!['image/jpeg', 'image/png', 'image/jpeg'].includes(archivo.type)) {
      setMensajePerfil('Selecciona una fotografia JPG, PNG o JPEG')
      return
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setMensajePerfil('La fotografia no puede superar los 2 MB')
      return
    }
    const lector = new FileReader()

    lector.onload = () => {
      setFotoNueva(archivo)
      setVistaPrevia(String(lector.result))
      setMensajePerfil('')
    }
    lector.onerror = () => setMensajePerfil('No se pudo leer la fotografia')
    lector.readAsDataURL(archivo)
  }

  const cancelarEdicion = () => {
    setEditando(false)
    setNombreEdicion(datosPerfil?.nombre || perfil?.nombre || '')
    setTelefonoEdicion(datosPerfil?.telefono || '')
    setFotoNueva(null)
    setVistaPrevia('')
    setMensajePerfil('')
  }

  const guardarPerfil = async (evento) => {
    evento.preventDefault()

    if (guardando) return

    if (!nombreEdicion.trim()) {
      setMensajePerfil('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    setMensajePerfil('')
    let rutaNueva = null
    let guardadoConfirmado = false

    try {
      if (fotoNueva) {
        const extension = fotoNueva.type === 'image/png' ? 'png' : fotoNueva.type === 'image/jpeg' ? 'jpeg' : 'jpg'
        rutaNueva = `${perfil.id}/admin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`
        const { error: errorSubida } = await supabase.storage.from('foto-perfil').upload(rutaNueva, fotoNueva, {
          contentType: fotoNueva.type,
          upsert: false
        })

        if (errorSubida) throw errorSubida
      }

      const { data, error } = await supabase.rpc('actualizar_mi_perfil', {
        p_nombre: nombreEdicion.trim(),
        p_telefono: telefonoEdicion.trim() || null,
        p_fecha_nacimiento: datosPerfil?.fecha_nacimiento || null,
        p_foto_perfil_url: rutaNueva || datosPerfil?.foto_perfil_url || null
      })
      if (error) throw error

      if (data === false) throw new Error('No se confirmo la actualizacion')

      guardadoConfirmado = true
      setEditando(false)
      setFotoNueva(null)
      setVistaPrevia('')
      setDatosPerfil(actual => ({
        ...actual,
        nombre: nombreEdicion.trim(),
        telefono: telefonoEdicion.trim() || null,
        foto_perfil_url: rutaNueva || actual?.foto_perfil_url || null
      }))
      setMensajePerfil('Perfil actualizado correctamente')

      try {
        await cargarPerfil()
      } catch (errorFoto) {
        console.error('Error al recargar perfil:', errorFoto)
      }
    } catch (error) {
      console.error('Error al guardar perfil:', error)

      if (rutaNueva && !guardadoConfirmado) {
        const { error: errorLimpieza } = await supabase.storage.from('foto-perfil').remove([rutaNueva])
        if (errorLimpieza) console.error('Error al limpiar foto pendiente:', errorLimpieza)
      }

      setMensajePerfil(`No fue posible guardar el perfil: ${error.message || 'Error desconocido'}`)
    } finally {
      setGuardando(false)
    }
  }

  const recicladores = solicitudes.filter(s => s.tipo === 'reciclador').length
  const comercios = solicitudes.filter(s => s.tipo === 'comercio_aliado').length
  const visibles = solicitudes.filter(s => filtro === 'todos' || s.tipo === filtro)

  return (
    <div className="admin-pagina">
      <div className="admin-panel">
        <header className="admin-header">
          <div className="admin-marca">
            <img src={logoEcocycle} alt="Logo de EcoCycle" className="admin-logo" />
            <div>
              <h1>EcoCycle</h1>
              <p>Panel de administracion</p>
            </div>
          </div>
          <button
            className="admin-boton-salir"
            type="button"
            onClick={cerrarSesion}
          >
            Cerrar sesion
          </button>
        </header>

        <nav
          className="admin-navegacion"
          aria-label="Secciones del administrador"
        >
          {OPCIONES.map(opcion => (
            <button
              key={opcion.id}
              type="button"
              className={pestana === opcion.id ? 'activo' : ''}
              onClick={() => {
                setPestana(opcion.id);
                setMensaje('')
              }}
            >

              <span
                className="admin-nav-icono"
                aria-hidden="true">
                {opcion.icono}
              </span>
              {opcion.nombre}
            </button>
          ))}
        </nav>

        {mensaje &&
          <p
            className="admin-mensaje"
            role="status">
            {mensaje}
          </p>
        }

        {pestana === 'inicio' && (
          <>
            <section className="admin-bienvenida">
              <span className="admin-etiqueta">Administracion</span>
              <h2>Bienvenido,
                {datosPerfil?.nombre || perfil?.nombre || 'Administrador'}</h2>
              <p>Consulta las solicitudes de recicladores y comercios aliados que necesitan validacion</p>
              <button
                className="admin-boton-principal"
                type="button"
                onClick={() => setPestana('solicitudes')}
              >
                Revisar solicitudes
              </button>
            </section>
            <section
              className="admin-estadisticas"
              aria-label="Resumen de solicitudes pendientes"
            >
              <div className="admin-estadistica-card">
                <p>Solicitudes pendientes</p>
                <strong>{solicitudes.length}</strong>
                <span>Por revisar</span>
              </div>

              <div className="admin-estadistica-card">
                <p>Recicladores</p>
                <strong>{recicladores}</strong>
                <span>Esperando aprobacion</span>
              </div>

              <div className="admin-estadistica-card">
                <p>Comercios aliados</p>
                <strong>{comercios}</strong>
                <span>Esperando aprobacion</span>
              </div>
            </section>

            <div className="admin-acciones">
              <button
                type="button"
                className="admin-boton-secundario"
                disabled={cargando}
                onClick={cargarSolicitudes}
              >
                {cargando ? 'Actualizando...' : 'Actualizar resumen'}
              </button>
            </div>
          </>
        )}

        {pestana === 'solicitudes' && (
          <section className="admin-seccion">
            <div className="admin-seccion-encabezado">
              <div>
                <h2>Solicitudes pendientes</h2>
                <p>Revisa los datos antes de aprobar o rechazar</p>
              </div>

              <button
                type="button"
                className="admin-boton-secundario"
                onClick={cargarSolicitudes}
                disabled={cargando}>
                {cargando ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            <div className="admin-filtros" aria-label="Filtrar solicitudes">
              <button
                type="button"
                className={filtro === 'todos' ? 'activo' : ''}
                onClick={() => setFiltro('todos')}>
                Todas ({solicitudes.length})
              </button>

              <button
                type="button"
                className={filtro === 'reciclador' ? 'activo' : ''}
                onClick={() => setFiltro('reciclador')}>
                Recicladores ({recicladores})
              </button>

              <button
                type="button"
                className={filtro === 'comercio_aliado' ? 'activo' : ''}
                onClick={() => setFiltro('comercio_aliado')}>
                Comercios ({comercios})
              </button>
            </div>

            {cargando ?
              <p className="admin-vacio">Cargando solicitudes...</p> :
              visibles.length === 0 ? (
                <div className="admin-vacio">
                  <h3>Todo al dia</h3>
                  <p>No hay solicitudes pendientes en esta categoria</p>
                </div>
              ) : (
                <div className="admin-lista-solicitudes">
                  {visibles.map(solicitud => {
                    const clave = `${solicitud.tipo}-${solicitud.solicitud_id}`

                    return (
                      <article
                        className="admin-solicitudes-card"
                        key={clave}
                      >
                        <div className="admin-tarjeta-encabezado">

                          <h3>{solicitud.tipo === 'reciclador' ? 'Reciclador' : 'Comercio aliado'}</h3>
                          <span className="admin-estado">
                            {solicitud.estado_validacion || 'Pendiente'}
                          </span>
                        </div>
                        <dl className="admin-detalles">
                          <div><dt>Responsable</dt><dd>{solicitud.nombre || 'No registrado'}</dd></div>
                          <div><dt>Correo</dt><dd>{solicitud.correo || 'No registrado'}</dd></div>
                          <div><dt>Establecimiento / entidad</dt><dd>{solicitud.nombre_entidad || 'No registrado'}</dd></div>
                          <div><dt>Direccion</dt><dd>{solicitud.direccion || 'No registrada'}</dd></div>
                          <div><dt>Ciudad</dt><dd>{solicitud.ciudad || 'No registrada'}</dd></div>
                        </dl>

                        <div className="admin-tarjeta-acciones">
                          <button
                            type="button"
                            className="admin-boton-aprobar"
                            disabled={solicitudProcesando !== null}
                            onClick={() => gestionarSolicitud(solicitud.tipo, solicitud.solicitud_id, 'Aprobado')}>
                            {solicitudProcesando === clave ? 'Procesando...' : 'Aprobar'}
                          </button>

                          <button
                            type="button"
                            className="admin-boton-rechazar"
                            disabled={solicitudProcesando !== null}
                            onClick={() => gestionarSolicitud(solicitud.tipo, solicitud.solicitud_id, 'Rechazado')}>
                            {solicitudProcesando === clave ? 'Procesando...' : 'Rechazar'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
          </section>
        )}

        {pestana === 'perfil' && (
          <section className="admin-seccion admin-perfil">
            <h2>Mi perfil</h2>
            <p>Actualiza tus datos y tu fotografia de administrador.</p>
            <div className="admin-perfil-avatar">
              {vistaPrevia || fotoFirmada ?
                <img
                  src={vistaPrevia || fotoFirmada}
                  alt="Fotografía de perfil"
                /> :
                <span>{(datosPerfil?.nombre || perfil?.nombre || 'A').charAt(0).toUpperCase()}</span>}
            </div>

            {mensajePerfil &&
              <p
                className="admin-mensaje"
                role="status">{mensajePerfil}
              </p>}

            {editando ? (
              <form
                className="admin-formulario"
                onSubmit={guardarPerfil}
              >
                <label htmlFor="admin-nombre">Nombre completo</label>
                <input
                  id="admin-nombre"
                  type="text"
                  value={nombreEdicion}
                  onChange={e => setNombreEdicion(e.target.value)}
                  maxLength={120}
                  required />
                <label htmlFor="admin-telefono">Telefono</label>
                <input
                  id="admin-telefono"
                  type="tel"
                  value={telefonoEdicion}
                  onChange={e => setTelefonoEdicion(e.target.value)}
                  maxLength={30}
                />
                <label htmlFor="admin-foto">Elegir fotografia</label>
                <input
                  id="admin-foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => elegirFoto(e.target.files?.[0])}
                />

                {vistaPrevia &&
                  <button
                    type="button"
                    className="admin-boton-secundario"
                    onClick={() => { setVistaPrevia(''); setFotoNueva(null) }}
                  >
                    Conservar fotografia anterior
                  </button>}
                <label>Correo electronico</label>
                <p
                  className="admin-campo-lectura"
                  style={{ fontSize: '0.9rem' }}>
                  {datosPerfil?.correo || perfil?.correo || 'No disponible'}
                </p>
                <div className="admin-tarjeta-acciones">
                  <button
                    type="submit"
                    className="admin-boton-aprobar"
                    disabled={guardando}
                  >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    className="admin-boton-secundario"
                    disabled={guardando}
                    onClick={cancelarEdicion}
                    style={{ fontSize: '0.9rem' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="admin-formulario">
                <label>Nombre completo</label>
                <p
                  className="admin-campo-lectura"
                  style={{ fontSize: '0.9rem' }}>
                  {datosPerfil?.nombre || perfil?.nombre || 'No disponible'}
                </p>
                <label>Correo electronico</label>
                <p
                  className="admin-campo-lectura"
                  style={{ fontSize: '0.9rem' }}>
                  {datosPerfil?.correo || perfil?.correo || 'No disponible'}
                </p>

                <button
                  type="button"
                  className="admin-boton-principal"
                  onClick={() => {
                    setMensajePerfil('');
                    setEditando(true)
                  }}
                >
                  Editar perfil
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default Admin
