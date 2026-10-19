import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import logoEcocycle from '../assets/ecocycle-logo.png'

function RecuperarCotrasena() {
    const [contrasena, setContrasena] = useState('')
    const [confirmarContrasena, setConfirmarContrasena] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [cargando, setCargando] = useState(false)
    const [completado, setCompletado] = useState(false)

    const cambiarContrasena = async (e) => {
        e.preventDefault()
        setMensaje('')

        if (contrasena.length < 8) {
            setMensaje('La contraseña debe tener al menos 8 caracteres')
            return
        }

        if (contrasena !== confirmarContrasena) {
            setMensaje('Las contraseñas no coinciden')
            return
        }

        setCargando(true)

        try {
            const { error } = await supabase.auth.updateUser({
                password: contrasena
            })

            if (error) {
                console.error('Error al cambiar contrasena:', error)
                setMensaje('No fue posible actualizar la contraseña')
                return
            }

            setCompletado(true)
            setMensaje('Contraseña atualizada correctamente')

        } catch (error) {
            console.error('Error inesperado:', error)
            setMensaje('Ocurrio un error inesperado')

        } finally {
            setCargando(false)
        }
    }

    const volverAlLogin = async () => {
        setMensaje('')

        const { error } = await supabase.auth.signOut()

        if (error) {
            console.log('Error al cerrar sesion:', error)
            setMensaje('No fue posible cerrar la sesion')
        }
    }

    return (
        <main className='eco-reset'>
            <section className='eco-reset-card'>

                <header className='eco-reset-header'>
                    <img
                        src={logoEcocycle}
                        alt="Logo EcoCycle"
                        className='eco-reset-logo'
                    />

                    <h1>Restablecer Contraseña</h1>
                    <p>
                        Crea una nueva contraseña para recuperar
                        el acceso de tu cuenta
                    </p>
                </header>

                {completado ? (
                    <div className="eco-reset-success">
                        <div className='eco-reset-success'>
                            <span className='eco-reset-success-icon'></span>
                            <h2>¡Contraseña actualizada!</h2>
                            <p>{mensaje}</p>
                        </div>

                        <button
                            type='button'
                            className='eco-reset-button'
                            onClick={volverAlLogin}
                        >
                            Volver al inicio de sesion
                        </button>
                    </div>
                ) : (
                    <form
                        className='eco-reset-form'
                        onSubmit={cambiarContrasena}
                    >
                        <div className='eco-reset-field'>
                            <label htmlFor="nueva-contrasena">
                                Nueva contraseña
                            </label>

                            <input
                                id='nueva-contrasena'
                                type="password"
                                value={contrasena}
                                onChange={(e) => setContrasena(e.target.value)}
                                minLength={8}
                                autoComplete='new-password'
                                placeholder='Minimo 8 caracteres'
                                required
                            />
                        </div>

                        <div className='eco-reset-field'>
                            <label htmlFor="confirmar-contrasena">
                                Confirmar Contrasena
                            </label>

                            <input
                                id='confirmar-contrasena'
                                type="password"
                                value={confirmarContrasena}
                                onChange={(e) => setConfirmarContrasena(e.target.value)}
                                minLength={8}
                                autoComplete='new-password'
                                placeholder='Repite tu contraseña'
                                required
                            />
                        </div>

                        <div className='eco-reset-hint'>
                            <span aria-hidden="true"></span>
                                Utiliza una contraseña segura que no hallas utilizado antes
                        </div>

                        {mensaje && (
                            <p className='eco-reset-message' role='alert'>
                                {mensaje}
                            </p>
                        )}

                        <button
                            type='submit'
                            className='eco-reset-button'
                            disabled={cargando}
                        >
                            {cargando
                            ?'Actualizando contraseña..'
                            :'Guardar nueva contraseña'}
                        </button>
                    </form>
                )}

                <footer className='eco-reset-footer'>
                    <span className='eco-reset-footer-mark'></span>
                        EcoCycle. ¡Recicla hoy!
                </footer>
            </section>
        </main>
    )
}

export default RecuperarCotrasena