import {useStates} from 'react'
import {useEffect} from 'react'
import {supabase} from '../lib/supabase'

function Ciudadano({ perfil, cerrarSesion }) {
  const [materiales, setMateriales] = useStates([])
  const cargaMateriales = async () => {
    const {data, error} = await supabase
      .from('material')
      .select('*')

    if (error){
      console.error('Error al cargar materiales:', error)
      return
    }
    setMateriales(data)
  }
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

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Ciudadano
