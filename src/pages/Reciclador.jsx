import { useEffect, useRef, useState } from "react"
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

const TAMANO_PAGINA_RECICLADOR = 10

const deduplicarEntregasPorId = (lista) => {
  const vistos = new Set()
  const resultado = []
  for (const item of lista) {
    const id = Number(item?.id)
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    resultado.push(item)
  }
  return resultado
}

const ordenarEntregasDesc = (lista) =>
  deduplicarEntregasPorId(
    [...lista].sort((a, b) => {
      const msA = a.fecha ? new Date(a.fecha).getTime() : 0
      const msB = b.fecha ? new Date(b.fecha).getTime() : 0
      if (msB !== msA) return msB - msA
      return Number(b.id) - Number(a.id)
    })
  )

function Reciclador({ perfil, cerrarSesion }) {
  const [recicladorId, setRecicladorId] = useState(null)
  const [entregas, setEntregas] = useState([])
  const [totalPendientes, setTotalPendientes] = useState(0)
  const [cargandoPendientes, setCargandoPendientes] = useState(false)
  const [cargandoMasPendientes, setCargandoMasPendientes] = useState(false)
  const [hayMasPendientes, setHayMasPendientes] = useState(false)
  const [historialEntregas, setHistorialEntregas] = useState([])
  const [filtroHistorial, setFiltroHistorial] = useState('todas')
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [cargandoMasHistorial, setCargandoMasHistorial] = useState(false)
  const [hayMasHistorial, setHayMasHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')
  const [nombreMostrado, setNombreMostrado] = useState(perfil.nombre || '')
  const [mensaje, setMensaje] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [entregaARechazar, setEntregaARechazar] = useState(null)
  const [entregaProcesando, setEntregaProcesando] = useState(null)
  const operacionEntregaEnCurso = useRef(false)
  const entregasPendientesRef = useRef([])
  const historialEntregasRef = useRef([])
  const offsetPendientesRef = useRef(0)
  const offsetHistorialRef = useRef(0)
  const solicitudPendientesIdRef = useRef(0)
  const solicitudHistorialIdRef = useRef(0)
  const pestanaActivaRef = useRef('inicio')
  const filtroHistorialRef = useRef('todas')
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
  }

  const cargarEntrega = async (idReciclador, { reiniciar = true } = {}) => {
    const idObjetivo = idReciclador ?? recicladorId
    if (!idObjetivo) return entregasPendientesRef.current

    const idSolicitud = ++solicitudPendientesIdRef.current
    const offsetActual = reiniciar ? 0 : offsetPendientesRef.current

    if (reiniciar) {
      setCargandoPendientes(true)
    } else {
      setCargandoMasPendientes(true)
    }

    console.log('ID reciclador usado para buscar entregas:', idObjetivo)

    try {
      const { data, count, error } = await supabase
        .from('entrega')
        .select(
          `
        id,
        cantidad,
        puntos_obtenidos,
        estado,
        fecha,
        material(
        nombre
        )
      `,
          { count: 'exact' }
        )
        .eq('recicladorid', idObjetivo)
        .eq('estado', 'Pendiente')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(
          offsetActual,
          offsetActual + TAMANO_PAGINA_RECICLADOR - 1
        )

      if (idSolicitud !== solicitudPendientesIdRef.current) {
        return entregasPendientesRef.current
      }

      if (error) {
        console.error('Error al cargar entregas: ', error)
        return entregasPendientesRef.current
      }

      const lote = Array.isArray(data) ? data : []
      if (typeof count === 'number') {
        setTotalPendientes(count)
      }

      setHayMasPendientes(lote.length === TAMANO_PAGINA_RECICLADOR)
      offsetPendientesRef.current = offsetActual + lote.length

      const combinadas = reiniciar
        ? ordenarEntregasDesc(lote)
        : ordenarEntregasDesc([...entregasPendientesRef.current, ...lote])

      if (typeof count !== 'number') {
        setTotalPendientes(combinadas.length)
      }

      entregasPendientesRef.current = combinadas
      setEntregas(combinadas)
      console.log('Entregas pendientes: ', combinadas)
      return combinadas
    } finally {
      if (idSolicitud === solicitudPendientesIdRef.current) {
        setCargandoPendientes(false)
        setCargandoMasPendientes(false)
      }
    }
  }

  const obtenerEstadosFiltroHistorial = (filtro) => {
    if (filtro === 'aprobadas') return ['Aprobada', 'Aprobado']
    if (filtro === 'rechazadas') return ['Rechazada', 'Rechazado']
    return ['Aprobada', 'Aprobado', 'Rechazada', 'Rechazado']
  }

  const cargarHistorial = async (
    idReciclador,
    { reiniciar = true, filtro = filtroHistorialRef.current } = {}
  ) => {
    const idObjetivo = idReciclador ?? recicladorId
    if (!idObjetivo) return historialEntregasRef.current

    const idSolicitud = ++solicitudHistorialIdRef.current
    const offsetActual = reiniciar ? 0 : offsetHistorialRef.current

    if (reiniciar) {
      setCargandoHistorial(true)
    } else {
      setCargandoMasHistorial(true)
    }
    setErrorHistorial('')

    try {
      const { data, error } = await supabase
        .from('entrega')
        .select(`
          id,
          cantidad,
          puntos_obtenidos,
          estado,
          fecha,
          motivo_rechazo,
          material(nombre)
        `)
        .eq('recicladorid', idObjetivo)
        .in('estado', obtenerEstadosFiltroHistorial(filtro))
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(
          offsetActual,
          offsetActual + TAMANO_PAGINA_RECICLADOR - 1
        )

      if (idSolicitud !== solicitudHistorialIdRef.current) {
        return historialEntregasRef.current
      }

      if (error) throw error

      const lote = Array.isArray(data) ? data : []
      setHayMasHistorial(lote.length === TAMANO_PAGINA_RECICLADOR)
      offsetHistorialRef.current = offsetActual + lote.length

      const combinadas = reiniciar
        ? ordenarEntregasDesc(lote)
        : ordenarEntregasDesc([...historialEntregasRef.current, ...lote])

      historialEntregasRef.current = combinadas
      setHistorialEntregas(combinadas)
      return combinadas
    } catch (error) {
      console.error('Error al consultar historial del reciclador:', error)
      setErrorHistorial('No fue posible consultar el historial. Verifica los permisos de lectura y vuelve a intentarlo.')
      return historialEntregasRef.current
    } finally {
      if (idSolicitud === solicitudHistorialIdRef.current) {
        setCargandoHistorial(false)
        setCargandoMasHistorial(false)
      }
    }
  }

  const actualizandoEstadoEntrega = async (
    entregaId,
    nuevoEstado,
    motivo = null
  ) => {
    if (operacionEntregaEnCurso.current) return false

    operacionEntregaEnCurso.current = true
    setEntregaProcesando(entregaId)
    setMensaje('')

    try {
      const { data, error } = await supabase.rpc(
        'actualizar_estado_entrega_reciclador',
        {
          p_entrega_id: entregaId,
          p_estado: nuevoEstado,
          p_motivo_rechazo: motivo
        }
      )

      if (error) {
        console.error('Error al actualizar entrega:', error)
        setMensaje('No fue posible actualizar la entrega')
        return false
      }

      if (!data) {
        setMensaje('La entrega no pudo ser actualizada')
        return false
      }

      setMensaje(
        nuevoEstado === 'Aprobada'
          ? 'Entrega aprobada correctamente'
          : 'Entrega rechazada correctamente'
      )

      await cargarEntrega(recicladorId, { reiniciar: true })
      if (pestanaActivaRef.current === 'historial') {
        await cargarHistorial(recicladorId, {
          reiniciar: true,
          filtro: filtroHistorialRef.current
        })
      }
      return true
    } catch (error) {
      console.error('Error al procesar entrega:', error)
      setMensaje('Ocurrió un error al procesar la entrega')
      return false
    } finally {
      operacionEntregaEnCurso.current = false
      setEntregaProcesando(null)
    }
  }

  const aprobarEntrega = async (entregaId) => {
    await actualizandoEstadoEntrega(entregaId, 'Aprobada')
  }

  const rechazarEntrega = (entregaId) => {
    if (operacionEntregaEnCurso.current) return
    setEntregaARechazar(entregaId)
    setMotivoRechazo('')
    setMensaje('')
  }

  const confirmarRechazo = async () => {
    if (operacionEntregaEnCurso.current) return

    if (!motivoRechazo.trim()) {
      setMensaje('Debes indicar el motivo del rechazo')
      return
    }

    if (entregaARechazar === null) return

    const actualizado = await actualizandoEstadoEntrega(
      entregaARechazar,
      'Rechazada',
      motivoRechazo.trim()
    )

    // Solo cerramos el formulario cuando Supabase confirma el rechazo.
    if (actualizado) {
      setEntregaARechazar(null)
      setMotivoRechazo('')
    }
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

    setNombreMostrado(data.nombre || perfil.nombre || '')
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
      setNombreMostrado(nombre)

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

  useEffect(() => {
    pestanaActivaRef.current = pestanaActiva
    filtroHistorialRef.current = filtroHistorial
  }, [pestanaActiva, filtroHistorial])

  useEffect(() => {
    if (!recicladorId) return
    if (pestanaActiva === 'entregas' || pestanaActiva === 'inicio') {
      offsetPendientesRef.current = 0
      void cargarEntrega(recicladorId, { reiniciar: true })
    } else if (pestanaActiva === 'historial') {
      offsetHistorialRef.current = 0
      void cargarHistorial(recicladorId, {
        reiniciar: true,
        filtro: filtroHistorial
      })
    }
  }, [pestanaActiva, filtroHistorial, recicladorId])

  useEffect(() => {
    if (!recicladorId) return

    const canal = supabase
      .channel(`entregas-reciclador-${recicladorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entrega',
          filter: `recicladorid=eq.${recicladorId}`,
        },
        (payload) => {
          const nueva = payload?.new
          if (nueva && nueva.estado === 'Pendiente') {
            setTotalPendientes((prev) => prev + 1)
          }
          if (
            pestanaActivaRef.current === 'entregas' ||
            pestanaActivaRef.current === 'inicio'
          ) {
            if (offsetPendientesRef.current <= TAMANO_PAGINA_RECICLADOR) {
              void cargarEntrega(recicladorId, { reiniciar: true })
            }
          }
        }
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') {
          if (
            pestanaActivaRef.current === 'entregas' ||
            pestanaActivaRef.current === 'inicio'
          ) {
            void cargarEntrega(recicladorId, { reiniciar: true })
          }
        }
      })

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [recicladorId])

  const pestanasReciclador = [
    { id: 'inicio', nombre: 'Inicio' },
    { id: 'entregas', nombre: 'Entregas' },
    { id: 'historial', nombre: 'Historial' },
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
              <h2 style={{ textAlign: 'center' }}>Hola, {nombreMostrado}</h2>
              <p>
                Gestiona las entregas de materiales reciclables
                registradas en tu centro
              </p>
            </div>

            <div className="eco-reciclador-resumen" role="status" aria-live="polite">
              <span>Entregas pendientes:</span>
              <strong>{totalPendientes}</strong>
              <small>Por revisar y validar</small>
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
              <span>Panel del reciclador · Hola, {nombreMostrado}</span>
              <h2>Entregas pendientes</h2>
              <p>
                Verifica cada entrega antes de aprobarla o rechazarla
              </p>
            </div>

            <div className="eco-reciclador-resumen" role="status" aria-live="polite">
              <span>Total por atender: </span>
              <strong>{totalPendientes}</strong>
              <small>
                {' '}
                {totalPendientes === 1
                  ? 'entrega pendiente'
                  : 'entregas pendientes'}
              </small>
            </div>

            {cargandoPendientes && entregas.length === 0 ? (
              <div className="eco-reciclador-vacio" role="status">
                Cargando entregas pendientes...
              </div>
            ) : entregas.length === 0 ? (
              <div className="eco-reciclador-vacio">
                No tiene entregas pendientes por validar
              </div>
            ) : (
              <>
                <div className="eco-reciclador-lista">
                  {entregas.map((entrega) => (
                    <div
                      key={entrega.id}
                      className="reciclador-entregas-card"
                    >
                      <h3>
                        {entrega.material?.nombre || 'Material'}
                      </h3>

                      <div className="eco-tarjeta-datos-apilables">
                        <div>
                          <span>Cantidad</span>
                          <strong>{entrega.cantidad} kg</strong>
                        </div>
                        <div>
                          <span>EcoPuntos</span>
                          <strong>{entrega.puntos_obtenidos}</strong>
                        </div>
                        <div>
                          <span>Estado</span>
                          <strong>{entrega.estado}</strong>
                        </div>
                      </div>

                      <div className="reciclador-accciones">
                        <button
                          type="button"
                          className="reciclador-boton-aprobar"
                          onClick={() => aprobarEntrega(entrega.id)}
                          disabled={entregaProcesando !== null || entregaARechazar !== null}
                        >
                          {entregaProcesando === entrega.id ? 'Procesando...' : 'Aprobar'}
                        </button>

                        <button
                          type="button"
                          className="reciclador-boton-rechazar"
                          onClick={() => rechazarEntrega(entrega.id)}
                          disabled={entregaProcesando !== null || entregaARechazar !== null}
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
                            placeholder="Ejemplo: la cantidad de entrega no coincide con lo registrado"
                            value={motivoRechazo}
                            onChange={(e) => setMotivoRechazo(e.target.value)}
                            disabled={entregaProcesando !== null}
                          />

                          <div className="eco-reciclador-acciones-rechazo">
                            <button
                              type="button"
                              onClick={() => {
                                setEntregaARechazar(null)
                                setMotivoRechazo('')
                              }}
                              disabled={entregaProcesando !== null}
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              onClick={confirmarRechazo}
                              disabled={entregaProcesando !== null || !motivoRechazo.trim()}
                            >
                              {entregaProcesando === entrega.id
                                ? 'Procesando...'
                                : 'Confirmar rechazo'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {hayMasPendientes && (
                  <div className="eco-paginacion-contenedor">
                    <button
                      type="button"
                      className="eco-boton-ver-mas"
                      disabled={cargandoMasPendientes}
                      onClick={() =>
                        cargarEntrega(recicladorId, { reiniciar: false })
                      }
                    >
                      {cargandoMasPendientes ? 'Cargando...' : 'Ver más'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {pestanaActiva === 'historial' && (
          <section className="eco-reciclador-vista">
            <div className="eco-reciclador-titulo">
              <h2>Historial</h2>
              <p>Consulta las entregas aprobadas y rechazadas de tu centro.</p>
            </div>

            <div
              className="eco-subnavegacion-historial"
              role="group"
              aria-label="Filtrar historial de entregas"
            >
              {[
                { id: 'todas', nombre: 'Todas' },
                { id: 'aprobadas', nombre: 'Aprobadas' },
                { id: 'rechazadas', nombre: 'Rechazadas' }
              ].map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  aria-pressed={filtroHistorial === opcion.id}
                  className={
                    filtroHistorial === opcion.id
                      ? 'eco-subtab-boton activo'
                      : 'eco-subtab-boton'
                  }
                  onClick={() => {
                    if (filtroHistorial !== opcion.id) {
                      offsetHistorialRef.current = 0
                      setFiltroHistorial(opcion.id)
                    }
                  }}
                >
                  {opcion.nombre}
                </button>
              ))}
            </div>

            {cargandoHistorial && historialEntregas.length === 0 ? (
              <div className="eco-reciclador-vacio" role="status">
                Cargando historial...
              </div>
            ) : errorHistorial ? (
              <div className="eco-reciclador-vacio" role="alert">
                <p>{errorHistorial}</p>
                <button
                  type="button"
                  className="eco-reciclador-boton-principal"
                  onClick={() =>
                    cargarHistorial(recicladorId, {
                      reiniciar: true,
                      filtro: filtroHistorial
                    })
                  }
                >
                  Reintentar
                </button>
              </div>
            ) : historialEntregas.length === 0 ? (
              <div className="eco-reciclador-vacio">
                Todavía no hay entregas para el filtro seleccionado.
              </div>
            ) : (
              <>
                <div className="eco-reciclador-historial-lista">
                  {historialEntregas.map((entrega) => {
                    const aprobada = ['Aprobada', 'Aprobado'].includes(
                      entrega.estado
                    )
                    const fechaTexto = entrega.fecha
                      ? new Date(entrega.fecha).toLocaleDateString('es-CO')
                      : 'Fecha no disponible'

                    return (
                      <details
                        key={entrega.id}
                        className="eco-reciclador-historial-card"
                      >
                        <summary className="eco-reciclador-historial-resumen">
                          <div
                            className={`eco-reciclador-historial-icono ${aprobada ? 'aprobada' : 'rechazada'
                              }`}
                            aria-hidden="true"
                          >
                            {aprobada ? '✓' : '✕'}
                          </div>

                          <div className="eco-reciclador-historial-identidad">
                            <strong>
                              {entrega.material?.nombre ||
                                'Material reciclable'}
                            </strong>
                            <small>{fechaTexto}</small>
                            <span
                              className={`eco-reciclador-historial-estado ${aprobada ? 'aprobada' : 'rechazada'
                                }`}
                            >
                              {aprobada ? 'Aprobada' : 'Rechazada'}
                            </span>
                          </div>

                          <span
                            className="eco-reciclador-historial-flecha"
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        </summary>

                        <div className="eco-reciclador-historial-detalles">
                          <div className="eco-reciclador-historial-dato">
                            <span>Estado</span>
                            <strong>{aprobada ? 'Aprobada' : 'Rechazada'}</strong>
                          </div>
                          <div className="eco-reciclador-historial-dato">
                            <span>Cantidad</span>
                            <strong>{entrega.cantidad} kg</strong>
                          </div>
                          <div className="eco-reciclador-historial-dato">
                            <span>Fecha</span>
                            <strong>{fechaTexto}</strong>
                          </div>
                          {aprobada && (
                            <div className="eco-reciclador-historial-dato">
                              <span>EcoPuntos acreditados</span>
                              <strong>{entrega.puntos_obtenidos ?? 0}</strong>
                            </div>
                          )}
                          {!aprobada && entrega.motivo_rechazo && (
                            <div className="eco-reciclador-historial-rechazo">
                              <strong>Motivo del rechazo</strong>
                              <p>{entrega.motivo_rechazo}</p>
                            </div>
                          )}
                        </div>
                      </details>
                    )
                  })}
                </div>

                {hayMasHistorial && (
                  <div className="eco-paginacion-contenedor">
                    <button
                      type="button"
                      className="eco-boton-ver-mas"
                      disabled={cargandoMasHistorial}
                      onClick={() =>
                        cargarHistorial(recicladorId, {
                          reiniciar: false,
                          filtro: filtroHistorial
                        })
                      }
                    >
                      {cargandoMasHistorial ? 'Cargando...' : 'Ver más'}
                    </button>
                  </div>
                )}
              </>
            )}
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