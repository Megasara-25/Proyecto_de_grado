import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function RecuperarCotrasena(){
    const [contrasena, setContrasena] = useState('')
    const [confirmarContrasena, setConfirmarContrasena] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [cargando, setCargando] = useState(false)
    const [completado, setCompletado] = useState(false)

    const cambiarContrasena = async (e) => {
        e.preventDefault()
        setMensaje('')

        if(contrasena.length < 8){
            setMensaje('La contraseña debe tener al menos 8 caracteres')
            return
        }

        if(contrasena !== confirmarContrasena){
            setMensaje('Las contraseñas no coinciden')
            return
        }

        setCargando(true)

        try{
            const {error} = await supabase.auth.updateUser({
                password:contrasena
            })

            if(error){
                console.error('Error al cambiar contrasena:', error)
                setMensaje('No fue posible actualizar la contraseña')
                return
            }

            setCompletado(true)
            setMensaje('Contraseña atualizada correctamente')

        } catch(error){
            console.error('Error inesperado:', error)
            setMensaje('Ocurrio un error inesperado')

        } finally{
            setCargando(false)
        }
    }

    const volverAlLogin = async () => {
        setMensaje('')

        const{error} = await supabase.auth.signOut()

        if(error){
            console.log('Error al cerrar sesion:', error)
            setMensaje('No fue posible cerrar la sesion')
        }
    }

    return(
        <div className=' contenedor'>
            <div className='tarjeta'>
                <h1>EcoCycle</h1>
                <h2>Restablecer Contraseña</h2>

                {completado ?(
                    <>
                    <p>{mensaje}</p>

                    <button onClick={volverAlLogin}>
                        Volver al inicio de sesion
                    </button>
                    </>
                ) :(
                    <form onSubmit={cambiarContrasena}>
                        <p>Ingresa tu nueva contraseña para recuperar el acceso de tu cuenta</p>
                        <label htmlFor="nueva-contrasema">
                            Nueva Contraseña
                        </label>

                        <input
                            id='nueva-contraseña'
                            type='password'
                            value={contrasena}
                            onChange={(e) => setContrasena(e.target.value)}
                            minLength={8}
                            autoComplete='new-password'
                            required 
                        />

                        <label htmlFor="confirmar-contrasena">
                            Confirmar Contraseña
                        </label>

                        <input 
                            id='confrimar-Contrasena'
                            type='password'
                            value={confirmarContrasena}
                            onChange={(e) => setConfirmarContrasena(e.target.value)}
                            minLength={8}
                            autoComplete='new-password'
                            required
                        />

                        {mensaje && <p>{mensaje}</p>}

                        <button type='submit' disabled={cargando}>
                            {cargando
                                ?'Actualizando...'
                                :'Guardar nueva contraseña'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default RecuperarCotrasena