function Reciclador({ perfil, cerrarSesion }) {
  return (
    <div className="contenedor">
      <div className="tarjeta">
        <h1>EcoCycle</h1>
        <h2>Panel del reciclador</h2>

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

export default Reciclador
