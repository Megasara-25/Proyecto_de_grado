import { useEffect, useState } from "react"
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

function Reciclador({ perfil, cerrarSesion }) {
  const [recicladorId, setRecicladorId] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [entregaARechazar, setEntregaARechazar] = useState(null)
  const [pestanaActiva, setPestanaActiva] = useState('inicio')
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState('')
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null)
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState(null)
  const [fotoActual, setFotoActual] = useState(null)

  const [datosPerfil, setDatosPerfil] = useState({
    nombre: '',
    correo: '',
    foto_perfil_url: null
  })

  const cargarReciclador = async () => {

    const { data, error } = await supabase
      .from('reciclador')
      .select('id')
      .eq('usuarioid', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar reciclador:', error)
      return
    }

    setRecicladorId(data.id)
    cargarEntrega(data.id)
  }

  const cargarEntrega = async (idReciclador) => {

    console.log('ID reciclador usado para buscar entregas:', idReciclador)

    const { data, error } = await supabase
      .from('entrega')
      .select(`
      id,
      cantidad,
      puntos_obtenidos,
      estado,
      fecha,
      material(
      nombre
      )
    `)
      .eq('recicladorid', idReciclador)
      .eq('estado', 'Pendiente')

    if (error) {
      console.error('Error al cargar entregas: ', error)
      return
    }

    setEntregas(data)
    console.log('Entregas pendientes: ', data)
  }

  const actualizandoEstadoEntrega = async (
    entregaId,
    nuevoEstado,
    motivo = null
  ) => {
    setMensaje('')

    const { data, error } = await supabase.rpc(
      'actualizar_estado_entrega_reciclador',
      {
        p_entrega_id: entregaId,
        p_estado: nuevoEstado,
        p_motivo_rechazo: motivo
      }
    )

    if (error) {
      console.error('Error al actualizar entrega', error)

      setMensaje('No fue posible actualizar la entrega')
      return
    }

    if (!data) {
      setMensaje('La entrega no pudo ser actualizada')
      return
    }

    if (nuevoEstado === 'Aprobada') {
      setMensaje('Entrega aprobada correctamente')
    }

    if (nuevoEstado === 'Rechazada') {
      setMensaje('Entrega rechazada correctamente')
    }
    cargarEntrega(recicladorId)
  }

  const aprobarEntrega = async (entregaId) => {
    await actualizandoEstadoEntrega(
      entregaId, 'Aprobada'
    )
  }

  const rechazarEntrega = async (entregaId) => {
    setEntregaARechazar(entregaId)
    setMotivoRechazo('')
    setMensaje('')
  }

  const confirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      setMensaje('Debes indicar el motivo del rechazo')
      return
    }

    await actualizandoEstadoEntrega(
      entregaARechazar,
      'Rechazada',
      motivoRechazo
    )

    setEntregaARechazar(null)
    setMotivoRechazo('')
  }

  const cargarDatosPerfil = async () => {
    const { data, error } = await supabase
      .from('usuario')
      .select('nombre, correo, telefono, fecha_nacimiento, foto_perfil_url')
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar perfil:', error)
      setMensajePerfil('No se pudo cargar tu perfil')
      return
    }

    setDatosPerfil({
      nombre: data.nombre || '',
      correo: data.correo || '',
      foto_perfil_url: data.foto_perfil_url || null
    })

    if (data.foto_perfil_url) {
      const { data: imagen, error: errorImagen } =
        await supabase.storage
          .from('foto-perfil')
          .createSignedUrl(data.foto_perfil_url, 3600)

      if (errorImagen) {
        console.error('Error al consultar fotografia:', errorImagen)
      }

      setFotoActual(imagen?.signedUrl || null)
    } else {
      setFotoActual(null)
    }
  }

  const seleccionarFotoPerfil = (event) => {
    const archivo = event.target.files?.[0]
    if (!archivo) return

    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/jpeg']
    if (!formatosPermitidos.includes(archivo.type)) {
      setMensajePerfil('Selecciona una imagen JPG, PNG o JPEG')
      event.target.value = ''
      return
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setMensajePerfil('La fotografia no puede superar los 2 MB')
      event.target.value = ''
      return
    }
    if (fotoVistaPrevia) URL.revokeObjectURL(fotoVistaPrevia)
    setFotoSeleccionada(archivo)
    setFotoVistaPrevia(URL.createObjectURL(archivo))
    setMensajePerfil('')
    event.target.value = ''
  }

  const guardarCambiosPerfil = async () => {
    if (guardandoPerfil) return
    setMensajePerfil('')

    const nombre = datosPerfil.nombre.trim()
    if (!nombre) {
      setMensajePerfil('Ingresa el nombre del establecimiento')
      return
    }
    if (nombre.length > 150) {
      setMensajePerfil('El nombre no puede superar 150 caracteres')
      return
    }

    setGuardandoPerfil(true)
    let rutaFoto = datosPerfil.foto_perfil_url
    let rutaNuevaFoto = null
    let perfilActualizado = false

    try {
      const { data: autenticacion, error: errorAuth } = await supabase.auth.getUser()
      if (errorAuth || !autenticacion?.user || autenticacion.user.id !== perfil.id) {
        throw new Error('No se pudo verificar tu sesion. Inicia sesion nuevamente.')
      }

      const { data: usuarioActual, error: errorConsulta } = await supabase
        .from('usuario')
        .select('telefono, fecha_nacimiento')
        .eq('id', perfil.id)
        .single()
      if (errorConsulta) throw errorConsulta

      if (fotoSeleccionada) {
        const extensiones = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/jpeg': 'jpeg'
        }
        const extension = extensiones[fotoSeleccionada.type]
        if (!extension) throw new Error('Formato de fotografia no permitido')
        rutaNuevaFoto = `${perfil.id}/${crypto.randomUUID()}.${extension}`

        const { error: errorSubida } = await supabase.storage
          .from('foto-perfil')
          .upload(rutaNuevaFoto, fotoSeleccionada, {
            contentType: fotoSeleccionada.type,
            upsert: false
          })
        if (errorSubida) throw errorSubida
        rutaFoto = rutaNuevaFoto
      }

      const { error: errorActualizacion } = await supabase.rpc('actualizar_mi_perfil', {
        p_nombre: nombre,
        p_telefono: usuarioActual.telefono,
        p_fecha_nacimiento: usuarioActual.fecha_nacimiento,
        p_foto_perfil_url: rutaFoto
      })
      if (errorActualizacion) throw errorActualizacion
      perfilActualizado = true

      await cargarDatosPerfil()
      if (fotoVistaPrevia) URL.revokeObjectURL(fotoVistaPrevia)
      setFotoSeleccionada(null)
      setFotoVistaPrevia(null)
      setEditandoPerfil(false)
      setMensajePerfil('Perfil actualizado correctamente')
    } catch (error) {
      console.error('Error al actualizar perfil:', error)
      if (rutaNuevaFoto && !perfilActualizado) {
        const { error: errorLimpieza } = await supabase.storage
          .from('foto-perfil')
          .remove([rutaNuevaFoto])

        if (errorLimpieza) console.error('Error al limpiar fotografia:', errorLimpieza)
      }
      setMensajePerfil(error.message || 'No se pudo actualizar el perfil')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const cancelarEdicionPerfil = () => {
    if (fotoVistaPrevia) URL.revokeObjectURL(fotoVistaPrevia)
    setFotoSeleccionada(null)
    setFotoVistaPrevia(null)
    setEditandoPerfil(false)
    setMensajePerfil('')
    cargarDatosPerfil()
  }

  useEffect(() => {
    cargarReciclador()
  }, [])

  useEffect(() => {
    if (perfil?.id) {
      cargarDatosPerfil()
    }
  }, [perfil?.id])

  const pestanasReciclador = [
    { id: 'inicio', nombre: 'Inicio' },
    { id: 'entregas', nombre: 'Entregas' },
    { id: 'historial', nombre: 'Historial' },
    { id: 'centro', nombre: 'Mi centro' },
    { id: 'perfil', nombre: 'Perfil' }
  ]

  return (
    <div className="eco-reciclador-pagina">
      <header className="eco-reciclador-header">
        <div className="eco-reciclador-marca">
          <img
            src={logoEcocycle}
            alt='EcoCycle'
            className="eco-reciclador-logo"
          />
        </div>
      </header>

      <main className="eco-reciclador-contenido">
        <nav
          className="eco-reciclador-navegacion"
          aria-label="navegacion del reciclador"
        >
          {pestanasReciclador.map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={'eco-reciclador-tab ' +
                (pestanaActiva === pestana.id ? 'activa' : '')
              }
              aria-current={pestanaActiva === pestana.id ? 'page' : undefined}

              onClick={() => setPestanaActiva(pestana.id)}
            >
              {pestana.nombre}
            </button>
          ))}
        </nav>

        {mensaje && (
          <p className="eco-reciclador-mensaje" role="status">
            {mensaje}
          </p>
        )}

        {pestanaActiva === 'inicio' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-bienvenida">
              <span>Panel del reciclador</span>
              <h2>Hola,{perfil.nombre}</h2>
              <p>
                Gestiona las entregas de materiales reciclables
                registradas en tu centro
              </p>
            </div>

            <div className="eco-reciclador-resumen">
              <span>Entregas pendientes: </span>
              <strong>{entregas.length}</strong>
              <small> Por revisar y validar</small>
            </div>

            <button
              type="button"
              className="eco-reciclador-boton-principal"
              onClick={() => setPestanaActiva('entregas')}
            >
              Revisar entregas
            </button>
          </section>
        )}

        {pestanaActiva === 'entregas' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-titulo">
              <h2>Entregas pendientes</h2>
              <p>
                Verificar cada entrega antes de aproba
                o rechazarla
              </p>
            </div>

            {entregas.length === 0 && (
              <div className="eco-reciclador-vacio">
                No tiene entregas pendientes por validar
              </div>
            )}

            <div className="eco-reciclador-lista">
              {entregas.map((entrega) => (
                <div
                  key={entrega.id}
                  className="reciclador-entregas-card"
                >
                  <h3>
                    {entrega.material?.nombre || 'Material'}
                  </h3>

                  <p>
                    <strong>Cantidad:</strong>{entrega.cantidad}kg
                  </p>
                  <p>
                    <strong>Ecopuntos</strong>{entrega.puntos_obtenidos}
                  </p>
                  <p>
                    <strong>Estado</strong>{entrega.estado}
                  </p>

                  <div className="reciclador-accciones">
                    <button
                      type="button"
                      className="reciclador-boton-aprobar"
                      onClick={() => aprobarEntrega(entrega.id)}
                    >
                      Aprobar
                    </button>

                    <button
                      type="button"
                      className="reciclador-boton-rechazar"
                      onClick={() => rechazarEntrega(entrega.id)}
                    >
                      Rechazar
                    </button>
                  </div>

                  {entregaARechazar === entrega.id && (
                    <div className="reciclador-rechazo">
                      <label htmlFor={`motivo-${entrega.id}`}>
                        Motivo de rechazo
                      </label>

                      <textarea
                        id={`motivo-${entrega.id}`}
                        className="reciclador-rechazo-textarea"
                        placeholder="Ejemplo: la cantidad de entrega no coincide con lo regiistrado"
                        value={motivoRechazo}
                        onChange={(e) => setMotivoRechazo(e.target.value)}
                      />

                      <div className="eco-reciclador-acciones-rechazo">
                        <button
                          type="button"
                          onClick={() => {
                            setEntregaARechazar(null)
                            setMotivoRechazo('')
                          }}
                        >
                          Cancelar
                        </button>

                        <button
                          type="button"
                          onClick={confirmarRechazo}
                        >
                          Confirmar rechazo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {pestanaActiva === 'historial' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-titulo">
              <h2>Historial</h2>
              <p>
                Aqui podras consultar las entregas que
                ya fueron aprobadas o rechazadas
              </p>
            </div>

            <div className="eco-reciclador-vacio">
              Estamos preparando la consulta del historial
            </div>
          </section>
        )}

        {pestanaActiva === 'centro' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-titulo">
              <h2>Mi centro de reciclaje</h2>
              <p>
                Informacion del centro, ubicacion y
                materiales que recibe
              </p>
            </div>

            <div className="eco-reciclador-vacio">
              La informacion del centro se conectara
              con los datos registrados
            </div>
          </section>
        )}

        {pestanaActiva === 'perfil' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-perfil eco-reciclador-perfil-editable">

              <div className="eco-reciclador-avatar">
                {fotoVistaPrevia || fotoActual ? (
                  <img
                    src={fotoVistaPrevia || fotoActual}
                    alt="Fotografia de perfil"
                    className="eco-reciclador-foto"
                  />
                ) : (
                  <span>
                    {datosPerfil.nombre?.charAt(0).toUpperCase() || 'R'}
                  </span>
                )}
              </div>

              {editandoPerfil && (
                <div className="eco-reciclador-foto-accion">
                  <label
                    htmlFor="reciclador-foto-perfil"
                    className="eco-reciclador-cambiar-foto"
                  >
                    Cambiar fotografia
                  </label>

                  <input
                    id='reciclador-foto-perfil'
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={seleccionarFotoPerfil}
                    disabled={guardandoPerfil}
                    hidden
                  />
                  <small>JPG, PNG o JPEG. Maximo 2 MB</small>
                </div>
              )}

              <h2>Mi perfil</h2>

              <div className='eco-reciclador-formulario'>
                <div className='eco-reciclador-campo'>
                  <label htmlFor="reciclador-nombre">
                    Nombre del establecimiento
                  </label>

                  <input
                    id='reciclador-nombre'
                    type="text"
                    maxLength={150}
                    value={datosPerfil.nombre}
                    disabled={!editandoPerfil || guardandoPerfil}
                    onChange={(e) =>
                      setDatosPerfil({
                        ...datosPerfil,
                        nombre: e.target.value
                      })
                    }
                  />
                </div>
                <div className='eco-reciclador-campo'>
                  <label htmlFor="reciclador-correo">
                    Correo electronico
                  </label>

                  <input
                    id='reciclador-correo'
                    type="email"
                    value={datosPerfil.correo}
                    disabled
                  />

                  <small>
                    El correo no se puede modificar desde aqui
                  </small>
                </div>
              </div>
              {mensajePerfil && (
                <p
                  className="eco-reciclador-mensaje-perfil"
                  role='status'
                >
                  {mensajePerfil}
                </p>
              )}

              <div className="eco-reciclador-botones-perfil">
                {!editandoPerfil ? (
                  <button
                    type="button"
                    className="eco-reciclador-editar-perfil"
                    onClick={() => {
                      setMensajePerfil('')
                      setEditandoPerfil(true)
                    }}
                  >
                    Editar perfil
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="eco-reciclador-guardar-perfil"
                      onClick={guardarCambiosPerfil}
                      disabled={guardandoPerfil}
                    >
                      {guardandoPerfil
                        ? 'Guardando...'
                        : 'Guardar cambios'}
                    </button>

                    <button
                      type="button"
                      className="eco-reciclador-cancelar-perfil"
                      onClick={cancelarEdicionPerfil}
                      disabled={guardandoPerfil}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                className="eco-reciclador-salir-perfil"
                onClick={cerrarSesion}
              >
                Cerrar sesion
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default Reciclador