import { useState, useEffect} from 'react'
import { supabase } from '../lib/supabase'

function Comercio({ perfil, cerrarSesion }) {
  const [tipoDocumento, setTipoDocumento] = useState ('')
  const [numeroDocumento, setNumeroDocumento] = useState ('')
  const [codigoCanje, setCodigoCanje] = useState ('')
  const [mensaje, setMensaje] = useState ('')
  const [comercioId, setComercioId] = useState(null)
  const [canjeEncontrado, setCanjeEncontrado] = useState(null)
  const [confirmandoCanje, setConfirmandoCanje] = useState(false)
  const [datosComercio, setDatosComercio] = useState(null)
  const [misRecompensas, setMisRecompensas] = useState([])
  const [historialCanjes, setHistorialCanjes] = useState([])

  const cargarComercio = async () =>{
    const {data, error} = await supabase
    .from('comercio_aliado')
    .select('id, nombre_comercio, estado_validacion')
    .eq('usuarioid', perfil.id)
    .single()

  if (error){
    console.error('Error al cargar comercio:', error)
    return
  }

  setDatosComercio(data)
  cargarMisRecompensas(data.id)
  console.log('Comercio autenticado:', data. id)
  }

  useEffect(() => {
    cargarComercio()
    cargarHistorialCanjes()
  }, [])

  const cargarMisRecompensas = async (idComercio) =>{
    const {data, error} = await supabase
    .from('recompensas')
    .select(`
      id,
      nombre,
      descripcion,
      puntos_requeridos,
      cantidad_disponible,
      estado,
      categoria
    `)
    .eq('comercioid', idComercio)
    .order('id', {ascending: false})

  if(error){
    console.error('Error al cargar recompensas:', error)
    return
  }
  setMisRecompensas(data)
}

  const cargarHistorialCanjes = async () => {
    const {data, error} = await supabase.rpc(
      'historial_canjes_comercio'
    )

    if (error) {
      console.error('Error al cargar historial:', error)
      return
    }

    setHistorialCanjes(data || [])
    console.log('Historial del comercio:', data)
  }

  const buscarCanje = async () =>{

    setMensaje('')
    setCanjeEncontrado(null)

    if(!tipoDocumento || ! numeroDocumento.trim() || !codigoCanje.trim()){
      setMensaje('Debes completar todos los campos')
      return
    }

    if(!/^\d{6}$/.test(codigoCanje.trim())){
      setMensaje('El codigo de canje debe tener 6 digitos')
      return
    }

    const {data, error} = await supabase.rpc(
      'buscar_canje_comercio',
      {
        p_tipo_documento: tipoDocumento,
        p_numero_documento: numeroDocumento,
        p_codigo_canje: codigoCanje
      }
    )

  if (error){
    console.error('Error al buscar canje:', error)
    setMensaje('No te fue posible validar el canje')
    return
  }

  if(data.length === 0){
    setCanjeEncontrado(null)
    setMensaje('No se encontro un canje valido')
    return
  }
  setCanjeEncontrado(data[0])
    setMensaje('')

  console.log('Canje encontrado:', data)
  }

  const confirmarCanje = async () =>{
    if(confirmandoCanje || !canjeEncontrado)return

    setConfirmandoCanje(true)
    setMensaje('')

    try{
      const {data, error} = await supabase.rpc(
        'confirmar_canje_comercio',
        {
          p_canje_id: canjeEncontrado.canje_id,
          p_codigo_canje: codigoCanje
        }
      )

    if (error){
      console.error('Error al confirmar canje:', error)
      setMensaje('No fue posible confirmar el canje')
      return
    }

    if(!data){
      setMensaje('El canje ya fue utilizado o no es valido')
      setCanjeEncontrado(null)
      return
    }

    setMensaje('Canje confirmado correctamente')
    await cargarHistorialCanjes()

    setCanjeEncontrado({
      ...canjeEncontrado,
      estado_canje:'Canjeado'
    })

  } catch (error){
    console.error('Error inseperado:', error)
    setMensaje('Ocurrio un error al confirmar el canje')

  } finally{
    setConfirmandoCanje(false)
  }
}

  console.log('Mis recompensas:', misRecompensas)

  return (
    <div className="comercio-pagina">
      <div className="comercio-panel">
        <header className='comercio-header'>
          <div>
            <h1>EcoCycle</h1>
            <h2>Panel del comercio aliado</h2>
          </div>

          <button
            className='comercio-boton-salir'
            onClick={cerrarSesion}
          >
            Cerrar sesion
          </button>
        </header>

        <section className='comercio-bienvenido'>
          <div>
            <span>Comercio aliado</span>
            <h2>{datosComercio?.nombre_comercio || perfil.nombre}</h2>
            <p>Administra tus beneficios y valida los canjes de tus clientes</p>
          </div>

          <span className='comercio-estado'>
            {datosComercio?.estado_validacion || 'Cargando...'}
          </span>
        </section>

        <section className='comercio-recompensas'>
          <h2>Mis recompensas</h2>

          {misRecompensas.length === 0?(
            <p>Este comercio todavia no tiene recompensas registradas.</p>
          ):(
            <div className='comercio-recompensas-grid'>
              {misRecompensas.map((recompensa) =>(
                <div
                key={recompensa.id}
                className='comercio-recompensa-card'
                >
                  <span>{recompensa.categoria}</span>

                  <h3>{recompensa.nombre}</h3>

                  <p>{recompensa.descripcion}</p>

                  <p>
                    <strong>{recompensa.puntos_requeridos}</strong> Ecopuntos
                  </p>

                  <p>
                    Disponibles:{recompensa.cantidad_disponible}
                  </p>

                  <p>Estado:{recompensa.estado}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className='comercio-validacion'>
          <div className='comercio-validacion-encabezado'>
            <span>Gestion de beneficios</span>
            <h2>Validar canje</h2>

            <p>
              Ingresa el documento del ciudadano y su codigo, 
              para consultar y confirmar la recompensa.
            </p>
          </div>

        <label>tipo de documento</label>
        <select 
          value={tipoDocumento}
          onChange={(e) => setTipoDocumento (e.target.value)}
        >
          <option value="">Seleccione</option>
          <option value ="CC">CC</option>
          <option value="TI">TI</option>
          <option value="CE">CE</option>
          <option value="PASAPORTE">Pasaporte</option>
        </select>

        <label>Numero de documento</label>
        <input 
          type="text"
          value={numeroDocumento}
          onChange={(e) => setNumeroDocumento(e.target.value)}
          placeholder='Numero de coumento' 
        />

        <label>Codigo de canje</label>
        <input type="text"
          value={codigoCanje}
          onChange={(e) => setCodigoCanje(e.target.value)}
          placeholder='Codigo de 6 digitos' 
        />
        <button onClick={buscarCanje}>
          Validar canje
        </button>

        {canjeEncontrado && (
          <div>

            <h3>Canje encontrado</h3>

            <p>
              Ciudadano: {canjeEncontrado.nombre_ciudadano}
            </p>

            <p>
              Recompensa: {canjeEncontrado.nombre_recompensa}
            </p>

            <p>
              EcoPunto utilizados: {canjeEncontrado.puntos_canje}
            </p>

            <p>
              Estado: {canjeEncontrado.estado_canje}
            </p>

            {canjeEncontrado.estado_canje === 'Pendiente' &&(

              <button 
              onClick={confirmarCanje}
              disabled={confirmandoCanje}
              >
                {confirmandoCanje ? 'Confirmando...' : 'Confirmar canje'}
              </button>
            )}
          </div>
        )}
        {mensaje &&(
              <p>{mensaje}</p>
            )}
        </section> 
        <section className='comercio-historial'>
          <div className='comercio-historial-encabezado'>
            <h2>Historial de canjes</h2>
            <p>Consulta las recompensas utilizadas en tu comercio</p>
          </div>

          {historialCanjes.length === 0 ? (
            <p>Todavia no hay canjes confirmados</p>
          ) : (
            <div className='comercio-tabla-contenedor'>
              <table className='comercio-tabla'>
                <thead>
                  <tr>
                    <th>Recompensas</th>
                    <th>Ecopuntos</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {historialCanjes.map((canje) => (
                    <tr key={canje.canje_id}>
                      <td>{canje.nombre_recompensa}</td>
                      <td>{canje.canje_recompensa}</td>
                      <td>{canje.puntos_utilizados}</td>
                      <td>
                        {new Date(canje.fecha_canje).toLocaleDateString('es-CO')}
                      </td>
                      <td>
                        <span className='comercio-estado.canje'>
                          {canje.estado_canje}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>   
      </div>
    </div>
  )
}

export default Comercio
