function Comercio({ perfil, cerrarSesion }) {
  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h1>EcoCycle</h1>
        <h2>Panel del comercio aliado</h2>

        <p>
          Bienvenido, <strong>{perfil.nombre}</strong>
        </p>

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Comercio
