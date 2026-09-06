import { useState } from "react";
import { supabase } from '../lib/supabase'

function Registro({ volverLogin }){
    const [nombre, setNombre] = useState ('')
    const [correo, setCorreo] = useState ('')
    const [contrasena, setContrasena] = useState ('')
    const [tipoDocumento, setTipoDocumento] = useState ('')
    const [numeroDocumento, setNumeroDocumento] = useState ('')
    const [telefono, setTelefono] = useState ('')
    const [fechaNacimiento, setFechaNacimiento] = useState ('')
    const [rol, setRol] = useState('ciudadano')
    const [confirmarContrasena, setConfirmarContrasena] = useState ('')
    const [mensaje, setMensaje] = useState ('')

    const registrarUsuario = async () => {

        if( !nombre ||
            !correo ||
            !contrasena ||
            !confirmarContrasena ||
            !tipoDocumento ||
            !numeroDocumento ||
            !telefono ||
            !fechaNacimiento 
        ) {
            setMensaje('Debes completar todos los campos')
            return
        }

        if(contrasena != confirmarContrasena){
            setMensaje('Las contraseñas no coinciden')
            return
        }

        if( contrasena.length < 8) {
            setMensaje('La contraseña debe tener minimo 8 caracteres')
            return
        }
        const tieneMayuscula = /[A-Z]/.test(contrasena)
        const tieneMinuscula = /[a-z]/.test(contrasena)
        const tieneNumero = /[0-9]/.test(contrasena)
        const tieneSimbolo = /[^A-Za-z0-9]/.test(contrasena)

        if(
            !tieneMayuscula ||
            !tieneMinuscula ||
            !tieneNumero ||
            !tieneSimbolo
        ) {
            setMensaje('La contraseña debe incluir mayusculas, minisculas, numero y simbolo')
            return
        }

        setMensaje('')

        const {data, error} = await supabase.auth.signUp({
            email: correo,
            password: contrasena,
            options: {
                data: {
                    nombre: nombre,
                    tipo_documento: tipoDocumento,
                    numero_documento: numeroDocumento,
                    telefono: telefono,
                    fecha_nacimiento: fechaNacimiento,
                    rol: rol
                },
                emailRedirectTo: 'http://localhost:5173'
            }
        })

        if (error){
            console.log('Error al registrar usuario:', error)

            if(error.message.includes('email rate limit exceeded')){
                setMensaje('se alcanzo temporalmente el limite de envio de correos. Intenta nuevamente ams tarde')
                return
            }
            setMensaje('No fue posible crear la cuenta')
            return
        }
        console.log('Usuario registrado:', data)

        setMensaje('Cuenta creada. Revisa tu correo electronico para verificar tu cuenta')
    }

    return (
        <div className="contenedor">
            <div className="tarjeta">
                <h2>EcoCycle</h2>
                <h2>Crear cuenta</h2>

                <label>Nombre completo</label>
                <input type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />

                <label>Correo electronico</label>
                <input type="text"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                />

                <label>Contraseña</label>
                <input type="password"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                />

                <label>Confirmar contraseña</label>
                <input type="password"
                    value={confirmarContrasena}
                    onChange={(e) => setConfirmarContrasena(e.target.value)}
                />

                <label>Tipo de documento</label>
                <select value = {tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    >
                        <option value="">Seleccione</option>
                        <option value="CC">CC</option>
                        <option value="TI">TI</option>
                        <option value="CE">CE</option>
                        <option value="PASAPORTE">Pasaporte</option>
                    </select>

                    <label>Numero de documento</label>
                    <input type="text"
                        value={numeroDocumento}
                        onChange={(e) => setNumeroDocumento(e.target.value)}
                    />

                    <label>Telefono</label>
                    <input type="text"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                    />

                    <label>Fecha de nacimiento</label>
                    <input type="date"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                    />

                    <label>Tipo de cuenta</label>
                    <select value = {rol}
                        onChange={(e) => setRol(e.target.value)}
                    >
                        <option value="ciudadano">Ciudadano</option>
                        <option value="reciclador">Reciclador</option>
                        <option value="comercio_aliado">Comercio aliado</option>
                    </select>

                    <button onClick={registrarUsuario}>
                        Registrarme
                    </button>

                    {mensaje &&(
                        <p>{mensaje}</p>
                    )}

                    <button onClick={volverLogin}>
                        Volver al inicio de Sesion
                    </button>
            </div>
        </div>
    )
}

export default Registro