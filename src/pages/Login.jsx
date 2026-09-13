import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

function Login({ irARegistro }) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  const iniciarSesion = async (e) => {
    if(!correo || !contrasena){
      setMensaje('Ingresa tu correo y contraseña')
      return
    }

    setCargando(true)
    setMensaje('')

    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena
    })

    if (error) {
      setMensaje('Erroro al inciar sesión:', error)

      if(error.message.includes('Invalid login credentials')){
        setMensaje('Correo o contrasena incorrectos')
      } else if (error.message.includes('Email not confirmed')){
        setMensaje('Debes verificar tu correo antes de inicar sesion')
      } else{
        setMensaje('No fue posible iniciar sesion')
      }

      setCargando(false)
      return
    }

    setCargando(false)
  }

  return (
    <div className="login-pagina">
      <div className="login-fondo-decoracion login-circulo1"></div>
        <div className='login-fondo-decoracion login-circulo2'></div>
        <div className='login-tarjeta'>
          <div className='login-logo-contenedor'>
            <img src={logoEcocycle} alt="Logo EcoCycle" className='login-logo' />
          </div>

          <div className='login-encabezado'>
            <h1>Bienvenido de nuevo</h1>

            <p>Ingresa a tu cuenta y continua aportando 
              a un futuro sostenible
            </p>
          </div>

          <div className='login-formulario'>

            <label htmlFor="correo"> Correo electronico</label>
              <input
                id='correo'
                type="email"
                placeholder="correo@ejemplo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />

              
            <label htmlFor='contrasena'>Contraseña</label>
            <div className='login-password-contenedor'>
              <input
                id='contrasena'
                type={mostrarContrasena ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
              />
              <button
                type='button'
                className='login-mostrar-password'
                onClick={() =>setContrasena(!mostrarContrasena)}>
                  {mostrarContrasena ? 'ocultar' : 'ver'}
                </button>
            </div>

            {mensaje && (
              <p className='login-mensaje'>
                {mensaje}
              </p>
            )}

            <button
              className='login-boton-principal'
              onClick={iniciarSesion}
              disabled={cargando}>
                {cargando ? 'Ingresando...' : 'Inicianar sesion'}
              </button>

              <div className='login-separador'>
                <span></span>
                <p>EcoCycle</p>
                <span></span>
              </div>

              <div className='login-registro'>
                <p>¿Aun no tienes cuenta?</p>

                <button
                  type='botton'
                  onClick={irARegistro}
                  className='login-boton-registro'>
                    Crear cuenta
                  </button>
              </div>
        </div>
      </div>
    </div>      
  )
}
export default Login
