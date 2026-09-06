import { useState } from 'react'
import { supabase } from '../lib/supabase'

function Login({ irARegistro }) {
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')

  const iniciarSesion = async (e) => {
    e.preventDefault()

    setMensaje('Iniciando sesión...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password
    })

    if (error) {
      setMensaje('Error: ' + error.message)
      return
    }

    setMensaje('')
    onLogin(data.user)
  }

  return (
    <div className="contenedor">
      <div className="tarjeta">

        <h1>EcoCycle</h1>

        <p className="subtitulo">
          Recicla, acumula EcoPuntos y obtén beneficios.
        </p>

        <form onSubmit={iniciarSesion}>

          <label>Correo electrónico</label>

          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />

          <label>Contraseña</label>

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">
            Iniciar sesión
          </button>

          <p className='texto_registro'>
            ¿Aun no tienes cuenta?
          </p>

          <button type='button'
            onClick={irARegistro}>
            Crear cuenta
          </button>
        </form>

        {mensaje && (
          <p className="mensaje">
            {mensaje}
          </p>
        )}

      </div>
    </div>
  )
}

export default Login
