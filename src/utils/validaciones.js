
export function normalizarTelefono(telefono) {
    return String(telefono ?? '').trim().replace(/[\s()-]/g, '')
}

export function validarTelefonoColombiano(telefono) {
    const normalizado = normalizarTelefono(telefono)

    return /^3\d{9}$/.test(normalizado)
}

export const requisitosContrasena =
    'Usa al menos 8 caracteres e incluye una mayuscula, una minuscula, un numero y un simbolo.'

export function validarContrasena(contrasena) {
    return contrasena.length >= 8 &&
        /[A-Z]/.test(contrasena) &&
        /[a-z]/.test(contrasena) &&
        /[0-9]/.test(contrasena) &&
        /[^A-Za-z0-9\s]/.test(contrasena)
}

export function mensajeSinConexion() {
    return globalThis.navigator?.onLine === false
        ? 'No tienes conexion a internet. Revisa tu Wi-Fi o tus datos moviles y vuelve a intentarlo.'
        : null
}

export function mensajeErrorAuth(error, mensajePredeterminado) {
    const sinConexion = mensajeSinConexion()
    if (sinConexion) return sinConexion

    const detalle = error?.message ?? ''
    if (error?.name === 'AuthRetryableFetchError' ||
        /failed to fetch|network request failed|networkerror|load failed|timeout/i.test(detalle)) {
        return 'No pudimos conectar con EcoCycle. Revisa tu conexion e intentalo de nuevo.'
    }

    if (error?.status === 429 || /rate limit/i.test(detalle)) {
        return 'Hay demasiados intentos recientes. Espera unos minutos y vuelve a intentarlo.'
    }

    if (error?.status >= 500) {
        return 'EcoCycle no esta disponible temporalmente. Intenta de nuevo en unos minutos.'
    }

    return mensajePredeterminado
}
