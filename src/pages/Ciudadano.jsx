import { useState } from 'react'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import MapaReciclaje from '../components/MapaReciclaje'

import paperyus from '../assets/personajes/paperyus.png'
import ferrax from '../assets/personajes/ferrax.png'
import flurosil from '../assets/personajes/flurosil.png'
import polaris from '../assets/personajes/polaris.png'
import tetrax from '../assets/personajes/tetrax.png'
import voltaje from '../assets/personajes/voltaje.png'
import logoEcocycle from '../assets/ecocycle-logo.png'
import { Evented } from 'leaflet'
import { validarTelefonoColombiano } from '../utils/validaciones'

const imagenesMateriales = {
  papel: paperyus,
  plastico: polaris,
  carton: tetrax,
  vidrio: flurosil,
  'metales y latas': ferrax,
  'pilas y baterias': voltaje
}

const normalizarMaterial = (nombre) =>
  (nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function Ciudadano({ perfil, cerrarSesion }) {
  const [pestanaActiva, setPestanaActiva] = useState('inicio')
  const [materiales, setMateriales] = useState([])
  const [materialSeleccionado, setMaterialSeleccionado] = useState(null)
  const [recicladores, setRecicladores] = useState([])
  const [recicladorSeleccionado, setRecicladorSeleccionado] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [ciudadanoId, setCiudadanoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [entregas, setEntregas] = useState([])
  const [recompensas, setRecompensas] = useState([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todos')
  const [ultimoCanje, setUltimoCanje] = useState(null)
  const [saldoEcopuntos, setSaldoEcopuntos] = useState(perfil.ecopuntos)
  const [recompensaCanjeando, setRecompensaCanjeando] = useState(null)

  const [nombreMostrado, setNombreMostrado] = useState(perfil.nombre || '')

  const [datosPerfil, setDatosPerfil] = useState({
    nombre: perfil.nombre || '',
    correo: perfil.correo || '',
    telefono: '',
    fecha_nacimiento: '',
    foto_perfil_url: null
  })

  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState('')
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null)
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState(null)
  const [fotoActual, setFotoActual] = useState(null)

  const videosEducativos =[
    {
      id:'paperyus',
      personaje: 'Paperyus',
      material: 'Papel',
      descripcion: 'Aprende a separar y preparar el papel para reciclarlo',
      imagen: paperyus,
      url: 'https://www.youtube.com/watch?v=F9w85cYCnkM' 
    },

    {
      id:'Tetrax',
      personaje: 'Tetrax',
      material: 'Carton',
      descripcion: 'Descubre como aprovechar y reciclar el carton',
      imagen: tetrax,
      url: 'https://www.youtube.com/watch?v=dUKOHLl-vHg'
    },
    {
      id:'Polaris',
      personaje: 'Polaris',
      material: 'Plastico',
      descripcion: 'Aprende a reconocer y seprar residuos plasticos',
      imagen: polaris,
      url:'https://www.youtube.com/watch?v=AXpnghigdkU'
    },
    {
      id:'Flurosil',
      personaje: 'Flurosil',
      material: 'Vidrio',
      descripcion: 'Conoce como entregar adecuadamente los envases de vidrio',
      imagen: flurosil,
      url: 'https://www.youtube.com/watch?v=zof_Kw9aW8I'
    }, 
    {
      id:'Voltaje',
      personaje: 'Voltaje',
      material: 'Pilas y baterias',
      descripcion: 'Aprende para que sirven las pilas y como reciclarlas',
      imagen: voltaje,
      url: 'https://www.youtube.com/watch?v=pDnRzqEFSMs'
    },
    {
      id:'ferrax',
      personaje: 'Ferrax',
      material: 'Latas y metales',
      descripcion: 'Aprende a separar las latas y otros residuos etalicos',
      imagen: ferrax,
      url: 'https://www.youtube.com/watch?v=OJHAUWLSi_E'
    }
  ]

  const cargarMateriales = async () => {

    const { data, error } = await supabase
      .from('material')
      .select('*')

    if (error) {
      console.error('Error al cargar materiales:', error)
      return
    }

    setMateriales(data)
  }

  const cargarCiudadano = async () => {

    const { data, error } = await supabase
      .from('ciudadano')
      .select('id')
      .eq('usuarioid', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar ciudadano:', error)
      return
    }

    setCiudadanoId(data.id)
    cargarEntregas(data.id)
  }

  const cargarEntregas = async (idCiudadano) => {

    const { data, error } = await supabase
      .from('entrega')
      .select(`
      id,
      cantidad,
      puntos_obtenidos,
      estado,
      motivo_rechazo,
      fecha,
      material(
        nombre
      )
    `)
      .eq('ciudadanoid', idCiudadano)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('Error al cargar entregas del ciudadano:', error)
      return
    }

    setEntregas(data)
    console.log('Historial de entregas:', data)
  }

  const cargarRecompensas = async () => {

    const { data, error } = await supabase
      .from('recompensas')
      .select(`
      id,
      nombre,
      descripcion,
      puntos_requeridos,
      cantidad_disponible,
      estado,
      comercioid,
      categoria,
      imagen_url
    `)
      .eq('estado', 'Activa')

    if (error) {
      console.error('Error al cargar recompensas:', error)
      return
    }

    setRecompensas(data)
    console.log('Recompensas disponibles:', data)
  }

  const cargarSaldoEcopuntos = async () => {

    const { data, error } = await supabase
      .from('usuario')
      .select('ecopuntos')
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar Ecopuntos', error)
      return
    }

    setSaldoEcopuntos(data.ecopuntos)
  }

  const cargarRecicladores = async (materialId) => {
    const { data, error } = await supabase
      .from('material_reciclador')
      .select(`
      recicladorid,
      reciclador(
      id,
      nombre_centro,
      direccion,
      ciudad,
      latitud,
      longitud
      )
    `)
      .eq('materialid', materialId)

    if (error) {
      console.error('Error al cargar recicladroes:', error)
      return
    }

    setRecicladores(data)
    console.log('Recicladores encontrados:', data)
  }

  const registrarEntrega = async () => {
    setMensaje('')

    if (!materialSeleccionado || !recicladorSeleccionado || !cantidad) {
      setMensaje('Debes seleccionar material, centro y cantidad')
      return
    }

    if (Number(cantidad) <= 0) {
      setMensaje('La cantidad debe ser mayor que cero')
      return
    }

    const { data, error } = await supabase.rpc(
      'registrar_entrega_ciudadano',
      {
        p_material_id: materialSeleccionado.id,
        p_reciclador_id: recicladorSeleccionado.id,
        p_cantidad: Number(cantidad)
      }
    )

    if (error) {
      console.error('Error al registrar entrega:', error)
      setMensaje('No fue posible registrar la entrega')
      return
    }

    console.log('Entrega registrada con ID:', data)
    setMensaje('Entrega registrada correctamente')

    setCantidad('')
    setRecicladorSeleccionado(null)

    cargarEntregas(ciudadanoId)
  }

  const realizarCanje = async (recompensa) => {

    if (recompensaCanjeando !== null) return

    setMensaje('')

    if (recompensa.cantidad_disponible <= 0) {
      setMensaje('Esta recompensa no tiene unidades disponibles')
      return
    }

    if (saldoEcopuntos < recompensa.puntos_requeridos) {
      setMensaje('No tiene Ecopuntos suficientes')
      return
    }

    try {
      setRecompensaCanjeando(recompensa.id)

      const { data, error } = await supabase.rpc(
        'realizar_canje_ciudadano',
        {
          p_recompensa_id: recompensa.id
        }
      )


      if (error) {
        console.error('Error al realizar canje:', error)

        if (error.message.includes('stock')) {
          setMensaje('La recompensa ya no tiene unidades disponibles')
        } else if (error.message.includes('Ecopuntos insuficiente')) {
          setMensaje('No tienes Ecopuntos suficientes')
        } else {
          setMensaje('No fue posible realizar canje')
        }
        return
      }

      if (!data || data.length === 0) {
        setMensaje('No fue posible realizar el canje')
        return
      }

      console.log('Canje realizado:', data)

      setUltimoCanje({
        ...data[0],
        nombre_recompensa: recompensa.nombre
      })

      setMensaje('Canje realizado correctamente')

      await cargarSaldoEcopuntos()
      await cargarRecompensas()

    } finally {
      setRecompensaCanjeando(null)
    }
  }

  const cargarDatosPerfil = async () => {
    const { data, error } = await supabase
      .from('usuario')
      .select(`
      nombre,
      correo,
      telefono,
      fecha_nacimiento,
      foto_perfil_url
    `)
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Errore al cargar perfil:', error)
      setMensajePerfil('No se pudo cargar tu perfil')
      return
    }

    setNombreMostrado(data.nombre || '')
    setDatosPerfil({
      nombre: data.nombre || '',
      correo: data.correo || '',
      telefono: data.telefono || '',
      foto_perfil_url: data.foto_perfil_url || null
    })

    if (data.foto_perfil_url) {
      const { data: imagen, error: errorImagen } =
        await supabase.storage
          .from('foto-perfil')
          .createSignedUrl(data.foto_perfil_url, 3600)

      if (!errorImagen && imagen?.signedUrl) {
        setFotoActual(imagen.signedUrl)
      } else {
        setFotoActual(null)
      }
    } else {
      setFotoActual(null)
    }
  }

  const seleccionarFotoPerfil = (event) => {
    const archivo = event.target.files?.[0]

    if (!archivo) return

    const fomratoPermitidos = [
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]

    if (!fomratoPermitidos.includes(archivo.type)) {
      setMensajePerfil('Selecciona una imagen JPG o PNG')

      event.target.value = ''
      return
    }

    if (archivo.size > 2 * 1024 * 1024) {
      setMensajePerfil('La fotografia no puede superar los 2MB')

      event.target.value = ''
      return
    }

    if (fotoVistaPrevia) {
      URL.revokeObjectURL(fotoVistaPrevia)
    }

    setFotoSeleccionada(archivo)
    setFotoVistaPrevia(URL.createObjectURL(archivo))
    setMensajePerfil('')
  }

  const guardarCambiosPerfil = async () => {
    if (guardandoPerfil) return

    setMensajePerfil('')

    const nombre = datosPerfil.nombre.trim()
    const telefono = datosPerfil.telefono.trim()

    if (!nombre) {
      setMensajePerfil('Debes ingresar tu nombre')
      return
    }

    if (nombre.length > 30) {
      setMensajePerfil('El nombre es demasiado largo')
      return
    }

    if (telefono && !validarTelefonoColombiano(telefono)) {
      setMensajePerfil('Ingresa un celular valido')
      return
    }

    if (
      datosPerfil.fecha_nacimiento &&
      datosPerfil.fecha_nacimiento >
      new Date().toLocaleDateString('en-CA')
    ) {
      setMensajePerfil('Dato incorrecto')
      return
    }
    setGuardandoPerfil(true)

    let rutaFoto = datosPerfil.foto_perfil_url
    let rutaNuevaFoto = null

    try {
      const { data: autenticacion, error: errorAuth } =
        await supabase.auth.getUser()

      if (
        errorAuth ||
        !autenticacion.user ||
        autenticacion.user.id !== perfil.id
      ) {
        throw new Error(' No se pudo verificar tu sesion. Inicia sesion nuevamente.')
      }

      if (fotoSeleccionada) {
        const extensionPorTipo = {
          'image/jpeg': 'jpg',
          'image/jpeg': 'jpeg',
          'image/png': 'png'
        }

        const extension = extensionPorTipo[fotoSeleccionada.type]

        const nombreArchivo = `${crypto.randomUUID()}.${extension}`

        rutaNuevaFoto = `${perfil.id}/${nombreArchivo}`

        const { error: errorSubida } =
          await supabase.storage
            .from('foto-perfil')
            .upload(rutaNuevaFoto, fotoSeleccionada, {
              contentType: fotoSeleccionada.type,
              upsert: false
            })

        if (errorSubida) {
          throw errorSubida
        }

        rutaFoto = rutaNuevaFoto
      }

      const { error: errorActualizacion } =
        await supabase.rpc('actualizar_mi_perfil', {
          p_nombre: nombre,
          p_telefono: telefono || null,
          p_fecha_nacimiento:
            datosPerfil.fecha_nacimiento || null,
          p_foto_perfil_url: rutaFoto
        })

      if (errorActualizacion) {
        throw errorActualizacion
      }

      setNombreMostrado(nombre)
      await cargarDatosPerfil()

      setFotoSeleccionada(null)

      if (fotoVistaPrevia) {
        URL.revokeObjectURL(fotoVistaPrevia)
      }

      setFotoVistaPrevia(null)
      setEditandoPerfil(false)

      setMensajePerfil('Perfil actualizado correctamente')
    } catch (error) {
      console.error('Error al actualizar perfil:', error)

      if (rutaNuevaFoto) {
        const { error: errorLimpieza } =
          await supabase.storage
            .from('foto-perfil')
            .remove([rutaNuevaFoto])

        if (errorLimpieza) {
          console.error('No se pudo cargar la fotografia', errorLimpieza)
        }
      }

      setMensajePerfil(error.message || ' No se puedo actualizar el perfil')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const cancelarEdicionPerfil = () => {
    if (fotoVistaPrevia) {
      URL.revokeObjectURL(fotoVistaPrevia)
    }

    setFotoVistaPrevia(null)
    setFotoSeleccionada(null)
    setEditandoPerfil(false)
    setMensajePerfil('')

    cargarDatosPerfil()
  }

  useEffect(() => {
    cargarMateriales()
    cargarCiudadano()
    cargarRecompensas()
  }, [])

  useEffect(() => {
    cargarSaldoEcopuntos()
  }, [perfil.id])

  useEffect(() => {
    cargarDatosPerfil()
  }, [perfil.id])

  const abrirVideoEducativo = async (url) => {
    try{
      const { Capacitor } = await import('@capacitor/core')

      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url })
      } else {
        window.open(url, '_blank', 'noopener, noreferrer')
      }
    } catch (error) {
      console.error('No fue posible abrir el video:', error)
      window.location.href = url
    }
  }

  return (
    <div className="ciudadano-pagina">

      <header className="ciudadano-header">
        <div className="ciudadano-header-contenido">
          <img
            src={logoEcocycle}
            alt="EcoCycle"
            className="ciudadano-logo"
          />

          <div className="ciudadano-header-acciones">
            <span>{nombreMostrado}</span>
          </div>
        </div>
      </header>

      <main className="ciudadano-contenido">

        <nav
          className="eco-ciudadano-navegacion"
          aria-label="Navegacion del ciudadano"
        >
          {[
            { id: 'inicio', nombre: 'Inicio' },
            { id: 'reciclar', nombre: 'Reciclar' },
            { id: 'historial', nombre: 'Historial' },
            { id: 'beneficios', nombre: 'Beneficios' },
            { id: 'perfil', nombre: 'perfil' },
          ].map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={`eco-ciudadano-tab ${pestanaActiva === pestana.id ? 'activa' : ''
                }`}
              onClick={() => {
                setPestanaActiva(pestana.id)
                if (pestana.id === 'beneficios') {
                  cargarRecompensas()
                }
              }}
              aria-current={
                pestanaActiva === pestana.id ? 'page' : undefined
              }
            >
              {pestana.nombre}
            </button>
          ))}
        </nav>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'inicio'}
        >
          <section className="ciudadano-bienvenida">
            <div className="ciudadano-bienvenida-texto">
              <span className="ciudadano-etiqueta">
                Panel del ciudadano
              </span>

              <h1>Hola, {nombreMostrado}</h1>

              <p>
                Recicla, acumula EcoPuntos y obten beneficios
                mientras ayudas al planeta
              </p>
            </div>

            <div className="ciudadano-saldo">
              <div className="ciudadano-saldo-icono" />

              <div>
                <span>Mis EcoPuntos</span>
                <strong>{saldoEcopuntos}</strong>
                <small>Disponibles para canjear</small>
              </div>
            </div>
          </section>

           <section className='eco-educacion-preview'>
            <header className='eco-educacion-encabezado'>
                <span>Aprende con EcoCycle</span>
                <h2>¿Sabes como reciclar?</h2>
                <p>
                  Conoce nuestros superheroes y aprende a separa 
                  correctamente tus residuos reciclables
                </p>
              </header>

              <div className='eco-educacion-grid'>
                {videosEducativos.map((video) => (
                  <article key={video.id} className='eco-educacion-card'>
                    <div className='eco-educacion-card-imagen'>
                      <img 
                        src={video.imagen} 
                        alt={`Personaje ${video.personaje}`}
                        loading='lazy'
                      />
                    </div>

                    <div className='eco-educacion-card-contenido'>
                      <span>{video.material}</span>
                      <h3>{video.personaje}</h3>
                      <p>{video.descripcion}</p>

                      <button
                        type='button'
                        className='eco-educacion-boton'
                        onClick={() => abrirVideoEducativo(video.url)}
                      >
                        Ver video
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
        </div>

        {mensaje && (
          <div className="ciudadano-mensaje">
            {mensaje}
          </div>
        )}

        <div
          className='eco-ciudadano-vista'
          hidden={pestanaActiva !== 'aprender'}
        >
          <section className='eco-educacion-pagina'>
            <button
              type='button'
              className='eco-educacion-volver'
              onClick={() => setPestanaActiva('inicio')}
            >
              Volver al inicio
            </button>
          </section>
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'reciclar'}
        >
          <section className="ciudadano-seccion-materiales">
            <div className="ciudadano-seccion-titulo">
              <div>
                <span>Recicla y gana</span>
                <p>¿Que quieres reciclar?</p>
              </div>
            </div>

            <div className="ciudadano-material-grid">
              {materiales.map((material) => {
                const imagenMaterial =
                  imagenesMateriales[normalizarMaterial(material.nombre)]

                return (
                  <button
                    type="button"
                    key={material.id}
                    className={
                      materialSeleccionado?.id === material.id
                        ? 'ciudadano-material-card seleccionado'
                        : 'ciudadano-material-card'
                    }
                    onClick={() => {
                      setMaterialSeleccionado(material)
                      setRecicladorSeleccionado(null)
                      setCantidad('')
                      cargarRecicladores(material.id)
                    }}
                  >
                    <div className="ciudadano-material-icono">
                      {imagenMaterial ? (
                        <img
                          src={imagenMaterial}
                          alt={`Personaje de ${material.nombre}`}
                          className="ciudadano-personaje-imagen"
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">♻️</span>
                      )}
                    </div>

                    <div className="ciudadano-material-info">
                      <h3>{material.nombre}</h3>
                      <p>
                        <strong>{material.puntos_por_kilo}</strong>
                        {' '}EcoPuntos/kg
                      </p>
                    </div>

                    <div className="ciudadano-material-seleccionar">
                      {materialSeleccionado?.id === material.id
                        ? 'Seleccionado'
                        : 'Seleccionar'}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {materialSeleccionado && (
            <section className="ciudadano-centros">
              <div className="ciudadano-material-resumen">
                <div>
                  <span>Material seleccionado</span>
                  <strong>{materialSeleccionado.nombre}</strong>
                </div>

                <div>
                  <span>Valor</span>
                  <strong>
                    {materialSeleccionado.puntos_por_kilo} EcoPuntos/kg
                  </strong>
                </div>
              </div>

              <div className="ciudadano-seccion-titulo">
                <span>Paso 2</span>
                <h2>Encuentra donde reciclar</h2>
                <p>
                  Consulta los puntos de reciclaje disponibles para
                  este material y selecciona el que prefieras
                </p>
              </div>

              <div className="ciudadano-mapa-contenedor">
                <MapaReciclaje
                  recicladores={recicladores}
                  onSeleccionarCentro={setRecicladorSeleccionado}
                />
              </div>

              <div className="ciudadano-centros-grid">
                
                {recicladorSeleccionado && (
                  <div className="ciudadano-centro-card seleccionado eco-centro-resumen">
                    <div className="eco-centro-resumen-contenido">
                      <div>
                        <span className="eco-centro-resumen-etiqueta">
                          CENTRO SELECCIONADO
                        </span>
                        <h3>{recicladorSeleccionado.nombre_centro}</h3>
                        <p>{recicladorSeleccionado.ciudad}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="eco-centro-cambiar"
                      onClick={() => setRecicladorSeleccionado(null)}
                    >
                      Cambiar centro
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {recicladorSeleccionado && (
            <div>
              <label>Cantidad en kilogramos</label>

              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Ejemplo: 2.5"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />

              {cantidad > 0 && materialSeleccionado && (
                <div className="ciudadano-puntos-estimados">
                  <p>ECOPUNTOS</p>

                  <strong>
                    {Math.floor(
                      Number(cantidad) *
                      materialSeleccionado.puntos_por_kilo
                    )} EcoPuntos
                  </strong>

                  <span>
                    {cantidad} kg x{' '}
                    {materialSeleccionado.puntos_por_kilo} puntos/kg
                  </span>
                </div>
              )}
                              
              <div className="eco-entrega-aviso" role="note">
                <span aria-hidden="true"></span>
                <p>
                  Los EcoPuntos se sumaran a tu saldo cuando
                  el reciclador valide y apruebe la entrega
                </p>
              </div>

              <button
                type="button"
                className="ciudadano-entrega-boton"
                onClick={registrarEntrega}
              >
                Registrar entrega
              </button>
            </div>
          )}
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'historial'}
        >
          <section className="ciudadano-historial">
            <div className="ciudadano-historial-encabezado">
              <span>Mis reciclajes</span>
              <h2>Historial de entregas</h2>
              <p>Consulta el estado de tus materiales reciclados</p>
            </div>

            {entregas.length === 0 && (
              <div className="ciudadano-historial-vacio">
                <span aria-hidden="true">♻️</span>
                <p>Aun no tienes entregas registradas</p>
              </div>
            )}

            <div className="ciudadano-historial-lista">
              {entregas.map((entrega) => {
                const nombreMaterial =
                  entrega.material?.nombre || 'Material reciclable'

                const imagenMaterial =
                  imagenesMateriales[normalizarMaterial(nombreMaterial)]

                return (
                  <details
                    key={entrega.id}
                    className="ciudadano-historial-card"
                  >
                    <summary className="ciudadano-historial-resumen">
                      <div className="ciudadano-historial-icono">
                        {imagenMaterial ? (
                          <img
                            src={imagenMaterial}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span aria-hidden="true">♻️</span>
                        )}
                      </div>

                      <div className="ciudadano-historial-info">
                        <strong>{nombreMaterial}</strong>

                        <small>
                          {entrega.fecha
                            ? new Date(entrega.fecha)
                              .toLocaleDateString('es-CO')
                            : 'Fecha no disponible'}
                        </small>

                        <span
                          className={`ciudadano-historial-estado ${entrega.estado === 'Aprobado' ||
                            entrega.estado === 'Aprobada'
                            ? 'aprobada'
                            : entrega.estado === 'Rechazada'
                              ? 'rechazada'
                              : 'pendiente'
                            }`}
                        >
                          {entrega.estado}
                        </span>
                      </div>

                      <span
                        className="ciudadano-historial-flecha"
                        aria-hidden="true"
                      >
                        ⌄
                      </span>
                    </summary>

                    <div className="ciudadano-historial-detalles">
                      <div>
                        <span>Cantidad entregada</span>
                        <strong>{entrega.cantidad} kg</strong>
                      </div>

                      <div>
                        <span>
                          {entrega.estado === 'Aprobado' ||
                            entrega.estado === 'Aprobada'
                            ? 'EcoPuntos obtenidos'
                            : 'EcoPuntos registrados'}
                        </span>

                        <strong>
                          {entrega.puntos_obtenidos ?? 0}
                        </strong>
                      </div>

                      {entrega.estado === 'Rechazada' &&
                        entrega.motivo_rechazo && (
                          <div className="ciudadano-historial-rechazo">
                            <span>Motivo del rechazo</span>
                            <p>{entrega.motivo_rechazo}</p>
                          </div>
                        )}
                    </div>
                  </details>
                )
              })}
            </div>
          </section>
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'beneficios'}
        >
          <section className="ciudadano-beneficios">
            <div className="ciudadano-beneficios-encabezado">
              <div>
                <span>Canjea tus EcoPuntos</span>
                <h2>Beneficios para ti</h2>
                <p>Elige una recompensa y disfruta tus EcoPuntos</p>
              </div>
            </div>

            <div className="ciudadano-categorias">
              {['Todos', 'Mercado', 'Comida', 'Salud'].map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  className={
                    categoriaSeleccionada === categoria
                      ? 'ciudadano-categoria activa'
                      : 'ciudadano-categoria'
                  }
                  onClick={() => setCategoriaSeleccionada(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          </section>

          {recompensas.length === 0 && (
            <p>No hay recompensas disponibles</p>
          )}

          <div className="ciudadano-beneficios-grid">
            {recompensas
              .filter(
                (recompensa) =>
                  categoriaSeleccionada === 'Todos' ||
                  recompensa.categoria === categoriaSeleccionada
              )
              .map((recompensa) => {
                const sinStock =
                  recompensa.cantidad_disponible <= 0

                const puntosInsuficientes =
                  saldoEcopuntos < recompensa.puntos_requeridos

                const puntosFaltantes =
                  recompensa.puntos_requeridos - saldoEcopuntos

                console.log('Saldo:', saldoEcopuntos)
                console.log(
                  'Recompensa procesando:',
                  recompensaCanjeando
                )

                return (
                  <div
                    key={recompensa.id}
                    className="ciudadano-beneficio-card"
                  >
                    <div className="ciudadano-beneficio-imagen">
                      {recompensa.imagen_url ? (
                        <img
                          src={recompensa.imagen_url}
                          alt={recompensa.nombre}
                          loading="lazy"
                        />
                      ) : (
                        <span>♻️</span>
                      )}
                    </div>

                    <div className="ciudadano-beneficio-contenido">
                      {recompensa.categoria && (
                        <span className="ciudadano-beneficio-categoria">
                          {recompensa.categoria}
                        </span>
                      )}

                      <h3>{recompensa.nombre}</h3>
                      <p>{recompensa.descripcion}</p>

                      <div className="ciudadano-beneficio-datos">
                        <strong>
                          ♻️ {recompensa.puntos_requeridos} EcoPuntos
                        </strong>

                        <span>
                          {recompensa.cantidad_disponible} disponibles
                        </span>
                      </div>

                      {sinStock ? (
                        <button type="button" disabled>
                          Beneficio agotado
                        </button>
                      ) : puntosInsuficientes ? (
                        <button type="button" disabled>
                          Te faltan {puntosFaltantes} EcoPuntos
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => realizarCanje(recompensa)}
                          disabled={recompensaCanjeando !== null}
                        >
                          {recompensaCanjeando === recompensa.id
                            ? 'Procesando...'
                            : 'Canjear'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>

          {ultimoCanje && (
            <div className="ciudadano-canje-exitoso">
              <div className="ciudadano-canje-check"></div>

              <h2>Canje realizado correctamente</h2>
              <h3>{ultimoCanje.nombre_recompensa}</h3>

              <p className="ciudadano-canje-instruccion">
                Presenta este codigo en el comercio para recibir
                tu beneficioo
              </p>

              <div className="ciudadano-canje-codigo">
                <span>Codigo de canje</span>
                <strong>{ultimoCanje.codigo_canje}</strong>
              </div>

              <div className="ciudadano-canje-detalles">
                <div>
                  <span>EcoPuntos utilizados</span>
                  <strong>{ultimoCanje.puntos_utilizados}</strong>
                </div>

                <div>
                  <span>Estado</span>
                  <strong>{ultimoCanje.estado}</strong>
                </div>
              </div>

              <p className="ciudadano-canje-aviso">
                Este cóoigo es valido para un solo uso
              </p>
            </div>
          )}
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'perfil'}
        >
          <section className='eco-perfil eco-perfil-editable'>
            <div className='eco-perfil-encabezado'>
              <div className='eco-perfil-foto-contenedor'>
                {fotoVistaPrevia || fotoActual ? (
                  <img
                    src={fotoVistaPrevia || fotoActual}
                    alt='Fotografia de perfil'
                    className='eco-perfil-fotografia'
                  />
                ) : (
                  <div className='eco-perfil-avatar'>
                    {datosPerfil.nombre
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <h2>Mi perfil</h2>
              <p>Administrar tu informacion personal en EcoCycle</p>

              {editandoPerfil && (
                <div className='eco-perfil-cambiar-foto'>
                  <label
                    htmlFor="eco-foto-perfil"
                    className='eco-perfil-boton-foto'
                  >
                    Cambiar fotografia
                  </label>

                  <input
                    id='eco-foto-perfil'
                    type="file"
                    accept='image/jpeg,image/jpg,image/png'
                    onChange={seleccionarFotoPerfil}
                    style={{ display: 'none' }}
                  />

                  <small>
                    JPEG, JPG o PNG. Maximo 2MB
                  </small>
                </div>
              )}
            </div>

            <div className='eco-perfil-formulario'>
              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-nombre">
                  Nombre completo
                </label>

                <input
                  id='eco-perfil-nombre'
                  type="text"
                  maxLength={30}
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

              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-correo">
                  Correo electronico
                </label>

                <input
                  id='eco-perfil-correo'
                  type="email"
                  value={datosPerfil.correo}
                  disabled
                />
              </div>

              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-telefono">
                  Telefono
                </label>

                <input
                  id='eco-perfil-telefono'
                  type="tel"
                  maxLength={11}
                  placeholder='Ingresa tu telefono'
                  value={datosPerfil.telefono}
                  disabled={!editandoPerfil || guardandoPerfil}
                  onChange={(e) =>
                    setDatosPerfil({
                      ...datosPerfil,
                      telefono: e.target.value
                    })
                  }
                />
              </div>
              <div className='eso-perfil-campo'>
                <label htmlFor="eco-perfil-fecha">
                  Fecha de nacimiento
                </label>

                <input
                  id='eco-perfil-fecha'
                  type="date"
                  value={datosPerfil.fecha_nacimiento}
                  disabled={!editandoPerfil || guardandoPerfil}
                  onChange={(e) =>
                    setDatosPerfil({
                      ...datosPerfil,
                      fecha_nacimiento: e.target.value
                    })
                  }
                />
              </div>

              <div className='eco-perfil-puntos'>
                <span>Mis puntos disponibles</span>
                <strong>{saldoEcopuntos}</strong>
              </div>

              {mensaje && (
                <div className='eco-perfil-mensaje' role='status'>{mensajePerfil}</div>
              )}

              {editandoPerfil ? (
                <div className='eco-perfil-guardando'>
                  <button
                    type='button'
                    className='eco-perfil-guardar'
                    onClick={guardarCambiosPerfil}
                    disabled={guardandoPerfil}
                  >
                    {guardandoPerfil
                      ? 'Guardadno cambios...'
                      : 'Guardar cambios'}
                  </button>

                  <button
                    type='button'
                    className='eco-perfil-cancelar'
                    onClick={cancelarEdicionPerfil}
                    disabled={guardandoPerfil}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  className='eco-perfil-editar'
                  onClick={() => {
                    setMensajePerfil('')
                    setEditandoPerfil(true)
                  }}
                >
                  Editar mi perfil
                </button>
              )}

              <button
                type='button'
                className='eco-perfil-salir'
                onClick={cerrarSesion}
              >
                Cerrar sesion
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Ciudadano
