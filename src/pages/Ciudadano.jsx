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
          EcoPuntos: <strong>{perfil.ecopuntos}</strong>
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
        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Ciudadano
