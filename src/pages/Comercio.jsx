import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Comercio({ perfil, cerrarSesion }) {
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [codigoCanje, setCodigoCanje] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [comercioId, setComercioId] = useState(null)
  const [canjeEncontrado, setCanjeEncontrado] = useState(null)
  const [confirmandoCanje, setConfirmandoCanje] = useState(false)
  const [datosComercio, setDatosComercio] = useState(null)
  const [misRecompensas, setMisRecompensas] = useState([])
  const [historialCanjes, setHistorialCanjes] = useState([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardarRecompensas, setGuardarRecompensas] = useState(false)
  const [mensajeRecompensa, setMensajeRecompensa] = useState('')
  const [nuevasRecompensas, setNuevasRecompensas] = useState({
    nombre: '',
    descripcion: '',
    puntos_requeridos: '',
    cantidad_disponible: '',
    categoria: ''
  })
  const [recompensaEditando, setRecompensaEditando] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const cargarComercio = async () => {
    const { data, error } = await supabase
      .from('comercio_aliado')
      .select('id, nombre_comercio, estado_validacion')
      .eq('usuarioid', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar comercio:', error)
      return
    }

    setDatosComercio(data)
    cargarMisRecompensas(data.id)
    console.log('Comercio autenticado:', data.id)
  }

  useEffect(() => {
    cargarComercio()
    cargarHistorialCanjes()
  }, [])

  const cargarMisRecompensas = async (idComercio) => {
    const { data, error } = await supabase
      .from('recompensas')
      .select(`
      id,
      nombre,
      descripcion,
      puntos_requeridos,
      cantidad_disponible,
      estado,
      categoria
    `)
      .eq('comercioid', idComercio)
      .order('id', { ascending: false })

    if (error) {
      console.error('Error al cargar recompensas:', error)
      return
    }
    setMisRecompensas(data)
  }

  const cargarHistorialCanjes = async () => {
    const { data, error } = await supabase.rpc(
      'historial_canjes_comercio'
    )

    if (error) {
      console.error('Error al cargar historial:', error)
      return
    }

    setHistorialCanjes(data || [])
    console.log('Historial del comercio:', data)
  }

  const buscarCanje = async () => {

    setMensaje('')
    setCanjeEncontrado(null)

    if (!tipoDocumento || !numeroDocumento.trim() || !codigoCanje.trim()) {
      setMensaje('Debes completar todos los campos')
      return
    }

    if (!/^\d{6}$/.test(codigoCanje.trim())) {
      setMensaje('El codigo de canje debe tener 6 digitos')
      return
    }

    const { data, error } = await supabase.rpc(
      'buscar_canje_comercio',
      {
        p_tipo_documento: tipoDocumento,
        p_numero_documento: numeroDocumento,
        p_codigo_canje: codigoCanje
      }
    )

    if (error) {
      console.error('Error al buscar canje:', error)
      setMensaje('No te fue posible validar el canje')
      return
    }

    if (data.length === 0) {
      setCanjeEncontrado(null)
      setMensaje('No se encontro un canje valido')
      return
    }
    setCanjeEncontrado(data[0])
    setMensaje('')

    console.log('Canje encontrado:', data)
  }

  const confirmarCanje = async () => {
    if (confirmandoCanje || !canjeEncontrado) return

    setConfirmandoCanje(true)
    setMensaje('')

    try {
      const { data, error } = await supabase.rpc(
        'confirmar_canje_comercio',
        {
          p_canje_id: canjeEncontrado.canje_id,
          p_codigo_canje: codigoCanje
        }
      )

      if (error) {
        console.error('Error al confirmar canje:', error)
        setMensaje('No fue posible confirmar el canje')
        return
      }

      if (!data) {
        setMensaje('El canje ya fue utilizado o no es valido')
        setCanjeEncontrado(null)
        return
      }

      setMensaje('Canje confirmado correctamente')
      await cargarHistorialCanjes()

      setCanjeEncontrado({
        ...canjeEncontrado,
        estado_canje: 'Canjeado'
      })

    } catch (error) {
      console.error('Error inseperado:', error)
      setMensaje('Ocurrio un error al confirmar el canje')

    } finally {
      setConfirmandoCanje(false)
    }
  }
  const crearRecompensa = async (e) => {
    e.preventDefault()

    if (guardarRecompensas) return
    setMensajeRecompensa('')

    if (datosComercio?.estado_validacion !== 'Aprobado') {
      setMensajeRecompensa('Tu comercio debe estar aprobado')
      return
    }

    const puntos = Number(nuevasRecompensas.puntos_requeridos)
    const cantidad = Number(nuevasRecompensas.cantidad_disponible)

    if (
      !nuevasRecompensas.nombre.trim() ||
      !Number.isInteger(puntos) ||
      puntos <= 0 ||
      !Number.isInteger(cantidad) ||
      cantidad < 0 ||
      nuevasRecompensas.puntos_requeridos === '' ||
      nuevasRecompensas.cantidad_disponible === ''
    ) {
      setMensajeRecompensa('Revisa el nombre, los puntos y la cantidad disponible')
      return
    }

    setGuardarRecompensas(true)

    try {
      const { error } = await supabase.rpc('crear_recompensa_comercio', {
        p_nombre: nuevasRecompensas.nombre.trim(),
        p_descripcion: nuevasRecompensas.descripcion.trim(),
        p_puntos_requeridos: puntos,
        p_cantidad_disponible: cantidad,
        p_categoria: nuevasRecompensas.categoria.trim() || null,
        p_imagen_url: null
      })

      if (error) throw error

      await cargarMisRecompensas(datosComercio.id)

      setNuevasRecompensas({
        nombre: '',
        descripcion: '',
        puntos_requeridos: '',
        cantidad_disponible: '',
        categoria: ''
      })

      setMostrarFormulario(false)
      setMensajeRecompensa('Recompensa creada correctamente')
    } catch (error) {
      console.error('Error al crear recompensa:', error)
      setMensajeRecompensa('No fue posible crear la recompensa')
    } finally {
      setGuardarRecompensas(false)
    }
  }

  console.log('Mis recompensas:', misRecompensas)

  const editarRecompensa = (recompensa) => {
    console.log('Editar recompensa seleccionada:', recompensa)
    
    setRecompensaEditando({
      id: recompensa.id,
      nombre: recompensa.nombre,
      descripcion: recompensa.descripcion || '',
      puntos_requeridos: String(recompensa.puntos_requeridos),
      categoria: recompensa.categoria || '',
      estado: recompensa.estado
    })

    setMensajeRecompensa('')
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()

    if (guardandoEdicion || !recompensaEditando) return

    const puntos = Number(recompensaEditando.puntos_requeridos)

    if (
      !recompensaEditando.nombre.trim() ||
      !Number.isInteger(puntos) ||
      puntos <= 0
    ) {
      setMensajeRecompensa('Revisa el nombre y los Ecopuntos')
      return
    }

    setGuardandoEdicion(true)
    setMensajeRecompensa('')

    try {
      const { data, error } = await supabase.rpc(
        'actualizar_recompensa_comercio',
        {
          p_recompensa_id: recompensaEditando.id,
          p_nombre: recompensaEditando.nombre.trim(),
          p_descripcion: recompensaEditando.descripcion.trim(),
          p_puntos_requeridos: puntos,
          p_categoria: recompensaEditando.categoria.trim(),
          p_estado: recompensaEditando.estado
        }
      )

      if (error) throw error
      if (!data) {
        throw new Error('La recompensa no puedo actualiziarse')
      }
      await cargarMisRecompensas(datosComercio.id)

      setRecompensaEditando(null)
      setMensajeRecompensa('Recompensa actualizada correctamente')
    } catch (error) {
      console.error('Error al actualizar recompensa:', error)
      setMensajeRecompensa('No fue posible actualizar la recompensa')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  return (
    <div className="comercio-pagina">
      <div className="comercio-panel">
        <header className='comercio-header'>
          <div>
            <h1>EcoCycle</h1>
            <h2>Panel del comercio aliado</h2>
          </div>

          <button
            className='comercio-boton-salir'
            onClick={cerrarSesion}
          >
            Cerrar sesion
          </button>
        </header>

        <section className='comercio-bienvenido'>
          <div>
            <span>Comercio aliado</span>
            <h2>{datosComercio?.nombre_comercio || perfil.nombre}</h2>
            <p>Administra tus beneficios y valida los canjes de tus clientes</p>
          </div>

          <span className='comercio-estado'>
            {datosComercio?.estado_validacion || 'Cargando...'}
          </span>
        </section>

        <section className='comercio-recompensas'>
          <h2>Mis recompensas</h2>
          {datosComercio?.estado_validacion === 'Aprobado' && (
            <button
              type='button'
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
            >
              {mostrarFormulario ? 'Cancelar' : '+ nueva recompensa'}
            </button>
          )}

          {mensajeRecompensa && <p role='status'>{mensajeRecompensa}</p>}

          {mostrarFormulario && (
            <form onSubmit={crearRecompensa} className='comercio-formulario-recompensa'>
              <h3>Publicar nueva recompensa</h3>

              <label htmlFor="recompensa-nombre">Nombre de la recompensa</label>
              <input
                id='recompensa-nombre'
                type="text"
                required
                maxLength={100}
                value={nuevasRecompensas.nombre}
                onChange={(e) => setNuevasRecompensas({
                  ...nuevasRecompensas,
                  nombre: e.target.value
                })}
                placeholder='Ej. 10% de descuento'
              />

              <label htmlFor="recompensa-descripcion">Descripcion</label>
              <textarea
                id="recompensa-descripcion"
                value={nuevasRecompensas.descripcion}
                onChange={(e) => setNuevasRecompensas({
                  ...nuevasRecompensas,
                  descripcion: e.target.value
                })}
              />


              <label htmlFor="recompensa-puntos">Ecopuntos requeridos</label>
              <input
                id='recompensa-puntos'
                type="number"
                min='1'
                step='1'
                required
                value={nuevasRecompensas.puntos_requeridos}
                onChange={(e) => setNuevasRecompensas({
                  ...nuevasRecompensas,
                  puntos_requeridos: e.target.value
                })}
              />
              <label htmlFor="recompensa-cantidad">Cantidad disponible</label>
              <input
                id='recompensa-cantidad'
                type="number"
                min='0'
                step='1'
                required
                value={nuevasRecompensas.cantidad_disponible}
                onChange={(e) => setNuevasRecompensas({
                  ...nuevasRecompensas,
                  cantidad_disponible: e.target.value
                })}
              />

              <label htmlFor="recompensa-categoria">Categoria</label>
              <input
                id='recompensa-categoria'
                type="text"
                value={nuevasRecompensas.categoria}
                onChange={(e) => setNuevasRecompensas({
                  ...nuevasRecompensas,
                  categoria: e.target.value
                })}
                placeholder='Ej. Descuentos'
              />

              <button type='submit' disabled={guardarRecompensas}>
                {guardarRecompensas ? 'publicando...' : 'Publicar recompensa'}
              </button>
            </form>
          )}

          {recompensaEditando && (
            <form
              onSubmit={guardarEdicion}
              className='comercio-formulario-recompensa'
            >
              <h3>Editar recompensa</h3>

              <label htmlFor="editar-nombre">Nombre</label>
              <input
                id='editar-nombre'
                type="text"
                required
                maxLength={100}
                value={recompensaEditando.nombre}
                onChange={(e) => setRecompensaEditando({
                  ...recompensaEditando,
                  nombre: e.target.value
                })}
              />

              <label htmlFor="editar-descripcion">Descripcion</label>
              <textarea
                id="editar-descripcion"
                value={recompensaEditando.descripcion}
                onChange={(e) => setRecompensaEditando({
                  ...recompensaEditando,
                  descripcion: e.target.value
                })}
              />

              <label htmlFor="editar-puntos">Ecopuntos requeridos</label>
              <input
                id='editar-puntos'
                type="number"
                min='1'
                step='1'
                required
                value={recompensaEditando.puntos_requeridos}
                onChange={(e) => setRecompensaEditando({
                  ...recompensaEditando,
                  puntos_requeridos: e.target.value
                })}
              />

              <label htmlFor="editar-categoria">Categoria</label>
              <input
                id='editar-categoria'
                type="text"
                value={recompensaEditando.categoria}
                onChange={(e) => setRecompensaEditando({
                  ...recompensaEditando,
                  categoria: e.target.value
                })}
              />

              <label htmlFor="editar-estado">Estado</label>
              <select
                id="editar-estado"
                value={recompensaEditando.estado}
                onChange={(e) => setRecompensaEditando({
                  ...recompensaEditando,
                  estado: e.target.value
                })}
              >

                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>

              <button type='submit' disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>

              <button
                type='button'
                onClick={() => setRecompensaEditando(null)}
                disabled={guardandoEdicion}
              >
                Cancelar edicion
              </button>
            </form>
          )}

          {misRecompensas.length === 0 ? (
            <p>Este comercio todavia no tiene recompensas registradas.</p>
          ) : (
            <div className='comercio-recompensas-grid'>
              {misRecompensas.map((recompensa) => (
                <div
                  key={recompensa.id}
                  className='comercio-recompensa-card'
                >
                  <span>{recompensa.categoria}</span>

                  <h3>{recompensa.nombre}</h3>

                  <p>{recompensa.descripcion}</p>

                  <p>
                    <strong>{recompensa.puntos_requeridos}</strong> Ecopuntos
                  </p>

                  <p>
                    Disponibles:{recompensa.cantidad_disponible}
                  </p>

                  <p>Estado:{recompensa.estado}</p>

                  <button
                    type='button'
                    onClick={() => editarRecompensa(recompensa)}
                    disabled={datosComercio?.estado_validacion !== 'Aprobado'}
                  >
                    Editar recompensa
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className='comercio-validacion'>
          <div className='comercio-validacion-encabezado'>
            <span>Gestion de beneficios</span>
            <h2>Validar canje</h2>

            <p>
              Ingresa el documento del ciudadano y su codigo,
              para consultar y confirmar la recompensa.
            </p>
          </div>

          <label>tipo de documento</label>
          <select
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
          >
            <option value="">Seleccione</option>
            <option value="CC">CC</option>
            <option value="TI">TI</option>
            <option value="CE">CE</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>

          <label>Numero de documento</label>
          <input
            type="text"
            value={numeroDocumento}
            onChange={(e) => setNumeroDocumento(e.target.value)}
            placeholder='Numero de coumento'
          />

          <label>Codigo de canje</label>
          <input type="text"
            value={codigoCanje}
            onChange={(e) => setCodigoCanje(e.target.value)}
            placeholder='Codigo de 6 digitos'
          />
          <button onClick={buscarCanje}>
            Validar canje
          </button>

          {canjeEncontrado && (
            <div>

              <h3>Canje encontrado</h3>

              <p>
                Ciudadano: {canjeEncontrado.nombre_ciudadano}
              </p>

              <p>
                Recompensa: {canjeEncontrado.nombre_recompensa}
              </p>

              <p>
                EcoPunto utilizados: {canjeEncontrado.puntos_canje}
              </p>

              <p>
                Estado: {canjeEncontrado.estado_canje}
              </p>

              {canjeEncontrado.estado_canje === 'Pendiente' && (

                <button
                  onClick={confirmarCanje}
                  disabled={confirmandoCanje}
                >
                  {confirmandoCanje ? 'Confirmando...' : 'Confirmar canje'}
                </button>
              )}
            </div>
          )}
          {mensaje && (
            <p>{mensaje}</p>
          )}
        </section>
        <section className='comercio-historial'>
          <div className='comercio-historial-encabezado'>
            <h2>Historial de canjes</h2>
            <p>Consulta las recompensas utilizadas en tu comercio</p>
          </div>

          {historialCanjes.length === 0 ? (
            <p>Todavia no hay canjes confirmados</p>
          ) : (
            <div className='comercio-tabla-contenedor'>
              <table className='comercio-tabla'>
                <thead>
                  <tr>
                    <th>Recompensas</th>
                    <th>Ecopuntos</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {historialCanjes.map((canje) => (
                    <tr key={canje.canje_id}>
                      <td>{canje.nombre_recompensa}</td>
                      <td>{canje.canje_recompensa}</td>
                      <td>{canje.puntos_utilizados}</td>
                      <td>
                        {new Date(canje.fecha_canje).toLocaleDateString('es-CO')}
                      </td>
                      <td>
                        <span className='comercio-estado.canje'>
                          {canje.estado_canje}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Comercio
