import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Ciudadano from './pages/Ciudadano'
import Reciclador from './pages/Reciclador'
import Comercio from './pages/Comercio'
import './App.css'
import Registro from './pages/Registro'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarRegistro, setMostrarRegistro] = useState(false)
  const [correoConfirmado, setCorreoConfirmado] = useState(false)

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

    if (error || !data) {
      console.error('Error cargando perfil:', error)
      setPerfil(null)
      setCargando(false)
      return
    }

    let estadoValidacion = null

    if(data.rol === 'reciclador'){
      const {data: reciclador, error: errorReciclador}= await supabase
      .from ('reciclador')
      .select('estado_validacion')
      .eq('usuarioid', data.id)
      .single()

      if (errorReciclador){
      console.error('Error cargando validacion del reciclador:', errorReciclador)
      }else{
        estadoValidacion = reciclador?.estado_validacion ?? null
      }
    }

    if (data.rol === 'comercio_aliado'){
      const { data: comercio, error: errorComercio} = await supabase
      .from('comercio_aliado')
      .select('estado_validacion')
      .eq('usuarioid', data.id)
      .single()

      if (errorComercio){
        console.error('Error cargando validacion del comercio:', errorComercio)
      }else{

        console.log('Estado del comercio:', comercio?.estado_validacion)
        
        estadoValidacion = comercio?.estado_validacion ?? null
      }
    } 

    setPerfil({
      ...data,
      estado_validacion: estadoValidacion
    })

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
      if(event === 'SIGNED_IN' && session?.user?.email_confirmed_at){
        setCorreoConfirmado(true)
      }

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
    if(mostrarRegistro){
      return(
        <Registro volverLogin={() => setMostrarRegistro(false)}/>
      )
    }

      return(
      <Login irARegistro={() => setMostrarRegistro(true)}/>
    )
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

   if(
      (perfil.rol === 'reciclador' || perfil.rol === 'comercio_aliado') &&
      perfil.estado_validacion == 'Pendiente'
    ) {
      return(
        <div className='contenedor'>
          <div className='tarjeta'>
            <h2> Solicitud pendiente de validacion</h2>

            <p>
              Tu cuenta fue registrada correctamente, pero debe
              ser aprobada por Ecocycle antes de utilizar este perfil
            </p>

            <button onClick={cerrarSesion}>
              Cerrar Sesion
            </button>
          </div>
        </div>
      )
    }

    if(
      (perfil.rol == 'reciclador' || perfil.rol === 'comercio_aliado') &&
      perfil.estado_validacion === 'Rechazado'
    ){
      return(
        <div className='contenedor'>
          <div className='tarjeta'>
            <h2>Solicitud no aprobada</h2>

            <p>
              Tu solicitud no fue aprobada por EcoCycle
            </p>

            <button onClick={cerrarSesion}>
              Cerrar Sesion
            </button>
          </div>
        </div>
      )
    }

  if(correoConfirmado){
    return(
      <div className='contenedor'>
        <div className='tarjeta'>
          <h2>Correo verificado correctamente</h2>

          <p>
            tu cuenta de Ecocycle ya esta activa 
          </p>

          <button onClick={() => setCorreoConfirmado(false)}>
            continuar
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
