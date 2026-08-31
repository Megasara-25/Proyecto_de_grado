import { useEffect, useState } from "react"
import { supabase } from '../lib/supabase'

function Reciclador({ perfil, cerrarSesion }) {
  const [recicladorId, setRecicladorId] = useState(null)
  const [entregas, setEntregas] = useState ([])

  const cargarReciclador = async () => {
    
    const {data, error} = await supabase
    .from('reciclador')
    .select('id')
    .eq('usuarioid', perfil.id)
    .single()

  if (error){
    console.error('Eror al cargar reciclador:', error)
    return
  }

  setRecicladorId(data.id)
  cargarEntregas(data.id)
  }

  const cargarEntregas = async(idReciclador)=>{
    
    console.log('ID reciclador usado para buscar entregas:', idReciclador)

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
    .eq('recicladorid', idReciclador)
    .eq('estado', 'Pendiente')

  if (error){
    console.error('Error al cargar entregas:', error)
    return
  }
  
  setEntregas(data)
  console.log('Entregas pendientes:', data)
  }

  useEffect(() =>{
    cargarReciclador()
  },[])

  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h1>EcoCycle</h1>
        <h2>Panel del reciclador</h2>

        <p>
          Bienvenido, <strong>{perfil.nombre}</strong>
        </p>
        <h2>Entregas pendientes</h2>

        {entregas.map((entrega)=>(
        <div key ={entrega.id}>
          <h3>{entrega.material.nombre}</h3> 

          <p>
            Cantidad: {entrega.cantidad} kg
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
    </div>
  )
}

export default Reciclador
