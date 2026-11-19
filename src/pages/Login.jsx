import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'
import { Capacitor } from '@capacitor/core'

const mensajeSinConexion = () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No hay conexion a internet. Revisa tu red e intentalo de nuevo.'
  }
  return null
}

const mensajeErrorAuth = (error, mensajePorDefecto) => {
  const texto = `${error?.message || ''}`.toLowerCase()
  if (
    error?.name === 'AuthRetryableFetchError' ||
    texto.includes('failed to fetch') ||
    texto.includes('network')
  ) {
    return 'No pudimos conectarnos. Revisa tu conexión e intentalo de nuevo.'
  }
  return mensajePorDefecto
}

function Login({ irARegistro }) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [recuperando, setRecuperando] = useState(false)

  const validarCorreo = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setMensaje('Ingresa un correo electronico valido.')
      return false
    }
    const sinConexion = mensajeSinConexion()
    if (sinConexion) {
      setMensaje(sinConexion)
      return false
    }
    return true
  }

  const recuperarContrasena = async () => {
    if (cargando || recuperando || !validarCorreo()) return

    setRecuperando(true)
    setMensaje('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: Capacitor.isNativePlatform()
          ? 'com.ecocycle.app://auth/reset-password'
          : window.location.origin + '/?type=recovery'
      })
      if (error) throw error
      setMensaje('Si el correo esta registrado, recibiras un enlace para restablecer tu contraseña.')
    } catch (error) {
      setMensaje(mensajeErrorAuth(error, 'No pudimos enviar el enlace. Intentalo de nuevo.'))
    } finally {
      setRecuperando(false)
    }
  }

  const iniciarSesion = async (e) => {
    e.preventDefault()
    if (cargando || recuperando || !validarCorreo()) return
    if (!contrasena) {
      setMensaje('Ingresa tu contraseña.')
      return
    }

    setCargando(true)
    setMensaje('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: contrasena
      })
      if (error) throw error
    } catch (error) {
      let textoError = 'No pudimos iniciar sesion. Intentalo de nuevo.'
      if (error?.code === 'invalid_credentials' || /invalid login credentials/i.test(error?.message)) {
        textoError = 'El correo o la contraseña son incorrectos. Verifica tus datos o recupera tu contraseña.'
      } else if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(error?.message)) {
        textoError = 'Revisa tu correo y confirma tu cuenta antes de iniciar sesión.'
      }
      setMensaje(mensajeErrorAuth(error, textoError))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-pagina">
      <div className="login-fondo-decoracion login-circulo1"></div>
      <div className="login-fondo-decoracion login-circulo2"></div>
      <div className="login-tarjeta">
        <div className="login-logo-contenedor">
          <img src={logoEcocycle} alt="Logo EcoCycle" className="login-logo" />
        </div>

        <div className="login-encabezado">
          <h1>Bienvenido de nuevo</h1>
          <p>Ingresa a tu cuenta y continua aportando a un futuro sostenible</p>
        </div>

        <form className="login-formulario" onSubmit={iniciarSesion} noValidate>
          <label htmlFor="correo">Correo electronico</label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />

          <label htmlFor="contrasena">Contraseña</label>
          <div className="login-password-contenedor">
            <input
              id="contrasena"
              type={mostrarContrasena ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
            />
            <button
              type="button"
              className="login-mostrar-password"
              aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setMostrarContrasena(!mostrarContrasena)}
            >
              {mostrarContrasena ? 'ocultar' : 'ver'}
            </button>
          </div>

          <button
            type="button"
            className="login-recuperar-password"
            onClick={recuperarContrasena}
            disabled={recuperando || cargando}
          >
            {recuperando ? 'Enviando correo...' : '¿Olvidaste tu contraseña?'}
          </button>

          {mensaje && <p className="login-mensaje">{mensaje}</p>}

          <button
            type="submit"
            className="login-boton-principal"
            disabled={cargando}
          >
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>

          <div className="login-separador">
            <span></span>
            <p>EcoCycle</p>
            <span></span>
          </div>

          <div className="login-registro">
            <p>¿Aun no tienes cuenta?</p>
            <button
              type="button"
              onClick={irARegistro}
              className="login-boton-registro"
            >
              Crear cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login