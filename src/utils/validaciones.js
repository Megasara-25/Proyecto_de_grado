
export function normalizarTelefono(telefono) {
    return String(telefono ?? '').trim().replace(/[\s()-]/g, '')
}

export function validarTelefonoColombiano(telefono) {
    const normalizado = normalizarTelefono(telefono)

    return /^3\d{9}$/.test(normalizado)
}
