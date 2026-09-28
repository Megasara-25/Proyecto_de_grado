import {useState} from 'react'
import {useEffect} from 'react'
import {supabase} from '../lib/supabase'
import MapaReciclaje from '../components/MapaReciclaje'

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
  const [ultimoCanje, setUltimoCanje] = useState (null)
  const [saldoEcopuntos, setSaldoEcopuntos] = useState(perfil.ecopuntos)

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
      comercioid
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

  const realizarCanje = async (recompensas) => {

    setMensaje('')

    if(recompensas.cantidad_disponible <= 0){
      setMensaje('Esta recompensa no tiene unidades disponibles')
      return
    }

    if( saldoEcopuntos < recompensas.puntos_requeridos){
      setMensaje('No tiene Ecopuntos suficientes')
      return
    }
  
    const {data, error} = await supabase.rpc(
      'realizar_canje_ciudadano',
      {
        p_recompensa_id: recompensas.id
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

    if(!data || data.length === 0) {
      setMensaje('No fue posible realizar el canje')
      return
    }

    console.log('Canje realizado:', data)
    setUltimoCanje(data[0])

    setMensaje('Canje realizado correctamente')

    await cargarSaldoEcopuntos()
    await cargarRecompensas ()
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
          </div>

          <div className='ciudadano-saldo'>
            <div className='ciudadano-saldo-icono'>
              ♻️
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
              {recicladores.map((item) => (
                <button type='button'
                key={item.reciclador.id}
                className={ recicladorSeleccionado?.id === item.reciclador.id
                  ? 'ciudadano-centro-card seleccionado' : 'ciudadano-centro-card'
                }
                onClick={() => setRecicladorSeleccionado(item.reciclador)}
                >
                  <div className='ciudadano-centro-icono'>
                    ♻️
                  </div>

                  <h3>{item.reciclador.nombre_centro}</h3>
                  <p>{item.reciclador.direccion}</p>
                  <p>{item.reciclador.ciudad}</p>

                  <span>{recicladorSeleccionado?.id === item.reciclador.id
                    ? 'centro seleccionado' : 'seleccionar centro'}
                  </span>
                </button>
              ))}
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
              Ecopuntos: {entrega.puntos_obtenidos}
            </p>

            <p>
              Estado: {entrega.estado}
            </p>
          </div>
        ))}

        <h2>Recompensas disponibles</h2>

        {recompensas.length === 0 &&(
          <p>no hay recompensas disponibles</p>
        )}

          {recompensas.map((recompensas) => {

            const sinStock = recompensas.cantidad_disponible <= 0

            const puntosInsuficientes = saldoEcopuntos < recompensas.puntos_requeridos
          
          return(
          
            <div key={recompensas.id}>

              <h3>{recompensas.nombre}</h3>

              <p>
                {recompensas.descripcion}
              </p>

              <p>
                EcoPuntos requeridos: {''}
                <strong>{recompensas.puntos_requeridos}</strong> 
              </p>

              

              <p>
                Stock disponibles:{' '}
                <strong>{recompensas. cantidad_disponible}</strong>
              </p>
              
              {sinStock ? (
                <p>Beneficio agotado</p>
              ): puntosInsuficientes ? (
                <p>Ecopuntos insuficientes</p>
              ): (
                <button onClick={() => realizarCanje(recompensas)}>
                  Canjear
                </button>
              )}
            </div>
          )    
        })}

          {ultimoCanje && (
            <div>
              <h2> Canje realizado correctamente</h2>

              <p>
                Codigo de canje:
                <strong>{ultimoCanje.codigo_canje}</strong>
              </p>

              <p>
                Estado: {ultimoCanje.estado}
              </p>

              <p>
                Ecopuntos utilizados: {ultimoCanje.puntos_utilizados}
              </p>
            </div>
          )}
        </main>
    </div>
  )
}

export default Ciudadano
