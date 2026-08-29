import { useState } from 'react'
import {useEffect} from 'react'
import {supabase} from '../lib/supabase'

function Ciudadano({ perfil, cerrarSesion }) {
  const [materiales, setMateriales] = useState([])
  const [materialSeleccionado, setMaterialSeleccionado] = useState (null)
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

  useEffect(()=>{
    cargarMateriales()
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
            onClick = {() => setMaterialSeleccionado(material)}
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

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Ciudadano
