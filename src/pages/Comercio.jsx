import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

function Comercio({ perfil, cerrarSesion }) {
  const [pestanaActiva, setPestanaActiva] = useState('inicio')
  const pestanasComercio = [
    { id: 'inicio', nombre: 'Inicio' },
    { id: 'beneficios', nombre: 'Beneficios' },
    { id: 'canjes', nombre: 'Canjes' },
    { id: 'historial', nombre: 'Historial' },
    { id: 'perfil', nombre: 'Perfil' }
  ]
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [codigoCanje, setCodigoCanje] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [comercioId, setComercioId] = useState(null)
  const [canjeEncontrado, setCanjeEncontrado] = useState(null)
  const [confirmandoCanje, setConfirmandoCanje] = useState(false)
  const [buscandoCanje, setBuscandoCanje] = useState(false)
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
  const [fotoNueva, setFotoNueva] = useState(null)
  const [fotoEdicion, setFotoEdicion] = useState(null)
  const [vistaNueva, setVistaNueva] = useState('')
  const [vistaEdicion, setVistaEdicion] = useState('')
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [nombrePerfil, setNombrePerfil] = useState('')
  const [fotoPerfil, setFotoPerfil] = useState(null)
  const [vistaFotoPerfil, setVistaFotoPerfil] = useState('')
  const [fotoPerfilFirmada, setFotoPerfilFirmada] = useState('')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState('')

  const seleccionarFoto = (archivo, edicion = false) => {
    if (!archivo) return
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(archivo.type)) {
      setMensajeRecompensa('Selecciona una imagen JPG, PNG o JPEG')
      return
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setMensajeRecompensa('La fotografia no puede superar 5 MB')
      return
    }
    const lector = new FileReader()
    lector.onload = () => {
      if (edicion) {
        setFotoEdicion(archivo)
        setVistaEdicion(String(lector.result))
      } else {
        setFotoNueva(archivo)
        setVistaNueva(String(lector.result))
      }
      setMensajeRecompensa('')
    }
    lector.readAsDataURL(archivo)
  }

  const subirFotoRecompensa = async (archivo) => {
  if (!archivo) return null

  if (!datosComercio?.id) {
    throw new Error('No se identificó el comercio')
  }

  const formatos = ['image/jpeg', 'image/png', 'image/webp']

  if (!formatos.includes(archivo.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP')
  }

  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error('La fotografía no puede superar 5 MB')
  }

  const formulario = new FormData()
  formulario.append('file', archivo)
  formulario.append('upload_preset', 'ecocycle_rewards')

  const respuesta = await fetch(
    'https://api.cloudinary.com/v1_1/kncy2koo/image/upload',
    {
      method: 'POST',
      body: formulario
    }
  )

  const resultado = await respuesta.json()

  if (!respuesta.ok || !resultado.secure_url) {
    throw new Error(
      resultado.error?.message || 'No se pudo cargar la fotografía'
    )
  }

  return {
    url: resultado.secure_url,
    publicId: resultado.public_id
  }
}

  const limpiarFotoNueva = () => {
    setFotoNueva(null)
    setVistaNueva('')
  }

  const limpiarFotoEdicion = () => {
    setFotoEdicion(null)
    setVistaEdicion('')
  }

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
      categoria,
      imagen_url
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

  useEffect(() => {
    if (pestanaActiva === 'historial') cargarHistorialCanjes()
  }, [pestanaActiva])

  const buscarCanje = async () => {
    if (buscandoCanje || confirmandoCanje) return
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

    setBuscandoCanje(true)
    try {
      const { data, error } = await supabase.rpc(
        'buscar_canje_comercio',
        {
          p_tipo_documento: tipoDocumento,
          p_numero_documento: numeroDocumento.trim(),
          p_codigo_canje: codigoCanje.trim()
        }
      )
      if (error) throw error
      if (!data?.length) {
        setMensaje('No se encontró un canje válido con estos datos.')
        return
      }
      setCanjeEncontrado(data[0])
    } catch (error) {
      console.error('Error al buscar canje:', error)
      setMensaje('No fue posible consultar el canje. Intenta nuevamente.')
    } finally {
      setBuscandoCanje(false)
    }
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

    let fotoSubida = null
    try {
      fotoSubida = await subirFotoRecompensa(fotoNueva)
      const { error } = await supabase.rpc('crear_recompensa_comercio', {
        p_nombre: nuevasRecompensas.nombre.trim(),
        p_descripcion: nuevasRecompensas.descripcion.trim(),
        p_puntos_requeridos: puntos,
        p_cantidad_disponible: cantidad,
        p_categoria: nuevasRecompensas.categoria.trim() || null,
        p_imagen_url: fotoSubida?.url || null
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
      limpiarFotoNueva()
      setMensajeRecompensa('Recompensa creada correctamente')
    } catch (error) {
      console.error('Error al crear recompensa:', error)
      setMensajeRecompensa(`No fue posible crear la recompensa: ${error.message || 'Error desconocido'}`)
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
      estado: recompensa.estado,
      imagen_url: recompensa.imagen_url || null
    })
    limpiarFotoEdicion()

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

    let fotoSubida = null
    try {
      fotoSubida = await subirFotoRecompensa(fotoEdicion)
      const { data, error } = await supabase.rpc(
        'actualizar_recompensa_comercio',
        {
          p_recompensa_id: recompensaEditando.id,
          p_nombre: recompensaEditando.nombre.trim(),
          p_descripcion: recompensaEditando.descripcion.trim(),
          p_puntos_requeridos: puntos,
          p_categoria: recompensaEditando.categoria.trim(),
          p_estado: recompensaEditando.estado,
          p_imagen_url: fotoSubida?.url || recompensaEditando.imagen_url || null
        }
      )

      if (error) throw error
      if (!data) {
        throw new Error('La recompensa no puedo actualiziarse')
      }
      await cargarMisRecompensas(datosComercio.id)

      setRecompensaEditando(null)
      limpiarFotoEdicion()
      setMensajeRecompensa('Recompensa actualizada correctamente')
    } catch (error) {
      console.error('Error al actualizar recompensa:', error)
      
      setMensajeRecompensa(`No fue posible actualizar la recompensa: ${error.message || 'Error desconocido'}`)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const cargarFotoPerfil = async () => {
    const { data: usuario, error } = await supabase
      .from('usuario')
      .select('foto_perfil_url')
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('No se pudo consultar la fotografía de perfil:', error)
      return
    }

    if (!usuario?.foto_perfil_url) {
      setFotoPerfilFirmada('')
      return
    }
    if (
  usuario.foto_perfil_url.startsWith(
    'https://res.cloudinary.com/kncy2koo/'
    )
    ) {
      setFotoPerfilFirmada(usuario.foto_perfil_url)
      return
    }
    
    let ruta = usuario.foto_perfil_url

    if (ruta.includes('/storage/v1/object/')) {
      const marcador = '/foto-perfil/'
      const posicion = ruta.indexOf(marcador)
      if (posicion === -1) {
        setFotoPerfilFirmada('')
        return
      }
      ruta = decodeURIComponent(ruta.slice(posicion + marcador.length).split('?')[0])
    }

    const { data, error: errorFirma } = await supabase.storage
      .from('foto-perfil')
      .createSignedUrl(ruta, 3600)

    if (errorFirma) {
      console.error('No se pudo obtener la fotografía privada:', errorFirma)
      setFotoPerfilFirmada('')
      return
    }

    setFotoPerfilFirmada(data?.signedUrl || '')
  }

  useEffect(() => {
    if (perfil?.id) cargarFotoPerfil()
  }, [perfil?.id])

  const seleccionarFotoPerfil = (archivo) => {
    if (!archivo) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      setMensajePerfil('Selecciona una fotografía JPG, PNG o WebP.')
      return
    }

    if (archivo.size > 5 * 1024 * 1024) {
      setMensajePerfil('La fotografía no puede superar los 5 MB.')
      return
    }

    const lector = new FileReader()
    lector.onload = () => {
      setFotoPerfil(archivo)
      setVistaFotoPerfil(String(lector.result))
      setMensajePerfil('')
    }
    lector.onerror = () => setMensajePerfil('No se pudo leer la fotografía.')
    lector.readAsDataURL(archivo)
  }

  const iniciarEdicionPerfil = () => {
    setNombrePerfil(datosComercio?.nombre_comercio || '')
    setFotoPerfil(null)
    setVistaFotoPerfil('')
    setMensajePerfil('')
    setEditandoPerfil(true)
  }

  const cancelarEdicionPerfil = () => {
    setEditandoPerfil(false)
    setFotoPerfil(null)
    setVistaFotoPerfil('')
    setMensajePerfil('')
  }

  const subirFotoPerfil = async (archivo) => {
  if (!archivo) return null

  const formatos = ['image/jpeg', 'image/png', 'image/webp']

  if (!formatos.includes(archivo.type)) {
    throw new Error('Selecciona una fotografía JPG, PNG o WebP.')
  }

  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error('La fotografía no puede superar los 5 MB.')
  }

  const formulario = new FormData()
  formulario.append('file', archivo)
  formulario.append('upload_preset', 'ecocycle_profiles')

  const respuesta = await fetch(
    'https://api.cloudinary.com/v1_1/kncy2koo/image/upload',
    {
      method: 'POST',
      body: formulario
    }
  )

  const resultado = await respuesta.json()

  if (!respuesta.ok || !resultado.secure_url) {
    throw new Error(
      resultado.error?.message || 'No se pudo cargar la fotografía.'
    )
  }

  return resultado.secure_url
}

  const guardarPerfilComercio = async (evento) => {
    evento.preventDefault()
    if (guardandoPerfil) return

    const nombre = nombrePerfil.trim()
    if (!nombre) {
      setMensajePerfil('Ingresa el nombre del establecimiento.')
      return
    }

    setGuardandoPerfil(true)
    setMensajePerfil('')
    let rutaSubida = null
    

    try {
      if (fotoPerfil) {
        rutaSubida = await subirFotoPerfil(fotoPerfil)
      }

      const { data, error } = await supabase.rpc('actualizar_perfil_comercio', {
        p_nombre_comercio: nombre,
        p_foto_perfil_url: rutaSubida
      })

      if (error) throw error
      if (data !== true) throw new Error('No se confirmó la actualización del perfil.')
      

      setDatosComercio(actual => ({ ...actual, nombre_comercio: nombre }))
      setEditandoPerfil(false)
      setFotoPerfil(null)
      setVistaFotoPerfil('')
      setMensajePerfil('Perfil actualizado correctamente.')

      try {
        await cargarFotoPerfil()
      } catch (errorFoto) {
        console.error('Perfil guardado, pero no se pudo actualizar la vista de la fotografía:', errorFoto)
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error)
    
      setMensajePerfil(`No fue posible actualizar el perfil: ${error.message || 'Error desconocido'}`)
    } finally {
      setGuardandoPerfil(false)
    }
  }

  return (
    <div className="comercio-pagina">
      <div className="comercio-panel">
        <header className='comercio-header'>
          <div className='eco-reciclador-marca'>
            <img
              src={logoEcocycle}
              alt='EcoCycle'
              className="eco-reciclador-logo"
            />
          </div>
        </header>
        <nav className="comercio-navegacion-movil" aria-label="Navegación del comercio">
          {pestanasComercio.map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={pestanaActiva === pestana.id ? 'activo' : ''}
              aria-current={pestanaActiva === pestana.id ? 'page' : undefined}
              onClick={() => {
                setPestanaActiva(pestana.id)
              }}
            >
              <span>{pestana.nombre}</span>
            </button>
          ))}
        </nav>

        {pestanaActiva === 'inicio' && (
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
        )}

        {pestanaActiva === 'beneficios' && (
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

                <label
                  htmlFor="recompensa-foto"
                >
                  Fotografia del producto (opcional)
                </label>
                <input id="recompensa-foto" type="file" accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => seleccionarFoto(e.target.files?.[0])} />

                {vistaNueva && <img src={vistaNueva} alt="Vista previa del producto" style={{ width: '100%', maxWidth: 260, borderRadius: 12, objectFit: 'cover' }} />}
                {vistaNueva && <button type="button" onClick={limpiarFotoNueva}>Quitar fotografia seleccionada</button>}

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

                <label htmlFor="editar-foto">Fotografia de la recompensa</label>
                {(vistaEdicion || recompensaEditando.imagen_url) && (
                  <img
                    src={vistaEdicion || recompensaEditando.imagen_url}
                    alt="Fotografia de la recompensa"
                    style={{
                      width: '100%',
                      maxWidth: 260,
                      borderRadius: 12,
                      objectFit: 'cover'
                    }}
                  />
                )}

                <input
                  id="editar-camara"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => seleccionarFoto(e.target.files?.[0], true)}
                />

                {vistaEdicion &&
                  <button
                    type="button"
                    onClick={limpiarFotoEdicion}
                  >
                    Conservar fotografia anterior
                  </button>}

                <button
                  type='submit'
                  disabled={guardandoEdicion}
                >
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
              <p>Este comercio todavia no tiene recompensas registradas</p>
            ) : (
              <div className='comercio-recompensas-grid'>
                {misRecompensas.map((recompensa) => (
                  <div
                    key={recompensa.id}
                    className='comercio-recompensa-card'
                  >
                    {recompensa.imagen_url ? (
                      <img
                        className='eco-comercio-recompensa-imagen'
                        src={recompensa.imagen_url}
                        alt={recompensa.nombre}
                        loading="lazy"
                        style={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          objectFit: 'cover',
                          borderRadius: 12
                        }}
                      />
                    ) : (
                      <div
                        className='eco-comercio-sin-imagen'
                        style={{
                          padding: 24,
                          textAlign: 'center',
                          background: '#edf3f4',
                          borderRadius: 12
                        }}
                      >
                        Sin fotografía
                      </div>
                    )}
                    {recompensa.categoria && <span className='eco-comercio-categoria'>{recompensa.categoria}</span>}

                    <h3>{recompensa.nombre}</h3>

                    <p>{recompensa.descripcion}</p>

                    <p>
                      <strong>{recompensa.puntos_requeridos}</strong> Ecopuntos
                    </p>

                    <p>
                      Disponibles:{recompensa.cantidad_disponible}
                    </p>

                    <span className={`eco-comercio-recompensa-estado ${recompensa.estado === 'Activa' ? 'activa' : 'inactiva'}`}>{recompensa.estado}</span>

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
        )}

        {pestanaActiva === 'canjes' && (
          <section className='comercio-validacion'>
            <div className='comercio-validacion-encabezado'>
              <span>Gestión de beneficios</span>
              <h2>Validar canje</h2>
              <p>Ingresa los datos del ciudadano y el código de seis dígitos para comprobar la recompensa antes de entregarla.</p>
            </div>
            <div className='eco-comercio-canje-campos'>
              <div>
                <label htmlFor='comercio-tipo-documento'>Tipo de documento</label>
                <select id='comercio-tipo-documento' value={tipoDocumento}
                  disabled={confirmandoCanje || buscandoCanje}
                  onChange={(e) => { setTipoDocumento(e.target.value); setCanjeEncontrado(null); setMensaje('') }}>
                  <option value=''>Selecciona un documento</option>
                  <option value='CC'>CC</option>
                  <option value='TI'>TI</option>
                  <option value='CE'>CE</option>
                  <option value='PASAPORTE'>Pasaporte</option>
                </select>
              </div>
              <div>
                <label htmlFor='comercio-numero-documento'>Número de documento</label>
                <input id='comercio-numero-documento' type='text' inputMode='numeric'
                  autoComplete='off' value={numeroDocumento} disabled={confirmandoCanje || buscandoCanje}
                  onChange={(e) => { setNumeroDocumento(e.target.value); setCanjeEncontrado(null); setMensaje('') }}
                  placeholder='Número de documento' />
              </div>
              <div>
                <label htmlFor='comercio-codigo-canje'>Código de canje</label>
                <input id='comercio-codigo-canje' type='text' inputMode='numeric'
                  maxLength={6} autoComplete='off' value={codigoCanje}
                  disabled={confirmandoCanje || buscandoCanje}
                  onChange={(e) => { setCodigoCanje(e.target.value.replace(/\D/g, '').slice(0, 6)); setCanjeEncontrado(null); setMensaje('') }}
                  placeholder='6 dígitos' />
              </div>
            </div>
            <button type='button' className='eco-comercio-validar-boton'
              disabled={buscandoCanje || confirmandoCanje || !tipoDocumento || !numeroDocumento.trim() || codigoCanje.length !== 6}
              onClick={buscarCanje}>
              {buscandoCanje ? 'Consultando...' : 'Buscar canje'}
            </button>
            {canjeEncontrado && (
              <div className='comercio-canje-detalle'>
                <div className='eco-comercio-canje-cabecera'>
                  <h3>Canje encontrado</h3>
                  <span className={`eco-comercio-estado ${canjeEncontrado.estado_canje === 'Pendiente' ? 'pendiente' : 'canjeado'}`}>
                    {canjeEncontrado.estado_canje}
                  </span>
                </div>
                <div className='eco-comercio-canje-dato'><span>Ciudadano</span><strong>{canjeEncontrado.nombre_ciudadano}</strong></div>
                <div className='eco-comercio-canje-dato'><span>Recompensa</span><strong>{canjeEncontrado.nombre_recompensa}</strong></div>
                <div className='eco-comercio-canje-dato'><span>EcoPuntos utilizados</span><strong>{canjeEncontrado.puntos_canje}</strong></div>
                {canjeEncontrado.estado_canje === 'Pendiente' && (
                  <button type='button' onClick={confirmarCanje} disabled={confirmandoCanje}>
                    {confirmandoCanje ? 'Confirmando...' : 'Confirmar entrega del beneficio'}
                  </button>
                )}
              </div>
            )}
            {mensaje && <p className='comercio-canje-mensaje' role='status'>{mensaje}</p>}
          </section>
        )}

        {pestanaActiva === 'historial' && (
          <section className='comercio-historial'>
            <div className='comercio-historial-encabezado'>
              <h2>Historial de canjes</h2>
              <p>Consulta las recompensas utilizadas en tu comercio.</p>
            </div>
            {historialCanjes.length === 0 ? (
              <div className='eco-comercio-historial-vacio'>Todavía no hay canjes registrados.</div>
            ) : (
              <div className='eco-comercio-historial-lista'>
                {historialCanjes.map((canje) => (
                  <article className='eco-comercio-historial-tarjeta' key={canje.canje_id}>
                    <div className='eco-comercio-historial-superior'>
                      <div>
                        <span className='eco-comercio-historial-etiqueta'>Recompensa</span>
                        <h3>{canje.nombre_recompensa}</h3>
                      </div>
                      <span className='comercio-estado-canje'>{canje.estado_canje}</span>
                    </div>
                    <div className='eco-comercio-historial-datos'>
                      <div><span>EcoPuntos utilizados</span><strong>{canje.puntos_utilizados}</strong></div>
                      <div><span>Fecha</span><strong>{canje.fecha_canje ? new Date(canje.fecha_canje).toLocaleDateString('es-CO') : 'No disponible'}</strong></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {pestanaActiva === 'perfil' && (
          <section className="comercio-perfil-movil">
            <h2>Mi establecimiento</h2>

            <div className="comercio-perfil-avatar" style={{ overflow: 'hidden' }}>
              {vistaFotoPerfil || fotoPerfilFirmada ? (
                <img
                  src={vistaFotoPerfil || fotoPerfilFirmada}
                  alt="Fotografía del establecimiento"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (datosComercio?.nombre_comercio || perfil?.nombre || 'C').charAt(0).toUpperCase()
              )}
            </div>

            {mensajePerfil && <p role="status">{mensajePerfil}</p>}

            {editandoPerfil ? (
              <form onSubmit={guardarPerfilComercio} className="comercio-formulario-recompensa">
                <label htmlFor="comercio-nombre-perfil">Nombre del establecimiento</label>
                <input
                  id="comercio-nombre-perfil"
                  type="text"
                  value={nombrePerfil}
                  maxLength={100}
                  required
                  onChange={(e) => setNombrePerfil(e.target.value)}
                />

                <label htmlFor="comercio-foto-perfil">Cambiar fotografia</label>
                <input
                  id="comercio-foto-perfil"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => seleccionarFotoPerfil(e.target.files?.[0])}
                />

                {vistaFotoPerfil && (
                  <button type="button" onClick={() => {
                    setFotoPerfil(null)
                    setVistaFotoPerfil('')
                  }}>
                    Conservar fotografia anterior
                  </button>
                )}

                <label>Correo electronico</label>
                <p>{perfil?.correo || 'No disponible'}</p>

                <button
                  type="submit"
                  disabled={guardandoPerfil}
                >
                  {guardandoPerfil ? 'Guardando...' : 'Guardar cambios'}
                </button>

                <button
                  type="button"
                  onClick={cancelarEdicionPerfil}
                  disabled={guardandoPerfil}
                  className='comercio-boton-salir'
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <label>Nombre del establecimiento</label>
                <p>{datosComercio?.nombre_comercio || 'Sin registrar'}</p>

                <label>Correo electronico</label>
                <p>{perfil?.correo || 'No disponible'}</p>

                <button
                  type="button"
                  onClick={iniciarEdicionPerfil}
                >
                  Editar perfil
                </button>
                <button
                  type="button"
                  className='comercio-boton-salir'
                  onClick={cerrarSesion}
                >
                  Cerrar sesion
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default Comercio