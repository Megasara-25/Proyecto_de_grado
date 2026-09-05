import { useState, useEffect} from 'react'
import { supabase } from '../lib/supabase'

function Comercio({ perfil, cerrarSesion }) {
  const [tipoDocumento, setTipoDocumento] = useState ('')
  const [numeroDocumento, setNumeroDocumento] = useState ('')
  const [codigoCanje, setCodigoCanje] = useState ('')
  const [mensaje, setMensaje] = useState ('')
  const [comercioId, setComercioId] = useState(null)
  const [canjeEncontrado, setCanjeEncontrado] = useState(null)

  const cargarComercio = async () =>{
    const {data, error} = await supabase
    .from('comercio_aliado')
    .select('id')
    .eq('usuarioid', perfil.id)
    .single()

  if (error){
    console.error('Error al cargar comercio:', error)
    return
  }

  setComercioId(data.id)
  console.log('Comercio autenticado:', data. id)
  }

  useEffect(() => {
    cargarComercio()
  }, [])

  const buscarCanje = async () =>{
    const {data, error} = await supabase.rpc(
      'buscar_canje_comercio',
      {
        p_tipo_documento: tipoDocumento,
        p_numero_documento: numeroDocumento,
        p_codigo_canje: codigoCanje
      }
    )

  if (error){
    console.error('Error al buscar canje:', error)
    setMensaje('No te fue posible validar el canje')
    return
  }

  if(data.length === 0){
    setCanjeEncontrado(null)
    setMensaje('No se encontro un canje valido')
    return
  }
  setCanjeEncontrado(data[0])
    setMensaje('')

  console.log('Canje encontrado:', data)
  }

  const confirmarCanje = async () =>{
    if(!canjeEncontrado){
      setMensaje('No hay un canje seleccionado')
      return
    }

    const {data, error} = await supabase.rpc(
      'confirmar_canje_comercio',
      {
        p_canje_id: canjeEncontrado.canje_id,
        p_codigo_canje: codigoCanje
      }
    )

    if (error){
      console.error('Error al confirmar canje:', error)
      setMensaje('No fue posible confirmar el canje')
      return
    }

    setMensaje('Canje confirmado correctamente')

    setCanjeEncontrado({
      ...canjeEncontrado,
      estado_canje:'Canjeado'
    })
  }

  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h1>EcoCycle</h1>
        <h2>Panel del comercio aliado</h2>

        <p>
          Bienvenido, <strong>{perfil.nombre}</strong>
        </p>

        <h2>Validar canje</h2>

        <label>tipo de documento</label>
        <select 
          value={tipoDocumento}
          onChange={(e) => setTipoDocumento (e.target.value)}
        >
          <option value="">Seleccione</option>
          <option value ="CC">CC</option>
          <option value="TI">TI</option>
          <option value="CE">CE</option>
          <option value="PASAPORTE">Pasaporte</option>
        </select>

        <label>Numero de documento</label>
        <input 
          type="text"
          value={numeroDocumento}
          onChange={(e) => setNumeroDocumento(e.target.value)}
          placeholder='Numero de coumento' 
        />

        <label>Codigo de canje</label>
        <input type="text"
          value={codigoCanje}
          onChange={(e) => setCodigoCanje(e.target.value)}
          placeholder='Codigo de 6 digitos' 
        />
        <button onClick={buscarCanje}>
          Validar canje
        </button>

        {canjeEncontrado && (
          <div>

            <h3>Canje encontrado</h3>

            <p>
              Ciudadano: {canjeEncontrado.nombre_ciudadano}
            </p>

            <p>
              Recompensa: {canjeEncontrado.nombre_recompensa}
            </p>

            <p>
              EcoPunto utilizados: {canjeEncontrado.puntos_canje}
            </p>

            <p>
              Estado: {canjeEncontrado.estado_canje}
            </p>

            {canjeEncontrado.estado_canje === 'Pendiente' &&(
              <button onClick={confirmarCanje}>
                Confirmar canje
              </button>
            )}
          </div>
        )}
        {mensaje &&(
              <p>{mensaje}</p>
            )}
            
        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Comercio
