import { useEffect, useState } from "react"
import { supabase } from '../lib/supabase'

function Reciclador({ perfil, cerrarSesion }) {
  const [recicladorId, setRecicladorId] = useState(null)
  const [entregas, setEntregas] = useState ([])
  const [mensaje, setMensaje] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [entregaARechazar, setEntregaARechazar] = useState(null)

  const cargarReciclador = async () => {
    
    const {data, error} = await supabase
      .from('reciclador')
      .select('id')
      .eq('usuarioid', perfil.id)
      .single()

    if (error){
      console.error('Error al cargar reciclador:', error)
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

  const actualizandoEstadoEntrega = async (
    entregaId,
    nuevoEstado,
    motivo = null
  ) =>{ 
    setMensaje('')

    const {data, error} = await supabase.rpc(
      'actualizar_estado_entrega_reciclador',
      {
        p_entrega_id : entregaId,
        p_estado: nuevoEstado,
        p_motivo_rechazo: motivo
      }
    )

    if(error){
      console.error('Error al actualizar entrega',error)

      setMensaje('No fue posible actualizar la entrega')
      return
    }

    if(!data){
      setMensaje('La entrega no pudo ser actualizada')
      return
    }

    if(nuevoEstado === 'Aprobada'){
      setMensaje('Entrega aprobada correctamente')
    }

    if(nuevoEstado === 'Rechazada'){
      setMensaje('Entrega rechazada correctamente')
    }
    cargarEntrega(recicladorId)
  }

  const aprobarEntrega = async(entregaId)=>{
    await actualizandoEstadoEntrega(
      entregaId, 'Aprobada'
    )
  }

  const rechazarEntrega = async(entregaId)=>{
    setEntregaARechazar(entregaId)
    setMotivoRechazo('')
    setMensaje('')
  }

  const confirmarRechazo = async () => {
    if(!motivoRechazo.trim()){
      setMensaje('Debes indicar el motivo del rechazo')
      return
    }

    await actualizandoEstadoEntrega(
      entregaARechazar,
      'Rechazada',
      motivoRechazo
    )

    setEntregaARechazar(null)
    setMotivoRechazo('')
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

        {mensaje && (
          <p>{mensaje}</p>
        )}

        <h2>Entregas pendientes</h2>

        {entregas.length === 0 &&(
          <p>No tienes entregas pendeintes por validar</p>
        )}

        {entregas.map((entrega)=>(

        <div key ={entrega.id}className="reciclador-entregas-card">
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
          <div className="reciclador-accciones">
          <button 
          className="reciclador-boton-aprobar" 
          onClick={() => aprobarEntrega(entrega.id)}
          >
            Aprobar
          </button>

          <button 
          className="reciclador-boton-rechazar"
          onClick={()=> rechazarEntrega(entrega.id)}
          >
            Rechazar
          </button>
          </div>

          {entregaARechazar === entrega.id && (
            <div className="reciclador-rechazo">
              <label>Motivo de rechazo</label>

              <textarea 
              className="reciclador-rechazo-textarea"
              placeholder="Ejemplo: la cantidad entregada no coincide con lo registrado"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              />

              <button
              type="button"
              onClick={() =>{
                setEntregaARechazar(null) 
                setMotivoRechazo('')
                }}
                >
                  Cancelar
                </button>

                <button 
                type="button"
                onClick={confirmarRechazo}
                >
                  Confirmar rechazo
                </button>
            </div>
          )}
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
