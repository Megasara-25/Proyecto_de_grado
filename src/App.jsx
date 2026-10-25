
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import RecuperarContrasena from './pages/RecuperarContrasena'
import Login from './pages/Login'
import Ciudadano from './pages/Ciudadano'
import Reciclador from './pages/Reciclador'
import Comercio from './pages/Comercio'
import Registro from './pages/Registro'
import Admin from './pages/Admin'
import Bienvenida from './pages/Bienvenida'
import './App.css'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarRegistro, setMostrarRegistro] = useState(false)
  const [mostrarBienvenida, setMostrarBienvenida] = useState(() => {
    try{
      return localStorage.getItem('ecocycle_bienvenida_v1') !== 'vista'
    } catch {
      return true
    }
  })
  const [correoConfirmado, setCorreoConfirmado] = useState(false)
  const [recuperandoContrasena, setRecuperandoContrasena] = useState(false)
  const [errorAutenticacion, setErrorAutenticacion] = useState('')

  const obtenerPerfil = async (user) => {
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
      console.error('No fue posible cargar el perfil')
      setPerfil(null)
      setCargando(false)
      return
    }

    let estadoValidacion = null

    if (data.rol === 'reciclador') {
      const { data: reciclador, error: errorReciclador } = await supabase
        .from('reciclador')
        .select('estado_validacion')
        .eq('usuarioid', data.id)
        .single()

      if (errorReciclador) {
        console.error('No fue posible consultar la validación del reciclador')
      } else {
        estadoValidacion = reciclador?.estado_validacion ?? null
      }
    }

    if (data.rol === 'comercio_aliado') {
      const { data: comercio, error: errorComercio } = await supabase
        .from('comercio_aliado')
        .select('estado_validacion')
        .eq('usuarioid', data.id)
        .single()

      if (errorComercio) {
        console.error('No fue posible consultar la validación del comercio')
      } else {
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
    let activo = true
    let listenerEnlaces = null

    const procesarEnlace = async (url) => {
      if (!url || !activo) return

      let enlace

      try {
        enlace = new URL(url)
      } catch {
        return
      }

      const esEnlaceMovil =
        enlace.protocol === 'com.ecocycle.app:' &&
        enlace.hostname === 'auth' &&
        (
          enlace.pathname === '/callback' ||
          enlace.pathname === '/reset-password'
        )

      const esEnlaceWeb =
        enlace.origin === window.location.origin

      if (!esEnlaceMovil && !esEnlaceWeb) return

      const fragmento = new URLSearchParams(
        enlace.hash.replace(/^#/, '')
      )

      const obtenerParametro = (nombre) =>
        enlace.searchParams.get(nombre) || fragmento.get(nombre)

      const errorEnlace =
        obtenerParametro('error_description') ||
        obtenerParametro('error')

      if (errorEnlace) {
        setErrorAutenticacion(
          'El enlace de autenticación es inválido o ha caducado. Solicita uno nuevo.'
        )
        return
      }

      const tipo = obtenerParametro('type')
      const codigo = obtenerParametro('code')
      const tokenHash = obtenerParametro('token_hash')
      const accessToken = obtenerParametro('access_token')
      const refreshToken = obtenerParametro('refresh_token')

      const esRecuperacion =
        enlace.pathname === '/reset-password' ||
        tipo === 'recovery'

      const esConfirmacion =
        tipo === 'signup' ||
        tipo === 'email'

      const esEnlaceAutenticacion =
        Boolean(
          codigo ||
          tokenHash ||
          (accessToken && refreshToken)
        )

      if (!esEnlaceAutenticacion) return

      setCargando(true)
      setErrorAutenticacion('')

      try {
        let resultado

        if (codigo) {
          resultado = await supabase.auth.exchangeCodeForSession(codigo)
        } else if (tokenHash) {
          const tipoVerificacion = esRecuperacion
            ? 'recovery'
            : esConfirmacion
              ? tipo
              : null

          if (!tipoVerificacion) {
            throw new Error('Tipo de enlace no reconocido')
          }

          resultado = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: tipoVerificacion
          })
        } else if (accessToken && refreshToken) {
          resultado = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
        }

        if (resultado?.error) {
          throw resultado.error
        }

        const usuarioEnlace = resultado?.data?.user ||
          resultado?.data?.session?.user

        if (esRecuperacion) {
          setRecuperandoContrasena(true)
          setCorreoConfirmado(false)
        } else if (esConfirmacion) {
          setCorreoConfirmado(true)
          setRecuperandoContrasena(false)
        }

        if (usuarioEnlace) {
          await obtenerPerfil(usuarioEnlace)
        } else {
          const { data } = await supabase.auth.getUser()
          await obtenerPerfil(data.user)
        }
      } catch {
        setErrorAutenticacion(
          'No fue posible validar el enlace. Puede haber caducado o ya haberse utilizado.'
        )
        setCargando(false)
      }
    }

    const inicializar = async () => {
      if (Capacitor.isNativePlatform()) {
        listenerEnlaces = await CapacitorApp.addListener(
          'appUrlOpen',
          ({ url }) => {
            void procesarEnlace(url)
          }
        )

        const lanzamiento = await CapacitorApp.getLaunchUrl()

        if (lanzamiento?.url) {
          await procesarEnlace(lanzamiento.url)
        }
      } else {
        const url = new URL(window.location.href)

        const parametros = new URLSearchParams(
          url.hash.replace(/^#/, '')
        )

        const errorEnlace =
          url.searchParams.get('error') ||
          parametros.get('error')

        if (errorEnlace) {
          setErrorAutenticacion('El enlace es inavlido o ha cauducado. solicita uno nuevo')
        }
      }

      const { data } = await supabase.auth.getSession()

      if (activo) {
        await obtenerPerfil(data.session?.user ?? null)
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!activo) return

      if (event === 'PASSWORD_RECOVERY') {
        setRecuperandoContrasena(true)
        setCorreoConfirmado(false)
      }

      if (event === 'SIGNED_OUT') {
        setRecuperandoContrasena(false)
        setCorreoConfirmado(false)
      }
      setTimeout(() => {
        if (activo) {
          void obtenerPerfil(session?.user ?? null)
        }
      }, 0)
    })

    void inicializar()

    return () => {
      activo = false
      subscription.unsubscribe()
      if (listenerEnlaces) {
        void listenerEnlaces.remove()
      }
    }
  }, [])

  const finalizarBienvenida = (destino) => {
    try{
      localStorage.setItem('ecocycle_bienvenida_v1', 'vista')
    } catch {
    
    }

    setMostrarBienvenida(false)
    setMostrarRegistro(destino === 'registro')
  }

  const cerrarSesion = async () => {
    setRecuperandoContrasena(false)
    setCorreoConfirmado(false)
    setErrorAutenticacion('')

    await supabase.auth.signOut()
    setUsuario(null)
    setPerfil(null)
  }

  if (recuperandoContrasena) {
    return <RecuperarContrasena />
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

  if (errorAutenticacion) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Problema con el enlace</h2>
          <p>{errorAutenticacion}</p>
          <button onClick={() => setErrorAutenticacion('')}>
            Continuar
          </button>
        </div>
      </div>
    )
  }

  if (correoConfirmado) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Correo verificado correctamente</h2>
          <p>Tu cuenta de EcoCycle ya está activa.</p>
          <button onClick={() => setCorreoConfirmado(false)}>
            Continuar
          </button>
        </div>
      </div>
    )
  }

  if (!usuario) {
    if (mostrarBienvenida) {
      return (
        <Bienvenida
          irALogin={() => finalizarBienvenida('login')}
          irARegistro={() => finalizarBienvenida('registro')} 
        />
      )
    }

    if(mostrarRegistro){
      return (
        <Registro volverLogin={() => setMostrarRegistro(false)} />
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
          <h2>No se encontro el perfil del usuario</h2>
          <button onClick={cerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </div>
    )
  }

  if (
    (perfil.rol === 'reciclador' ||
      perfil.rol === 'comercio_aliado') &&
    perfil.estado_validacion === 'Pendiente'
  ) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Solicitud pendiente de validacion</h2>
          <p>
            Tu cuenta fue registrada correctamente, pero debe
            ser aprobada por EcoCycle antes de utilizar este perfil
          </p>
          <button onClick={cerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </div>
    )
  }

  if (
    (perfil.rol === 'reciclador' ||
      perfil.rol === 'comercio_aliado') &&
    perfil.estado_validacion === 'Rechazado'
  ) {
    return (
      <div className="contenedor">
        <div className="tarjeta">
          <h2>Solicitud no aprobada</h2>
          <p>Tu solicitud no fue aprobada por EcoCycle</p>
          <button onClick={cerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </div>
    )
  }

  if (perfil.rol === 'admin') {
    return <Admin perfil={perfil} cerrarSesion={cerrarSesion} />
  }

  if (perfil.rol === 'ciudadano') {
    return <Ciudadano perfil={perfil} cerrarSesion={cerrarSesion} />
  }

  if (perfil.rol === 'reciclador') {
    return <Reciclador perfil={perfil} cerrarSesion={cerrarSesion} />
  }

  if (perfil.rol === 'comercio_aliado') {
    return <Comercio perfil={perfil} cerrarSesion={cerrarSesion} />
  }

  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h2>Rol no reconocido</h2>
        <p>{perfil.rol}</p>
        <button onClick={cerrarSesion}>
          Cerrar sesion
        </button>
      </div>
    </div>
  )
}

export default App
