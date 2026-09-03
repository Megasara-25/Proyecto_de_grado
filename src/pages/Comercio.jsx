import { useState, useEffect} from 'react'
import { supabase } from '../lib/supabase'

function Comercio({ perfil, cerrarSesion }) {
  const [tipoDocumento, setTipoDocumento] = useState ('')
  const [numeroDocumento, setNumeroDocumento] = useState ('')
  const [codigoCanje, setCodigoCanje] = useState ('')
  const [mensaje, setMensaje] = useState ('')
  const [comercioId, setComercioId] = useState(null)

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

        {mensaje && (
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
