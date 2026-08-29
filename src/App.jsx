import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Ciudadano from './pages/Ciudadano'
import Reciclador from './pages/Reciclador'
import Comercio from './pages/Comercio'
import './App.css'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const obtenerPerfil = async (user) => {

    console.log('Usuario autenticado:', user?.id)

    if (!user) {
      setUsuario(null)
      setPerfil(null)
      setCargando(false)
      return
    }

    setUsuario(user)

    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, correo, rol, ecopuntos')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error cargando perfil:', error)
      setPerfil(null)
      setCargando(false)
      return
    }

    setPerfil(data)
    setCargando(false)
  }

  useEffect(() => {
    const cargarSesion = async () => {
      const { data } = await supabase.auth.getSession()

      await obtenerPerfil(data.session?.user ?? null)
    }

    cargarSesion()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      obtenerPerfil(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    setPerfil(null)
  }

  if (cargando) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Cargando EcoCycle...</h2>
        </div>
      </div>
    )
  }

  if (!usuario) {
    return <Login onLogin={obtenerPerfil} />
  }

  if (!perfil) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>No se encontró el perfil del usuario.</h2>
          <button onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (perfil.rol === 'ciudadano') {
    return (
      <Ciudadano
        perfil={perfil}
        cerrarSesion={cerrarSesion}
      />
    )
  }

  if (perfil.rol === 'reciclador') {
    return (
      <Reciclador
        perfil={perfil}
        cerrarSesion={cerrarSesion}
      />
    )
  }

  if (perfil.rol === 'comercio_aliado') {
    return (
      <Comercio
        perfil={perfil}
        cerrarSesion={cerrarSesion}
      />
    )
  }

  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h2>Rol no reconocido</h2>
        <p>{perfil.rol}</p>

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default App
