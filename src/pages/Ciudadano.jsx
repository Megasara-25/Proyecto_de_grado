import {useState} from 'react'
import {useEffect} from 'react'
import {supabase} from '../lib/supabase'
import MapaReciclaje from '../components/MapaReciclaje'

import huevosImg from '../assets/recompensas/huevos.png'
import mercadoImg from '../assets/recompensas/mercado.png'
import comidaImg from '../assets/recompensas/comida.png'
import cuidadoImg from '../assets/recompensas/cuidado_personal.png'

function Ciudadano({ perfil, cerrarSesion }) {
  const [materiales, setMateriales] = useState([])
  const [materialSeleccionado, setMaterialSeleccionado] = useState (null)
  const [recicladores, setRecicladores] = useState ([])
  const [recicladorSeleccionado, setRecicladorSeleccionado] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [ciudadanoId, setCiudadanoId] = useState(null)
  const [mensaje, setMensaje] = useState ('')
  const [entregas, setEntregas] = useState([])
  const [recompensas, setRecompensas] = useState([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState ('Todos')
  const [ultimoCanje, setUltimoCanje] = useState (null)
  const [saldoEcopuntos, setSaldoEcopuntos] = useState(perfil.ecopuntos)
  const [recompensaCanjeando, setRecompensaCanjeando] = useState(null)

  const imagenesRecompensas = {
    2: huevosImg,
    3: mercadoImg,
    4: comidaImg,
    5: cuidadoImg
  }

  const cargarMateriales = async () => {

    const {data, error} = await supabase
      .from('material')
      .select('*')

    if (error){
      console.error('Error al cargar materiales:', error)
      return
    }

    setMateriales(data)
  }

  const cargarCiudadano = async () => {

    const {data, error} = await supabase
    .from('ciudadano')
    .select('id')
    .eq('usuarioid', perfil.id)
    .single()
  
    if(error){
      console.error('Error al cargar ciudadano:', error)
      return
    }

    setCiudadanoId(data.id)
    cargarEntregas(data.id)
  }

  const cargarEntregas = async(idCiudadano) =>{

    const {data, error} = await supabase
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
    .order('fecha', {ascending: false})

    if (error) {
      console.error('Error al cargar entregas del ciudadano:', error)
      return
    }

    setEntregas(data)
    console.log('Historial de entregas:', data)
  }

  const cargarRecompensas = async() => {

    const {data, error} = await supabase
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

    if(error){
      console.error('Error al cargar recompensas:', error)
      return
    }

    setRecompensas(data)
    console.log('Recompensas disponibles:', data)
  }

  const cargarSaldoEcopuntos = async() =>{

    const {data, error} = await supabase
    .from('usuario')
    .select('ecopuntos')
    .eq('id', perfil.id)
    .single()

    if(error){
      console.error('Error al cargar Ecopuntos', error)
      return
    }

    setSaldoEcopuntos(data.ecopuntos)
  }

  const cargarRecicladores = async (materialId) =>{
    const {data, error} = await supabase
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

    if (error){
      console.error('Error al cargar recicladroes:', error)
      return
    }

    setRecicladores(data)
    console.log('Recicladores encontrados:', data)
  }

  const registrarEntrega = async () =>{
    setMensaje('')

    if(!materialSeleccionado || !recicladorSeleccionado || !cantidad){
      setMensaje('Debes seleccionar material, centro y cantidad')
      return
    }

    if(Number(cantidad) <= 0){
      setMensaje('La cantidad debe ser mayor que cero')
      return
    }

    const{data, error} = await supabase.rpc(
      'registrar_entrega_ciudadano',
      {
        p_material_id: materialSeleccionado.id,
        p_reciclador_id: recicladorSeleccionado.id,
        p_cantidad:Number(cantidad)
      }
    )

    if(error){
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

    if(recompensa.cantidad_disponible <= 0){
      setMensaje('Esta recompensa no tiene unidades disponibles')
      return
    }

    if( saldoEcopuntos < recompensa.puntos_requeridos){
      setMensaje('No tiene Ecopuntos suficientes')
      return
    }

    try {setRecompensaCanjeando(recompensa.id)

      const {data, error} = await supabase.rpc(
        'realizar_canje_ciudadano',
        {
          p_recompensa_id: recompensa.id
        }
      )
  

      if (error){
        console.error('Error al realizar canje:', error)

        if(error.message.includes('stock')){
          setMensaje('La recompensa ya no tiene unidades disponibles')
        } else if (error.message.includes('Ecopuntos insuficiente')){
          setMensaje('No tienes Ecopuntos suficientes')
        } else {
          setMensaje('No fue posible realizar canje')
        }
        return
      }

      if(!data || data.length === 0){
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

    } finally{
      setRecompensaCanjeando(null)
    }
  }

  useEffect(() => {
    cargarMateriales()
    cargarCiudadano()
    cargarRecompensas()
  }, [])

  useEffect(() =>{
    cargarSaldoEcopuntos()
  }, [perfil.id])

  return (
    <div className="ciudadano_pagina">

      <header className='ciudadano_header'>
      <div className="ciudadano_header_contenido">
        <img src="/src/assets/ecocycle-logo.png" alt="Ecocycle" className='ciudadano-logo'/>

        <div className='ciudadano-header-acciones'>
          <span>{perfil.nombre}</span>

          <button className='ciudadano-boton-salir'
          onClick={cerrarSesion}>
            Cerrar sesion
          </button>
        </div>

        </div>
      </header>

      <main className='ciudadano-contenido'>

        <section className='ciudadano-bienvenida'>
          <div className='ciudadano-bienvenida-texto'>
            <span className='ciudadano-etiqueta'>
              Panel del ciudadano
            </span>

            <h1> hola, {perfil.nombre}</h1>

            <p> Recicla, acumula Ecopuntos y obten beneficios mientras ayudas al planeta</p>
          </div>♻️

          <div className='ciudadano-saldo'>
            <div className='ciudadano-saldo-icono'>
              
            </div>

            <div>
              <span>Mis Ecopuntos</span>

              <strong>{saldoEcopuntos}</strong>

              <small> disponible para canjear</small>
            </div>
          </div>

        </section>

        {mensaje &&(
          <div className='ciudadano-mensaje'>
            {mensaje}
          </div>
        )}

        <section className='ciudadano-seccion-materiales'>
          <div className='ciudadano-seccion-titulo'>
            <div>
              <span>Recicla y gana</span>
              <p>¿Que quieres reciclar?</p>
            </div>
          </div>
          <div className='ciudadano-material-grid'>
            {materiales.map((material)=>(
              <button type='button'
              key={material.id}
              className={
                materialSeleccionado?.id === material.id
                ? 'ciudadano-material-card seleccionado' : 'ciudadano-material-card'
              }
              onClick={() => {
                setMaterialSeleccionado(material)
                setRecicladorSeleccionado(null)
                setCantidad('')
                cargarRecicladores(material.id)
              }}
          >
            <div className='ciudadano-material-icono'>
              ♻️
            </div>
            <div className='ciudadano-material-info'>
              <h3>{material.nombre}</h3>
              <p><strong>{material.puntos_por_kilo}</strong>
              {' '}Ecopuntos/kg
              </p>
            </div>

            <div className='ciudadano-material-seleccionar'>
              {materialSeleccionado?.id === material.id 
              ?'seleccionado' : 'seleccionar'}
            </div>
          </button>
            ))}

          </div>
        </section> 

        {materialSeleccionado && (
          <section className='ciudadano-centros'>
            <div className='ciudadano-material-resumen'>
              <div>
                <span>Material seleccionado</span>
                <strong>{materialSeleccionado.nombre}</strong>
              </div>

              <div>
                <span>Valor</span>
                <strong>{materialSeleccionado.puntos_por_kilo} Ecopuntos/kg </strong>
              </div>
            </div>

            <div className='ciudadano-seccion-titulo'>
              <span>Paso2</span>
              <h2>Encuentra donde reciclar</h2>
              <p>
                Consulta los puntos de reciclaje disponible 
                para este material y selecciona el que prefieras
              </p>
            </div>

            <div className='ciudadano-mapa-contenedor'>
              <MapaReciclaje  recicladores={recicladores}
                onSeleccionarCentro={setRecicladorSeleccionado}
              />
            </div>

            <div className='ciudadano-centros-grid'>
              {recicladorSeleccionado &&(
                <div className='ciudadano-centro-card seleccionado'>
                  <div className='ciudadano-centro-icono'>
                    ♻️
                  </div>
                  <span>Centro seleccionado</span>
                  <h3>{recicladorSeleccionado.nombre_centro}</h3>
                  <p>{recicladorSeleccionado.direccion}</p>
                  <p>{recicladorSeleccionado.ciudad}</p>

                  {recicladorSeleccionado.distancia !== null &&
                    recicladorSeleccionado.distancia !== undefined && (
                      <p>
                        <strong>
                          A{recicladorSeleccionado.distancia.toFixed(2)} km de tu ubicacion
                        </strong>
                      </p>
                    )}
                    <p>
                      Material seleccionado: <strong>{materialSeleccionado.nombre}</strong>
                    </p>

                    <button type="button"
                    onClick={() => setRecicladorSeleccionado(null)}
                    >
                      cambiar centro
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
              value ={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />

            {cantidad > 0 && materialSeleccionado && (
              <div className='ciudadano-puntos-estimados'>
                <p>Ecopuntos estimados</p>
                <strong>
                  {Math.floor(
                    Number(cantidad) * materialSeleccionado.puntos_por_kilo
                  )} Ecopuntos
                </strong>

                <span>
                  {cantidad} kg x {materialSeleccionado.puntos_por_kilo} puntos/kg
                </span>
              </div>
            )}
            <button onClick = {registrarEntrega}>
              registrar entrega
            </button>
          </div>
        )}
        <h2>Historial de entregas</h2>

        {entregas.length === 0 && (
          <p>No tiene entregas registradas</p>
        )}

        {entregas.map((entrega) => (
          <div key = {entrega.id}>
            <h3>{entrega.material.nombre}</h3>

            <p>
              Cantidad: {entrega.cantidad}kg
            </p>

            <p>
              {entrega.estado === 'Aprobada'
              ? 'Ecopuntos obtenidos:'
              : 'Ecopuntos estimados:'}
              {entrega.puntos_obtenidos}
            </p>

            <p>
              Estado: {entrega.estado}
            </p>
            {entrega.estado === 'Rechazada' && entrega.motivo_rechazo &&(
              <p>
                <strong>Motivo del rechazo:</strong> {entrega.motivo_rechazo}
              </p>
            )}
          </div>
        ))}

        <section className='ciudadano-beneficios'>
          <div className='cidadano-beneficios-encabezado'>
            <div>
              <span>Canjea tus Ecopuntos</span>
              <h2>Beneficios para ti</h2>
              <p>Elige una recompensa y disfruta tus Ecopuntos</p>
            </div>
          </div>

          <div className='ciudadano-categorias'>
            {['Todos', 'Mercado', 'Comida', 'Salud']. map((categoria) => (
              <button
                key={categoria}
                type='button'
                className={ categoriaSeleccionada === categoria
                  ?'ciudadano-categoria activa'
                  : 'ciudadano-categoria'
                }
                onClick={() => setCategoriaSeleccionada(categoria)}
              >
                {categoria}
              </button>
            ))}
          </div>
        </section>

        {recompensas.length === 0 &&(
          <p>no hay recompensas disponibles</p>
        )}

        <div className='ciudadano-beneficios-grid'>
          {recompensas
            .filter((recompensa) =>
              categoriaSeleccionada === 'Todos' ||
              recompensa.categoria === categoriaSeleccionada
            )
            .map((recompensa) =>{
              const sinStock = recompensa.cantidad_disponible <= 0
              const puntosInsuficientes = saldoEcopuntos < recompensa.puntos_requeridos
              const puntosFaltantes = recompensa.puntos_requeridos - saldoEcopuntos

              console.log('Saldo:', saldoEcopuntos)
              console.log('Recompensa procesando:', recompensaCanjeando)

              return(
                <div
                  key={recompensa.id}
                  className='ciudadano-beneficio-card'
                >

                  <div className='ciudadano-beneficio-imagen'>
                    {imagenesRecompensas[recompensa.id]?(
                      <img
                      src={imagenesRecompensas[recompensa.id]}
                      alt={recompensa.nombre}
                      />
                    ):(
                      <span>♻️</span>
                    )}
                  </div>

                  <div className='ciudadano-beneficio-contenido'>
                    {recompensa.categoria &&(
                      <span className='ciudadano-beneficio-categoria'>
                        {recompensa.categoria}
                      </span>
                    )}

                    <h3>{recompensa.nombre}</h3>
                    <p>{recompensa.descripcion}</p>

                    <div className='ciudadano-beneficio-datos'>
                      <strong>
                        ♻️ {recompensa.puntos_requeridos} Ecopuntos
                      </strong>

                      <span>
                        {recompensa.cantidad_disponible} disponibles
                      </span>
                    </div>

                    {sinStock ?(
                      <button disabled>
                        Beneficio agotado
                      </button>

                    ) : puntosInsuficientes ? (
                      <button disabled>
                        Te falta {puntosFaltantes} Ecopuntos
                      </button>
                    ) : (
                      <button 
                        onClick={() => realizarCanje(recompensa)}
                        disabled={recompensaCanjeando !== null}
                      >
                        {recompensaCanjeando === recompensa.id
                        ? 'Procesando...' 
                        : 'Canjear'
                      }
                      </button>
                    )
                  }
                  </div>
                </div>
              )
            })
          }
        </div>

          {ultimoCanje && (
            <div className='ciudadano-canje-exitoso'>

              <div className='ciudadano-canje-check'>
                ✓
              </div>
              <h2> Canje realizado correctamente</h2>
              <h3>{ultimoCanje.nombre_recompensa}</h3>

              <p className='ciudadano-canje-instruccion'>
                Presenta este codigo en el comercio para recibir tu beneficio
              </p>

              <div className='ciudadano.canje-codigo'>
                <span>Codigo de canje</span>
                <strong>{ultimoCanje.codigo_canje}</strong>
              </div>

              <div className='ciudadano-canje-detalles'>
                <div>
                  <span>Ecopuntos utilizados</span>
                  <strong>{ultimoCanje.puntos_utilizados}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>{ultimoCanje.estado}</strong>
                </div>
              </div>
              <p className='ciudadano-canje-aviso'>
                Este codigo es valido para uno solo uso
              </p>
            </div>
          )}
        </main>
    </div>
  )
}

export default Ciudadano
