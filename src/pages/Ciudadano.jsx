import {useState} from 'react'
import {useEffect} from 'react'
import {supabase} from '../lib/supabase'

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
    <div className="contenedor">
      <div className="tarjeta">
        <h1>EcoCycle</h1>
        <h2>Panel del ciudadano</h2>

        <p>
          Bienvenido, <strong>{perfil.nombre}</strong>
        </p>

        <p>
          EcoPuntos: <strong>{saldoEcopuntos}</strong>
        </p>

        {mensaje && (
          <p>{mensaje}</p>
        )}

        <h2> ¿Que quieres reciclar?</h2>

        {materiales.map((material) =>(
          <div 
            key = {material.id}
            onClick = {() => {
              setMaterialSeleccionado(material)
              setRecicladorSeleccionado(null)
              setCantidad('')
              cargarRecicladores(material.id)
            }}
          >
              <h3>{material.nombre}</h3>

            <p>
              {material.puntos_por_kilo} Ecopuntos por kilogramo
            </p>
          </div>
        ))}

        {materialSeleccionado &&(
          <p>
            Material seleccionado: <strong>{materialSeleccionado.nombre}</strong>
          </p>
        )}

        {recicladores.map((item)=> (
            <div 
              key={item.reciclador.id}
              onClick ={()=> setRecicladorSeleccionado(item.reciclador)}
            >
              <h3>{item.reciclador.nombre_centro}</h3>

              <p> 
                Dirección: {item.reciclador.direccion}
              </p> 
              <p>
                Ciudad: {item.reciclador.ciudad}
              </p>
            </div>
        ))}

        {recicladorSeleccionado && (
          <p>
            centro seleccionado: {' '}
            <strong>{recicladorSeleccionado.nombre_centro}</strong>
          </p>
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
            {mensaje &&(
              <p>
                <strong>{mensaje}</strong>
              </p>
            )}
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
          <button onClick={cerrarSesion}>
            Cerrar sesion
          </button>
        </div>
    </div>
  )
}

export default Ciudadano
