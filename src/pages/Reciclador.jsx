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
  cargarEntrega(data.id)
  }

  const cargarEntrega = async(idReciclador)=>{
    
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

  const aprobarEntrega = async(entregaId)=>{
    const{error} = await supabase
    .from ('entrega')
    .update({
      estado:'Aprobada'
    })
    .eq('id', entregaId)
    .select()
  
  if(error){
    console.error('Error al probar entrega:', error)
    return
  }

  console.log('Entregas aprobada:', entregaId)

  cargarEntrega(recicladorId)
  }

  const rechazarEntrega = async(entregaId)=>{
    const {error} = await supabase
    .from('entrega')
    .update({
      estado: 'Rechazada'
    })
    .eq('id', entregaId)

    if(error){
      console.error('Error al rechazar la entrega:', error)
      return
    }
    console.log('Entrega rechazada:', entregaId)

    cargarEntrega(recicladorId)
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
          <button onClick={() => aprobarEntrega(entrega.id)}>
            Aprobar
          </button>
          <button onClick={()=> rechazarEntrega(entrega.id)}>
            Rechazar
          </button>
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
