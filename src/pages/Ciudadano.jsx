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

  const realizarCanje = async (recompensas) => {
    console.log('Intentando canjear:', recompensas)
    const {data, error} = await supabase
    .from ('canje')
    .insert([
      {
        ciudadanoid: ciudadanoId,
        recompensaid: recompensas.id,
        comercioid: recompensas.comercioid,
        puntos_utilizados: recompensas.puntos_requeridos
      }
    ])
    .select()

  if (error){
    console.error('Error al realizar canje:', error)
    return
  }

  console.log('Canje realizado:', data)
  setUltimoCanje(data[0])

  setSaldoEcopuntos(
    saldoEcopuntos - data[0].puntos_utilizados
  )
  }

  const registrarEntrega = async () => {
    if(!materialSeleccionado || !recicladorSeleccionado || !cantidad) {
      alert('Debes seleccionar material, centro y cantidad')
      return
    }

    const {data, error} = await supabase
    .from('entrega')
    .insert([
      {
        cantidad: Number(cantidad),
        ciudadanoid : ciudadanoId,
        recicladorid: recicladorSeleccionado.id,
        materialid: materialSeleccionado.id,
      }
    ])
    . select()

  if(error){
    console.error('Error al registrar entregas:', error)
    return
  }

  console.log('Entrega registrada:', data)
  
  setMensaje('Entrega registrada correctamente')
  setCantidad('')
  cargarEntregas(ciudadanoId)
  }

  const cargarRecicladores = async (materialId) => {

    const {data,error} = await supabase
    .from ('material_reciclador')
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
    console.error('Error al cargar recicladores:', error)
    return
  }

  setRecicladores(data)
  console.log('Recicladores encontrados:', data)
  }

  useEffect(()=>{
    cargarMateriales()
    cargarCiudadano()
    cargarRecompensas()
  },[])

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
            {mensaje&&(
              <p>{mensaje}</p>
            )}
          </div>
        )}
        <h2>Historial de entregas</h2>

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
        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
        <h2>Recompensas disponibles</h2>

          {recompensas.map((recompensas) => (
            <div key={recompensas.id}>
              <h3>{recompensas.nomnre}</h3>

              <p>
                {recompensas.descripcion}
              </p>

              <p>
                EcoPuntos requeridos: {recompensas.puntos_requeridos}
              </p>

              <p>
                Disponibles: {recompensas. cantidad_disponible}
              </p>
              {saldoEcopuntos >= recompensas.puntos_utilizados ? (
                <button onClick={()=> realizarCanje(recompensas)}>
                  canjear
                </button>
              ):(
                <p>
                  Ecopuntos insuficientes
                </p>
              )}
            </div>    
          ))}

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
    </div>
  )
}

export default Ciudadano
