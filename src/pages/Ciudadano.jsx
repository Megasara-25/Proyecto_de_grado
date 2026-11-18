import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import MapaReciclaje from '../components/MapaReciclaje'

import paperyus from '../assets/personajes/paperyus.png'
import ferrax from '../assets/personajes/ferrax.png'
import flurosil from '../assets/personajes/flurosil.png'
import polaris from '../assets/personajes/polaris.png'
import tetrax from '../assets/personajes/tetrax.png'
import voltaje from '../assets/personajes/voltaje.png'
import logoEcocycle from '../assets/ecocycle-logo.png'
import { Evented } from 'leaflet'
import { validarTelefonoColombiano } from '../utils/validaciones'

const imagenesMateriales = {
  papel: paperyus,
  plastico: polaris,
  carton: tetrax,
  vidrio: flurosil,
  'metales y latas': ferrax,
  'pilas y baterias': voltaje
}

const normalizarMaterial = (nombre) =>
  (nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const DURACION_CODIGO_SEGUNDOS = 180

const formatearTiempoCanje = (segundos) => {
  const totalSegundos = Math.max(
    0,
    Math.min(DURACION_CODIGO_SEGUNDOS, Number(segundos) || 0)
  )
  const minutos = String(Math.floor(totalSegundos / 60)).padStart(2, '0')
  const restoSegundos = String(totalSegundos % 60).padStart(2, '0')
  return `${minutos}:${restoSegundos}`
}

function Ciudadano({ perfil, cerrarSesion }) {
  const [pestanaActiva, setPestanaActiva] = useState('inicio')
  const [materiales, setMateriales] = useState([])
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState([])
  const [cantidadesPorMaterial, setCantidadesPorMaterial] = useState({})
  const [recicladores, setRecicladores] = useState([])
  const [cargandoRecicladores, setCargandoRecicladores] = useState(false)
  const [recicladorSeleccionado, setRecicladorSeleccionado] = useState(null)
  const [registrandoEntrega, setRegistrandoEntrega] = useState(false)
  const consultaRecicladoresIdRef = useRef(0)
  const registrandoEntregaRef = useRef(false)
  const solicitudEntregaIdRef = useRef(null)
  const [ciudadanoId, setCiudadanoId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [entregas, setEntregas] = useState([])
  const [recompensas, setRecompensas] = useState([])
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todos')
  const [ultimoCanje, setUltimoCanje] = useState(null)
  const [canjesPendientes, setCanjesPendientes] = useState([])
  const [canjeConfirmadoReciente, setCanjeConfirmadoReciente] = useState(null)
  const [canjeCancelando, setCanjeCancelando] = useState(null)
  const [canjeRegenerando, setCanjeRegenerando] = useState(null)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [desfaseServidorMs, setDesfaseServidorMs] = useState(0)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())
  const [anuncioVencimiento, setAnuncioVencimiento] = useState('')
  const vencidosAnunciadosRef = useRef(new Set())
  const canjesPendientesRef = useRef([])
  const canjesResueltosIdsRef = useRef(new Set())
  const solicitudPendientesIdRef = useRef(0)
  const canalRealtimeRef = useRef(null)
  const canalEntregasRealtimeRef = useRef(null)
  const entregasRef = useRef([])
  const entregasResueltasRef = useRef(new Map())
  const solicitudEntregasIdRef = useRef(0)
  const [saldoEcopuntos, setSaldoEcopuntos] = useState(perfil.ecopuntos)
  const [recompensaCanjeando, setRecompensaCanjeando] = useState(null)

  const [nombreMostrado, setNombreMostrado] = useState(perfil.nombre || '')

  const [datosPerfil, setDatosPerfil] = useState({
    nombre: perfil.nombre || '',
    correo: perfil.correo || '',
    telefono: '',
    fecha_nacimiento: '',
    foto_perfil_url: null
  })

  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [mensajePerfil, setMensajePerfil] = useState('')
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null)
  const [fotoVistaPrevia, setFotoVistaPrevia] = useState(null)
  const [fotoActual, setFotoActual] = useState(null)

  const videosEducativos = [
    {
      id: 'paperyus',
      personaje: 'Paperyus',
      material: 'Papel',
      descripcion: 'Aprende a separar y preparar el papel para reciclarlo',
      imagen: paperyus,
      url: 'https://www.youtube.com/watch?v=F9w85cYCnkM'
    },

    {
      id: 'Tetrax',
      personaje: 'Tetrax',
      material: 'Carton',
      descripcion: 'Descubre como aprovechar y reciclar el carton',
      imagen: tetrax,
      url: 'https://www.youtube.com/watch?v=dUKOHLl-vHg'
    },
    {
      id: 'Polaris',
      personaje: 'Polaris',
      material: 'Plastico',
      descripcion: 'Aprende a reconocer y seprar residuos plasticos',
      imagen: polaris,
      url: 'https://www.youtube.com/watch?v=AXpnghigdkU'
    },
    {
      id: 'Flurosil',
      personaje: 'Flurosil',
      material: 'Vidrio',
      descripcion: 'Conoce como entregar adecuadamente los envases de vidrio',
      imagen: flurosil,
      url: 'https://www.youtube.com/watch?v=zof_Kw9aW8I'
    },
    {
      id: 'Voltaje',
      personaje: 'Voltaje',
      material: 'Pilas y baterias',
      descripcion: 'Aprende para que sirven las pilas y como reciclarlas',
      imagen: voltaje,
      url: 'https://www.youtube.com/watch?v=pDnRzqEFSMs'
    },
    {
      id: 'ferrax',
      personaje: 'Ferrax',
      material: 'Latas y metales',
      descripcion: 'Aprende a separar las latas y otros residuos etalicos',
      imagen: ferrax,
      url: 'https://www.youtube.com/watch?v=OJHAUWLSi_E'
    }
  ]

  const cargarMateriales = async () => {

    const { data, error } = await supabase
      .from('material')
      .select('*')

    if (error) {
      console.error('Error al cargar materiales:', error)
      return
    }

    setMateriales(data)
  }

  const sincronizarRelojServidor = (ahoraServidor) => {
    if (!ahoraServidor) return
    const servidorMs = new Date(ahoraServidor).getTime()
    if (!Number.isNaN(servidorMs)) {
      const nuevoDesfase = servidorMs - Date.now()
      setDesfaseServidorMs(nuevoDesfase)
      setAhoraMs(Date.now() + nuevoDesfase)
    }
  }

  const normalizarCanjePendiente = (canje) => ({
    id: canje.canje_id ?? canje.id,
    canje_id: canje.canje_id ?? canje.id,
    codigo_canje: canje.codigo_canje ?? null,
    puntos_utilizados: canje.puntos_utilizados,
    estado: canje.estado,
    fecha: canje.fecha ?? null,
    expira_en: canje.expira_en ?? null,
    es_historico: Boolean(canje.es_historico),
    puntos_descontados: Boolean(canje.puntos_descontados),
    recompensaid: canje.recompensaid ?? canje.recompensa_id ?? null,
    nombre_recompensa:
      canje.nombre_recompensa ||
      canje.recompensas?.nombre ||
      'Beneficio EcoCycle'
  })

  const cargarCanjesPendientes = async () => {
    const idSolicitud = ++solicitudPendientesIdRef.current

    const { data: dataRpc, error: errorRpc } = await supabase.rpc(
      'obtener_canjes_pendientes_ciudadano'
    )

    if (idSolicitud !== solicitudPendientesIdRef.current) {
      return canjesPendientesRef.current
    }

    if (errorRpc) {
      console.error('Error al cargar canjes pendientes:', errorRpc)
      return canjesPendientesRef.current
    }

    if (Array.isArray(dataRpc)) {
      if (dataRpc[0]?.ahora_servidor) {
        sincronizarRelojServidor(dataRpc[0].ahora_servidor)
      }
      const pendientes = dataRpc
        .filter((c) => c.estado === 'Pendiente')
        .map(normalizarCanjePendiente)
        .filter((c) => !canjesResueltosIdsRef.current.has(Number(c.id)))

      canjesPendientesRef.current = pendientes
      setCanjesPendientes(pendientes)
      return pendientes
    }

    canjesPendientesRef.current = []
    setCanjesPendientes([])
    return []
  }

  const cargarCiudadano = async () => {

    const { data, error } = await supabase
      .from('ciudadano')
      .select('id')
      .eq('usuarioid', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar ciudadano:', error)
      return
    }

    setCiudadanoId(data.id)
    cargarEntregas(data.id)
    cargarCanjesPendientes()
  }

  const cargarEntregas = async (idCiudadano) => {
    const idObjetivo = idCiudadano ?? ciudadanoId
    if (!idObjetivo) {
      return entregasRef.current
    }

    const idSolicitud = ++solicitudEntregasIdRef.current

    const { data, error } = await supabase
      .from('entrega')
      .select(`
      id,
      cantidad,
      puntos_obtenidos,
      estado,
      motivo_rechazo,
      fecha,
      materialid,
      material(
        nombre
      )
    `)
      .eq('ciudadanoid', idObjetivo)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })

    if (idSolicitud !== solicitudEntregasIdRef.current) {
      return entregasRef.current
    }

    if (error) {
      console.error('Error al cargar entregas del ciudadano:', error)
      return entregasRef.current
    }

    const listaNormalizada = (Array.isArray(data) ? data : []).map((fila) => {
      const resuelta = entregasResueltasRef.current.get(Number(fila.id))
      if (resuelta && fila.estado === 'Pendiente') {
        return {
          ...fila,
          estado: resuelta.estado,
          motivo_rechazo:
            resuelta.estado === 'Rechazada'
              ? (resuelta.motivo_rechazo ?? fila.motivo_rechazo ?? null)
              : null,
          puntos_obtenidos:
            resuelta.puntos_obtenidos ?? fila.puntos_obtenidos
        }
      }
      if (
        fila.estado === 'Aprobada' ||
        fila.estado === 'Aprobado' ||
        fila.estado === 'Rechazada'
      ) {
        entregasResueltasRef.current.set(Number(fila.id), {
          estado: fila.estado,
          motivo_rechazo: fila.motivo_rechazo ?? null,
          puntos_obtenidos: fila.puntos_obtenidos
        })
      }
      return fila
    })

    entregasRef.current = listaNormalizada
    setEntregas(listaNormalizada)
    console.log('Historial de entregas:', listaNormalizada)
    return listaNormalizada
  }

  const cargarRecompensas = async () => {

    const { data, error } = await supabase
      .from('recompensas')
      .select(`
      id,
      nombre,
      descripcion,
      puntos_requeridos,
      cantidad_disponible,
      estado,
      comercioid,
      categoria,
      imagen_url
    `)
      .eq('estado', 'Activa')

    if (error) {
      console.error('Error al cargar recompensas:', error)
      return
    }

    setRecompensas(data)
    console.log('Recompensas disponibles:', data)
  }

  const cargarSaldoEcopuntos = async () => {

    const { data, error } = await supabase
      .from('usuario')
      .select('ecopuntos')
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Error al cargar Ecopuntos', error)
      return
    }

    setSaldoEcopuntos(data.ecopuntos)
  }

  const cargarRecicladoresCompatibles = async (listaMateriales) => {
    const consultaId = ++consultaRecicladoresIdRef.current
    const idsSeleccionados = Array.from(
      new Set(
        (Array.isArray(listaMateriales) ? listaMateriales : [])
          .map((item) => Number(item?.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    )

    if (idsSeleccionados.length === 0) {
      setCargandoRecicladores(false)
      setRecicladores([])
      setRecicladorSeleccionado(null)
      return []
    }

    setCargandoRecicladores(true)

    const { data, error } = await supabase
      .from('material_reciclador')
      .select(`
      materialid,
      recicladorid,
      reciclador(
      id,
      nombre_centro,
      direccion,
      ciudad,
      latitud,
      longitud
      )
    `)
      .in('materialid', idsSeleccionados)

    if (consultaId !== consultaRecicladoresIdRef.current) {
      return []
    }

    setCargandoRecicladores(false)

    if (error) {
      console.error('Error al cargar recicladores:', error)
      setRecicladores([])
      setRecicladorSeleccionado(null)
      return []
    }

    const materialesPorCentro = new Map()
    const centroPorId = new Map()

    for (const fila of data || []) {
      const centro = fila?.reciclador
      const centroId = Number(centro?.id ?? fila?.recicladorid)
      const materialId = Number(fila?.materialid)

      if (
        !centro ||
        !Number.isInteger(centroId) ||
        centroId <= 0 ||
        !Number.isInteger(materialId)
      ) {
        continue
      }

      if (!materialesPorCentro.has(centroId)) {
        materialesPorCentro.set(centroId, new Set())
      }
      materialesPorCentro.get(centroId).add(materialId)

      if (!centroPorId.has(centroId)) {
        centroPorId.set(centroId, {
          recicladorid: centroId,
          reciclador: centro
        })
      }
    }

    const centrosCompatibles = []
    for (const [centroId, conjuntoMateriales] of materialesPorCentro.entries()) {
      const aceptaTodos = idsSeleccionados.every((idRequerido) =>
        conjuntoMateriales.has(idRequerido)
      )
      if (aceptaTodos && centroPorId.has(centroId)) {
        centrosCompatibles.push(centroPorId.get(centroId))
      }
    }

    setRecicladores(centrosCompatibles)
    setRecicladorSeleccionado((actual) => {
      if (!actual) return null
      const sigueCompatible = centrosCompatibles.some(
        (item) => Number(item?.reciclador?.id) === Number(actual.id)
      )
      return sigueCompatible ? actual : null
    })

    console.log('Recicladores compatibles encontrados:', centrosCompatibles)
    return centrosCompatibles
  }

  const alternarMaterial = (material) => {
    if (!material || registrandoEntregaRef.current) return
    setMensaje('')
    solicitudEntregaIdRef.current = null

    const yaSeleccionado = materialesSeleccionados.some(
      (item) => Number(item.id) === Number(material.id)
    )
    const nuevosMateriales = yaSeleccionado
      ? materialesSeleccionados.filter(
          (item) => Number(item.id) !== Number(material.id)
        )
      : [...materialesSeleccionados, material]

    setMaterialesSeleccionados(nuevosMateriales)

    if (yaSeleccionado) {
      setCantidadesPorMaterial((prev) => {
        const copia = { ...prev }
        delete copia[material.id]
        return copia
      })
    }

    cargarRecicladoresCompatibles(nuevosMateriales)
  }

  const actualizarCantidadMaterial = (materialId, valor) => {
    setMensaje('')
    solicitudEntregaIdRef.current = null
    setCantidadesPorMaterial((prev) => ({
      ...prev,
      [materialId]: valor
    }))
  }

  const generarSolicitudEntregaId = () => {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const registrarEntrega = async () => {
    if (registrandoEntregaRef.current || registrandoEntrega) {
      return
    }

    setMensaje('')

    if (materialesSeleccionados.length === 0) {
      setMensaje('Debes seleccionar al menos un material para reciclar')
      return
    }

    if (!recicladorSeleccionado) {
      if (!cargandoRecicladores && recicladores.length === 0) {
        setMensaje(
          'No encontramos un centro que reciba todos los materiales seleccionados'
        )
      } else {
        setMensaje('Debes seleccionar un centro de recolección compatible')
      }
      return
    }

    const centroCompatible = recicladores.some(
      (item) =>
        Number(item?.reciclador?.id) === Number(recicladorSeleccionado.id)
    )
    if (!centroCompatible) {
      setRecicladorSeleccionado(null)
      setMensaje(
        'El centro seleccionado no recibe todos los materiales elegidos'
      )
      return
    }

    const detalleEntregas = []
    for (const material of materialesSeleccionados) {
      const valorCrudo = cantidadesPorMaterial[material.id]
      const cantidadNumerica = Number(valorCrudo)
      if (
        valorCrudo === undefined ||
        String(valorCrudo).trim() === '' ||
        !Number.isFinite(cantidadNumerica) ||
        cantidadNumerica <= 0
      ) {
        setMensaje(
          `Ingresa una cantidad en kilogramos mayor que cero para ${material.nombre}`
        )
        return
      }

      detalleEntregas.push({
        material_id: Number(material.id),
        cantidad: cantidadNumerica
      })
    }

    if (!solicitudEntregaIdRef.current) {
      solicitudEntregaIdRef.current = generarSolicitudEntregaId()
    }

    registrandoEntregaRef.current = true
    setRegistrandoEntrega(true)

    try {
      const { data, error } = await supabase.rpc(
        'registrar_entrega_ciudadano',
        {
          p_reciclador_id: Number(recicladorSeleccionado.id),
          p_entregas: detalleEntregas,
          p_solicitud_id: solicitudEntregaIdRef.current
        }
      )

      if (error) {
        console.error('Error al registrar entrega:', error)
        solicitudEntregaIdRef.current = null
        const detalleError = String(error.message || '')
        if (detalleError.includes('no recibe')) {
          await cargarRecicladoresCompatibles(materialesSeleccionados)
          setMensaje(detalleError)
        } else {
          setMensaje(detalleError || 'No fue posible registrar la entrega')
        }
        return
      }

      console.log('Entregas registradas con IDs:', data)
      setMensaje('Entrega registrada correctamente')

      solicitudEntregaIdRef.current = null
      setMaterialesSeleccionados([])
      setCantidadesPorMaterial({})
      setRecicladores([])
      setRecicladorSeleccionado(null)

      cargarEntregas(ciudadanoId)
    } finally {
      registrandoEntregaRef.current = false
      setRegistrandoEntrega(false)
    }
  }

  const realizarCanje = async (recompensa) => {

    if (
      recompensaCanjeando !== null ||
      canjeCancelando !== null ||
      canjeRegenerando !== null
    ) {
      return
    }

    setMensaje('')

    if (recompensa.cantidad_disponible <= 0) {
      setMensaje('Esta recompensa no tiene unidades disponibles')
      return
    }

    if (saldoEcopuntos < recompensa.puntos_requeridos) {
      setMensaje('No tiene Ecopuntos suficientes')
      return
    }

    try {
      setRecompensaCanjeando(recompensa.id)

      const { data, error } = await supabase.rpc(
        'realizar_canje_ciudadano',
        {
          p_recompensa_id: recompensa.id
        }
      )


      if (error) {
        console.error('Error al realizar canje:', error)

        if (error.message.includes('stock')) {
          setMensaje('La recompensa ya no tiene unidades disponibles')
        } else if (
          error.message.includes('Ecopuntos insuficiente') ||
          error.message.includes('EcoPuntos insuficientes')
        ) {
          setMensaje('No tienes Ecopuntos suficientes')
        } else if (error.message.includes('session_id')) {
          setMensaje('Tu sesión autenticada no es válida. Inicia sesión nuevamente.')
        } else {
          setMensaje('No fue posible realizar canje')
        }
        return
      }

      if (!data || data.length === 0) {
        setMensaje('No fue posible realizar el canje')
        return
      }

      if (data[0]?.ahora_servidor) {
        sincronizarRelojServidor(data[0].ahora_servidor)
      }

      const nuevoCanje = normalizarCanjePendiente({
        ...data[0],
        recompensaid: recompensa.id,
        nombre_recompensa: recompensa.nombre
      })

      setAnuncioVencimiento('')
      setCanjeConfirmadoReciente(null)
      setUltimoCanje(nuevoCanje)
      setCanjesPendientes((prev) => {
        const actualizados = [
          nuevoCanje,
          ...prev.filter((item) => item.id !== nuevoCanje.id)
        ]
        canjesPendientesRef.current = actualizados
        return actualizados
      })

      setMensaje('Canje realizado correctamente')

      await Promise.all([
        cargarCanjesPendientes(),
        cargarSaldoEcopuntos(),
        cargarRecompensas()
      ])

    } finally {
      setRecompensaCanjeando(null)
    }
  }

  const regenerarCodigoCanje = async (canje) => {
    const idCanje = canje?.id ?? canje?.canje_id
    if (
      !idCanje ||
      canjeRegenerando !== null ||
      canjeCancelando !== null ||
      recompensaCanjeando !== null
    ) {
      return
    }

    setMensaje('')

    try {
      setCanjeRegenerando(idCanje)

      const { data, error } = await supabase.rpc(
        'reemplazar_codigo_canje_ciudadano',
        {
          p_canje_id: idCanje
        }
      )

      if (error) {
        console.error('Error al reemplazar código de canje:', error)
        if (
          error.message?.includes('confirmado') ||
          error.message?.includes('Canjeado')
        ) {
          setMensaje('Este canje ya fue confirmado en el comercio')
        } else if (error.message?.includes('stock')) {
          setMensaje('La recompensa ya no tiene unidades disponibles')
        } else if (
          error.message?.includes('EcoPuntos insuficientes') ||
          error.message?.includes('Ecopuntos insuficientes')
        ) {
          setMensaje('No tienes EcoPuntos suficientes para generar un nuevo código')
        } else if (error.message?.includes('session_id')) {
          setMensaje('Tu sesión autenticada no es válida. Inicia sesión nuevamente.')
        } else {
          setMensaje('No fue posible generar un nuevo código de canje')
        }

        await Promise.all([
          cargarCanjesPendientes(),
          cargarSaldoEcopuntos(),
          cargarRecompensas()
        ])
        return
      }

      const fila = Array.isArray(data) ? data[0] : data
      if (!fila) {
        setMensaje('No fue posible generar un nuevo código de canje')
        return
      }

      if (fila.ahora_servidor) {
        sincronizarRelojServidor(fila.ahora_servidor)
      }

      const canjeActualizado = normalizarCanjePendiente({
        ...canje,
        ...fila,
        nombre_recompensa: fila.nombre_recompensa || canje.nombre_recompensa
      })

      setAnuncioVencimiento('')
      setUltimoCanje(canjeActualizado)
      setCanjesPendientes((prev) => {
        const actualizados = prev.map((item) =>
          item.id === idCanje ? canjeActualizado : item
        )
        canjesPendientesRef.current = actualizados
        return actualizados
      })
      setMensaje('Nuevo código de canje generado por 3 minutos')

      await Promise.all([
        cargarCanjesPendientes(),
        cargarSaldoEcopuntos(),
        cargarRecompensas()
      ])
    } finally {
      setCanjeRegenerando(null)
    }
  }

  const cancelarCanje = async (canje) => {
    const idCanje = canje?.id ?? canje?.canje_id
    if (
      !idCanje ||
      canjeCancelando !== null ||
      canjeRegenerando !== null ||
      recompensaCanjeando !== null
    ) {
      return
    }

    setMensaje('')

    try {
      setCanjeCancelando(idCanje)

      const { data, error } = await supabase.rpc(
        'cancelar_canje_ciudadano',
        {
          p_canje_id: idCanje
        }
      )

      if (error) {
        console.error('Error al cancelar canje:', error)

        if (
          error.message?.includes('confirmado') ||
          error.message?.includes('Canjeado')
        ) {
          setMensaje('Este canje ya fue confirmado y no puede cancelarse')
        } else {
          setMensaje('No fue posible cancelar el canje')
        }

        await Promise.all([
          cargarCanjesPendientes(),
          cargarSaldoEcopuntos(),
          cargarRecompensas()
        ])
        return
      }

      const resultado = Array.isArray(data) ? data[0] : data

      canjesResueltosIdsRef.current.add(Number(idCanje))
      solicitudPendientesIdRef.current += 1

      setCanjesPendientes((prev) => {
        const actualizados = prev.filter((item) => item.id !== idCanje)
        canjesPendientesRef.current = actualizados
        return actualizados
      })

      if (
        ultimoCanje &&
        (ultimoCanje.id === idCanje || ultimoCanje.canje_id === idCanje)
      ) {
        setUltimoCanje(null)
      }

      if (typeof resultado?.saldo_ecopuntos === 'number') {
        setSaldoEcopuntos(resultado.saldo_ecopuntos)
      }

      setMensaje('Canje cancelado correctamente')

      await Promise.all([
        cargarCanjesPendientes(),
        cargarSaldoEcopuntos(),
        cargarRecompensas()
      ])
    } finally {
      setCanjeCancelando(null)
    }
  }

  const cargarDatosPerfil = async () => {
    const { data, error } = await supabase
      .from('usuario')
      .select(`
      nombre,
      correo,
      telefono,
      fecha_nacimiento,
      foto_perfil_url
    `)
      .eq('id', perfil.id)
      .single()

    if (error) {
      console.error('Errore al cargar perfil:', error)
      setMensajePerfil('No se pudo cargar tu perfil')
      return
    }

    setNombreMostrado(data.nombre || '')
    setDatosPerfil({
      nombre: data.nombre || '',
      correo: data.correo || '',
      telefono: data.telefono || '',
      foto_perfil_url: data.foto_perfil_url || null
    })

    if (data.foto_perfil_url) {
      const { data: imagen, error: errorImagen } =
        await supabase.storage
          .from('foto-perfil')
          .createSignedUrl(data.foto_perfil_url, 3600)

      if (!errorImagen && imagen?.signedUrl) {
        setFotoActual(imagen.signedUrl)
      } else {
        setFotoActual(null)
      }
    } else {
      setFotoActual(null)
    }
  }

  const seleccionarFotoPerfil = (event) => {
    const archivo = event.target.files?.[0]

    if (!archivo) return

    const fomratoPermitidos = [
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]

    if (!fomratoPermitidos.includes(archivo.type)) {
      setMensajePerfil('Selecciona una imagen JPG o PNG')

      event.target.value = ''
      return
    }

    if (archivo.size > 2 * 1024 * 1024) {
      setMensajePerfil('La fotografia no puede superar los 2MB')

      event.target.value = ''
      return
    }

    if (fotoVistaPrevia) {
      URL.revokeObjectURL(fotoVistaPrevia)
    }

    setFotoSeleccionada(archivo)
    setFotoVistaPrevia(URL.createObjectURL(archivo))
    setMensajePerfil('')
  }

  const guardarCambiosPerfil = async () => {
    if (guardandoPerfil) return

    setMensajePerfil('')

    const nombre = datosPerfil.nombre.trim()
    const telefono = datosPerfil.telefono.trim()

    if (!nombre) {
      setMensajePerfil('Debes ingresar tu nombre')
      return
    }

    if (nombre.length > 30) {
      setMensajePerfil('El nombre es demasiado largo')
      return
    }

    if (telefono && !validarTelefonoColombiano(telefono)) {
      setMensajePerfil('Ingresa un celular valido')
      return
    }

    if (
      datosPerfil.fecha_nacimiento &&
      datosPerfil.fecha_nacimiento >
      new Date().toLocaleDateString('en-CA')
    ) {
      setMensajePerfil('Dato incorrecto')
      return
    }
    setGuardandoPerfil(true)

    let rutaFoto = datosPerfil.foto_perfil_url
    let rutaNuevaFoto = null

    try {
      const { data: autenticacion, error: errorAuth } =
        await supabase.auth.getUser()

      if (
        errorAuth ||
        !autenticacion.user ||
        autenticacion.user.id !== perfil.id
      ) {
        throw new Error(' No se pudo verificar tu sesion. Inicia sesion nuevamente.')
      }

      if (fotoSeleccionada) {
        const extensionPorTipo = {
          'image/jpeg': 'jpg',
          'image/jpeg': 'jpeg',
          'image/png': 'png'
        }

        const extension = extensionPorTipo[fotoSeleccionada.type]

        const nombreArchivo = `${crypto.randomUUID()}.${extension}`

        rutaNuevaFoto = `${perfil.id}/${nombreArchivo}`

        const { error: errorSubida } =
          await supabase.storage
            .from('foto-perfil')
            .upload(rutaNuevaFoto, fotoSeleccionada, {
              contentType: fotoSeleccionada.type,
              upsert: false
            })

        if (errorSubida) {
          throw errorSubida
        }

        rutaFoto = rutaNuevaFoto
      }

      const { error: errorActualizacion } =
        await supabase.rpc('actualizar_mi_perfil', {
          p_nombre: nombre,
          p_telefono: telefono || null,
          p_fecha_nacimiento:
            datosPerfil.fecha_nacimiento || null,
          p_foto_perfil_url: rutaFoto
        })

      if (errorActualizacion) {
        throw errorActualizacion
      }

      setNombreMostrado(nombre)
      await cargarDatosPerfil()

      setFotoSeleccionada(null)

      if (fotoVistaPrevia) {
        URL.revokeObjectURL(fotoVistaPrevia)
      }

      setFotoVistaPrevia(null)
      setEditandoPerfil(false)

      setMensajePerfil('Perfil actualizado correctamente')
    } catch (error) {
      console.error('Error al actualizar perfil:', error)

      if (rutaNuevaFoto) {
        const { error: errorLimpieza } =
          await supabase.storage
            .from('foto-perfil')
            .remove([rutaNuevaFoto])

        if (errorLimpieza) {
          console.error('No se pudo cargar la fotografia', errorLimpieza)
        }
      }

      setMensajePerfil(error.message || ' No se puedo actualizar el perfil')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const cancelarEdicionPerfil = () => {
    if (fotoVistaPrevia) {
      URL.revokeObjectURL(fotoVistaPrevia)
    }

    setFotoVistaPrevia(null)
    setFotoSeleccionada(null)
    setEditandoPerfil(false)
    setMensajePerfil('')

    cargarDatosPerfil()
  }

  const calcularSegundosRestantes = (canje) => {
    if (!canje?.expira_en) return null
    const expiraMs = new Date(canje.expira_en).getTime()
    if (Number.isNaN(expiraMs)) return null
    const diferencia = Math.ceil((expiraMs - ahoraMs) / 1000)
    return Math.max(0, Math.min(DURACION_CODIGO_SEGUNDOS, diferencia))
  }

  const limpiarSuscripcionRealtime = async () => {
    const canalActual = canalRealtimeRef.current
    if (canalActual) {
      canalRealtimeRef.current = null
      await supabase.removeChannel(canalActual)
    }

    const canalEntregasActual = canalEntregasRealtimeRef.current
    if (canalEntregasActual) {
      canalEntregasRealtimeRef.current = null
      await supabase.removeChannel(canalEntregasActual)
    }
  }

  const procesarActualizacionEntrega = (registroEntrega) => {
    const idActualizado = Number(
      registroEntrega?.id ?? registroEntrega?.entrega_id
    )
    if (!idActualizado) return

    const nuevoEstado = registroEntrega.estado
    if (
      nuevoEstado !== 'Aprobada' &&
      nuevoEstado !== 'Aprobado' &&
      nuevoEstado !== 'Rechazada'
    ) {
      return
    }

    const motivoNormalizado =
      nuevoEstado === 'Rechazada'
        ? (registroEntrega.motivo_rechazo ?? null)
        : null

    entregasResueltasRef.current.set(idActualizado, {
      estado: nuevoEstado,
      motivo_rechazo: motivoNormalizado,
      puntos_obtenidos: registroEntrega.puntos_obtenidos
    })

    // Invalida cualquier consulta de entregas iniciada antes de esta notificación Realtime
    solicitudEntregasIdRef.current += 1

    let encontradaEnLista = false
    setEntregas((prev) => {
      const actualizadas = prev.map((item) => {
        if (Number(item.id) !== idActualizado) return item
        encontradaEnLista = true
        return {
          ...item,
          estado: nuevoEstado,
          motivo_rechazo:
            nuevoEstado === 'Rechazada'
              ? (registroEntrega.motivo_rechazo ?? item.motivo_rechazo ?? null)
              : null,
          puntos_obtenidos:
            registroEntrega.puntos_obtenidos ?? item.puntos_obtenidos,
          cantidad: registroEntrega.cantidad ?? item.cantidad
        }
      })
      entregasRef.current = actualizadas
      return actualizadas
    })

    if (!encontradaEnLista && ciudadanoId) {
      void cargarEntregas(ciudadanoId)
    }

    if (nuevoEstado === 'Aprobada' || nuevoEstado === 'Aprobado') {
      void cargarSaldoEcopuntos()
    }
  }

  const sincronizarEstadoEntregas = async () => {
    if (!ciudadanoId) return
    await Promise.all([
      cargarEntregas(ciudadanoId),
      cargarSaldoEcopuntos()
    ])
  }

  const procesarActualizacionCanje = (registroCanje) => {
    const idActualizado = Number(
      registroCanje?.id ?? registroCanje?.canje_id
    )
    if (!idActualizado) return

    if (registroCanje.estado === 'Canjeado') {
      if (canjesResueltosIdsRef.current.has(idActualizado)) return
      canjesResueltosIdsRef.current.add(idActualizado)
      solicitudPendientesIdRef.current += 1

      const canjePrevio = canjesPendientesRef.current.find(
        (item) => Number(item.id) === idActualizado
      )

      setCanjesPendientes((prev) => {
        const actualizados = prev.filter(
          (item) => Number(item.id) !== idActualizado
        )
        canjesPendientesRef.current = actualizados
        return actualizados
      })

      setUltimoCanje((prev) =>
        prev &&
        (Number(prev.id) === idActualizado ||
          Number(prev.canje_id) === idActualizado)
          ? null
          : prev
      )

      setCanjeConfirmadoReciente({
        id: idActualizado,
        nombre_recompensa:
          canjePrevio?.nombre_recompensa ||
          registroCanje.nombre_recompensa ||
          'Beneficio EcoCycle',
        puntos_utilizados:
          registroCanje.puntos_utilizados ??
          canjePrevio?.puntos_utilizados ??
          0,
        estado: 'Canjeado'
      })

      setAnuncioVencimiento('Canje confirmado')
      setMensaje('Canje confirmado')

      void cargarSaldoEcopuntos()
      void cargarRecompensas()
    } else if (registroCanje.estado === 'Cancelado') {
      canjesResueltosIdsRef.current.add(idActualizado)
      solicitudPendientesIdRef.current += 1

      setCanjesPendientes((prev) => {
        const actualizados = prev.filter(
          (item) => Number(item.id) !== idActualizado
        )
        canjesPendientesRef.current = actualizados
        return actualizados
      })

      setUltimoCanje((prev) =>
        prev &&
        (Number(prev.id) === idActualizado ||
          Number(prev.canje_id) === idActualizado)
          ? null
          : prev
      )

      void cargarSaldoEcopuntos()
    }
  }

  const sincronizarEstadoCanjes = async () => {
    const pendientesPrevios = [...canjesPendientesRef.current]
    const [nuevosPendientes] = await Promise.all([
      cargarCanjesPendientes(),
      cargarSaldoEcopuntos(),
      cargarRecompensas()
    ])

    if (pendientesPrevios.length > 0 && Array.isArray(nuevosPendientes)) {
      const idsNuevos = new Set(nuevosPendientes.map((item) => Number(item.id)))
      for (const previo of pendientesPrevios) {
        const idPrevio = Number(previo.id)
        if (
          !idsNuevos.has(idPrevio) &&
          !canjesResueltosIdsRef.current.has(idPrevio)
        ) {
          procesarActualizacionCanje({
            ...previo,
            id: idPrevio,
            estado: 'Canjeado'
          })
        }
      }
    }
  }

  const manejarCerrarSesion = async () => {
    if (cerrandoSesion) return

    setCerrandoSesion(true)
    setMensaje('')
    setMensajePerfil('')

    try {
      const { error: errorInvalidacion } = await supabase.rpc(
        'invalidar_canjes_sesion_ciudadano'
      )

      if (errorInvalidacion) {
        const textoError =
          'No fue posible invalidar tus códigos de canje pendientes antes de cerrar sesión. Intenta nuevamente.'
        setMensaje(textoError)
        setMensajePerfil(textoError)
        return
      }

      await limpiarSuscripcionRealtime()

      const resultadoSalida = await cerrarSesion({ codigosInvalidados: true })
      if (resultadoSalida && resultadoSalida.ok === false) {
        const textoError =
          'No fue posible completar el cierre de sesión. Intenta nuevamente.'
        setMensaje(textoError)
        setMensajePerfil(textoError)
        return
      }

      canjesPendientesRef.current = []
      setCanjesPendientes([])
      setUltimoCanje(null)
      setCanjeConfirmadoReciente(null)
      entregasRef.current = []
      entregasResueltasRef.current.clear()
      setEntregas([])
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      const textoError =
        'No fue posible cerrar sesión en este momento. Intenta nuevamente.'
      setMensaje(textoError)
      setMensajePerfil(textoError)
    } finally {
      setCerrandoSesion(false)
    }
  }

  useEffect(() => {
    cargarMateriales()
    cargarCiudadano()
    cargarRecompensas()
  }, [])

  useEffect(() => {
    if (!ciudadanoId || !perfil?.id) return

    let activo = true
    let suscritoPreviamente = false

    const canal = supabase
      .channel(`canje-ciudadano-${ciudadanoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'canje',
          filter: `ciudadanoid=eq.${ciudadanoId}`
        },
        (payload) => {
          if (!activo) return
          if (payload?.new) {
            procesarActualizacionCanje(payload.new)
          }
        }
      )
      .subscribe((estadoSuscripcion) => {
        if (!activo) return
        if (estadoSuscripcion === 'SUBSCRIBED') {
          if (suscritoPreviamente) {
            void sincronizarEstadoCanjes()
          }
          suscritoPreviamente = true
        }
      })

    canalRealtimeRef.current = canal

    let suscritoEntregasPreviamente = false

    const canalEntregas = supabase
      .channel(`entrega-ciudadano-${ciudadanoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entrega',
          filter: `ciudadanoid=eq.${ciudadanoId}`
        },
        (payload) => {
          if (!activo) return
          if (payload?.new) {
            procesarActualizacionEntrega(payload.new)
          }
        }
      )
      .subscribe((estadoSuscripcion) => {
        if (!activo) return
        if (estadoSuscripcion === 'SUBSCRIBED') {
          if (suscritoEntregasPreviamente) {
            void sincronizarEstadoEntregas()
          }
          suscritoEntregasPreviamente = true
        }
      })

    canalEntregasRealtimeRef.current = canalEntregas

    const alRecuperarConexion = () => {
      if (!activo) return
      void sincronizarEstadoCanjes()
      void sincronizarEstadoEntregas()
    }

    const alVolverAPestana = () => {
      if (!activo || document.hidden) return
      void sincronizarEstadoCanjes()
      void sincronizarEstadoEntregas()
    }

    window.addEventListener('online', alRecuperarConexion)
    window.addEventListener('focus', alVolverAPestana)
    document.addEventListener('visibilitychange', alVolverAPestana)

    return () => {
      activo = false
      window.removeEventListener('online', alRecuperarConexion)
      window.removeEventListener('focus', alVolverAPestana)
      document.removeEventListener('visibilitychange', alVolverAPestana)
      if (canalRealtimeRef.current === canal) {
        canalRealtimeRef.current = null
      }
      if (canalEntregasRealtimeRef.current === canalEntregas) {
        canalEntregasRealtimeRef.current = null
      }
      void supabase.removeChannel(canal)
      void supabase.removeChannel(canalEntregas)
    }
  }, [ciudadanoId, perfil?.id])

  useEffect(() => {
    if (canjesPendientes.length === 0) return

    const actualizarReloj = () => {
      setAhoraMs(Date.now() + desfaseServidorMs)
    }

    actualizarReloj()
    const intervalo = window.setInterval(actualizarReloj, 250)

    const alVolverDeSegundoPlano = () => {
      if (!document.hidden) {
        actualizarReloj()
      }
    }

    document.addEventListener('visibilitychange', alVolverDeSegundoPlano)
    window.addEventListener('focus', actualizarReloj)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolverDeSegundoPlano)
      window.removeEventListener('focus', actualizarReloj)
    }
  }, [canjesPendientes.length, desfaseServidorMs])

  useEffect(() => {
    for (const canje of canjesPendientes) {
      const expiraMs = canje?.expira_en
        ? new Date(canje.expira_en).getTime()
        : Number.NaN
      const vencido =
        !canje?.expira_en ||
        !canje?.codigo_canje ||
        (!Number.isNaN(expiraMs) && expiraMs <= ahoraMs)
      if (vencido) {
        const clave = `${canje.id}-${canje.expira_en || 'sin-vigencia'}`
        if (!vencidosAnunciadosRef.current.has(clave)) {
          vencidosAnunciadosRef.current.add(clave)
          setAnuncioVencimiento(
            `Tu código venció para ${canje.nombre_recompensa}. Puedes generar un nuevo código.`
          )
        }
      }
    }
  }, [ahoraMs, canjesPendientes])

  useEffect(() => {
    cargarSaldoEcopuntos()
  }, [perfil.id])

  useEffect(() => {
    cargarDatosPerfil()
  }, [perfil.id])

  const abrirVideoEducativo = async (url) => {
    try {
      const { Capacitor } = await import('@capacitor/core')

      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url })
      } else {
        window.open(url, '_blank', 'noopener, noreferrer')
      }
    } catch (error) {
      console.error('No fue posible abrir el video:', error)
      window.location.href = url
    }
  }

  return (
    <div className="ciudadano-pagina">

      <header className="ciudadano-header">
        <div className="ciudadano-header-contenido">
          <img
            src={logoEcocycle}
            alt="EcoCycle"
            className="ciudadano-logo"
          />

          <div className="ciudadano-header-acciones">
            <span>{nombreMostrado}</span>
          </div>
        </div>
      </header>

      <main className="ciudadano-contenido">

        <nav
          className="eco-ciudadano-navegacion"
          aria-label="Navegacion del ciudadano"
        >
          {[
            { id: 'inicio', nombre: 'Inicio' },
            { id: 'reciclar', nombre: 'Reciclar' },
            { id: 'historial', nombre: 'Historial' },
            { id: 'beneficios', nombre: 'Beneficios' },
            { id: 'perfil', nombre: 'perfil' },
          ].map((pestana) => (
            <button
              key={pestana.id}
              type="button"
              className={`eco-ciudadano-tab ${pestanaActiva === pestana.id ? 'activa' : ''
                }`}
              onClick={() => {
                setPestanaActiva(pestana.id)
                if (pestana.id === 'beneficios') {
                  cargarRecompensas()
                  cargarCanjesPendientes()
                  cargarSaldoEcopuntos()
                }
              }}
              aria-current={
                pestanaActiva === pestana.id ? 'page' : undefined
              }
            >
              {pestana.nombre}
            </button>
          ))}
        </nav>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'inicio'}
        >
          <section className="ciudadano-bienvenida">
            <div className="ciudadano-bienvenida-texto">
              <span className="ciudadano-etiqueta">
                Panel del ciudadano
              </span>

              <h1>Hola, {nombreMostrado}</h1>

              <p>
                Recicla, acumula EcoPuntos y obten beneficios
                mientras ayudas al planeta
              </p>
            </div>

            <div className="ciudadano-saldo">
              <div className="ciudadano-saldo-icono" />

              <div>
                <span>Mis EcoPuntos</span>
                <strong>{saldoEcopuntos}</strong>
                <small>Disponibles para canjear</small>
              </div>
            </div>
          </section>

          <section className='eco-educacion-preview'>
            <header className='eco-educacion-encabezado'>
              <span>Aprende con EcoCycle</span>
              <h2>¿Sabes como reciclar?</h2>
              <p>
                Conoce nuestros superheroes y aprende a separa
                correctamente tus residuos reciclables
              </p>
            </header>

            <div className='eco-educacion-grid'>
              {videosEducativos.map((video) => (
                <article key={video.id} className='eco-educacion-card'>
                  <div className='eco-educacion-card-imagen'>
                    <img
                      src={video.imagen}
                      alt={`Personaje ${video.personaje}`}
                      loading='lazy'
                    />
                  </div>

                  <div className='eco-educacion-card-contenido'>
                    <span>{video.material}</span>
                    <h3>{video.personaje}</h3>
                    <p>{video.descripcion}</p>

                    <button
                      type='button'
                      className='eco-educacion-boton'
                      onClick={() => abrirVideoEducativo(video.url)}
                    >
                      Ver video
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        {mensaje && (
          <div className="ciudadano-mensaje">
            {mensaje}
          </div>
        )}

        <div
          className='eco-ciudadano-vista'
          hidden={pestanaActiva !== 'aprender'}
        >
          <section className='eco-educacion-pagina'>
            <button
              type='button'
              className='eco-educacion-volver'
              onClick={() => setPestanaActiva('inicio')}
            >
              Volver al inicio
            </button>
          </section>
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'reciclar'}
        >
          <section className="ciudadano-seccion-materiales">
            <div className="ciudadano-seccion-titulo">
              <div>
                <span>Recicla y gana</span>
                <p>¿Que quieres reciclar?</p>
              </div>
            </div>

            <div className="ciudadano-material-grid">
              {materiales.map((material) => {
                const imagenMaterial =
                  imagenesMateriales[normalizarMaterial(material.nombre)]
                const estaSeleccionado = materialesSeleccionados.some(
                  (item) => Number(item.id) === Number(material.id)
                )

                return (
                  <button
                    type="button"
                    key={material.id}
                    aria-pressed={estaSeleccionado}
                    className={
                      estaSeleccionado
                        ? 'ciudadano-material-card seleccionado'
                        : 'ciudadano-material-card'
                    }
                    onClick={() => alternarMaterial(material)}
                  >
                    <div className="ciudadano-material-icono">
                      {imagenMaterial ? (
                        <img
                          src={imagenMaterial}
                          alt={`Personaje de ${material.nombre}`}
                          className="ciudadano-personaje-imagen"
                          loading="lazy"
                        />
                      ) : (
                        <span aria-hidden="true">♻️</span>
                      )}
                    </div>

                    <div className="ciudadano-material-info">
                      <h3>{material.nombre}</h3>
                      <p>
                        <strong>{material.puntos_por_kilo}</strong>
                        {' '}EcoPuntos/kg
                      </p>
                    </div>

                    <div className="ciudadano-material-seleccionar">
                      {estaSeleccionado ? 'Seleccionado' : 'Seleccionar'}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {materialesSeleccionados.length > 0 && (
            <section className="ciudadano-centros">
              <div className="ciudadano-material-resumen">
                <div>
                  <span>
                    {materialesSeleccionados.length === 1
                      ? 'Material seleccionado'
                      : `Materiales seleccionados (${materialesSeleccionados.length})`}
                  </span>
                  <strong>
                    {materialesSeleccionados
                      .map((item) => item.nombre)
                      .join(', ')}
                  </strong>
                </div>

                <div>
                  <span>Valor</span>
                  <strong>
                    {materialesSeleccionados
                      .map(
                        (item) =>
                          `${item.nombre}: ${item.puntos_por_kilo} EcoPuntos/kg`
                      )
                      .join(' · ')}
                  </strong>
                </div>
              </div>

              <div className="ciudadano-cantidades-materiales">
                <div className="ciudadano-seccion-titulo">
                  <span>Cantidades</span>
                  <h2>Ingresa los kilos por material</h2>
                  <p>
                    Registra la cantidad en kilogramos de cada material que
                    llevaras en tu visita
                  </p>
                </div>

                <div className="ciudadano-cantidades-lista">
                  {materialesSeleccionados.map((material) => {
                    const cantidadMaterial =
                      cantidadesPorMaterial[material.id] ?? ''
                    const cantidadNum = Number(cantidadMaterial)
                    const puntosMaterial =
                      Number.isFinite(cantidadNum) && cantidadNum > 0
                        ? Math.floor(
                            cantidadNum * Number(material.puntos_por_kilo)
                          )
                        : 0

                    return (
                      <div
                        key={material.id}
                        className="ciudadano-cantidad-material-item"
                      >
                        <div className="ciudadano-cantidad-material-cabecera">
                          <label htmlFor={`cantidad-material-${material.id}`}>
                            Cantidad en kilogramos de {material.nombre}
                          </label>
                          <span>
                            {material.puntos_por_kilo} EcoPuntos/kg
                          </span>
                        </div>

                        <input
                          id={`cantidad-material-${material.id}`}
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="Ejemplo: 2.5"
                          value={cantidadMaterial}
                          onChange={(e) =>
                            actualizarCantidadMaterial(
                              material.id,
                              e.target.value
                            )
                          }
                        />

                        {cantidadNum > 0 && (
                          <p className="ciudadano-cantidad-material-puntos">
                            Estimado: <strong>{puntosMaterial} EcoPuntos</strong>{' '}
                            ({cantidadMaterial} kg x {material.puntos_por_kilo}{' '}
                            puntos/kg)
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="ciudadano-seccion-titulo">
                <span>Paso 2</span>
                <h2>Encuentra donde reciclar</h2>
                <p>
                  Consulta los puntos de reciclaje que reciben todos los
                  materiales seleccionados y elige el que prefieras
                </p>
              </div>

              {!cargandoRecicladores && recicladores.length === 0 ? (
                <div
                  className="ciudadano-sin-centros-compatibles"
                  role="status"
                  aria-live="polite"
                >
                  <p>
                    No encontramos un centro que reciba todos los materiales seleccionados
                  </p>
                  <span>
                    Ajusta tu seleccion de materiales para ver centros
                    compatibles; conservaremos los kilos que ya ingresaste.
                  </span>
                </div>
              ) : (
                <>
                  <div className="ciudadano-mapa-contenedor">
                    <MapaReciclaje
                      recicladores={recicladores}
                      onSeleccionarCentro={setRecicladorSeleccionado}
                    />
                  </div>

                  <div className="ciudadano-centros-grid">
                    {recicladorSeleccionado && (
                      <div className="ciudadano-centro-card seleccionado eco-centro-resumen">
                        <div className="eco-centro-resumen-contenido">
                          <div>
                            <span className="eco-centro-resumen-etiqueta">
                              CENTRO SELECCIONADO
                            </span>
                            <h3>{recicladorSeleccionado.nombre_centro}</h3>
                            <p>{recicladorSeleccionado.ciudad}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="eco-centro-cambiar"
                          onClick={() => setRecicladorSeleccionado(null)}
                        >
                          Cambiar centro
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {recicladorSeleccionado && materialesSeleccionados.length > 0 && (
            <div>
              {(() => {
                const resumenMateriales = materialesSeleccionados
                  .map((material) => {
                    const kilos = Number(cantidadesPorMaterial[material.id])
                    if (!Number.isFinite(kilos) || kilos <= 0) return null
                    const puntos = Math.floor(
                      kilos * Number(material.puntos_por_kilo)
                    )
                    return {
                      id: material.id,
                      nombre: material.nombre,
                      kilos,
                      puntosPorKilo: material.puntos_por_kilo,
                      puntos
                    }
                  })
                  .filter(Boolean)

                const totalPuntosEstimados = resumenMateriales.reduce(
                  (acumulado, item) => acumulado + item.puntos,
                  0
                )

                return (
                  resumenMateriales.length > 0 && (
                    <div className="ciudadano-puntos-estimados">
                      <p>ECOPUNTOS</p>

                      <strong>{totalPuntosEstimados} EcoPuntos</strong>

                      <span>
                        {resumenMateriales
                          .map(
                            (item) =>
                              `${item.nombre}: ${item.kilos} kg x ${item.puntosPorKilo} puntos/kg`
                          )
                          .join(' · ')}
                      </span>
                    </div>
                  )
                )
              })()}

              <div className="eco-entrega-aviso" role="note">
                <span aria-hidden="true"></span>
                <p>
                  Los EcoPuntos se sumaran a tu saldo cuando
                  el reciclador valide y apruebe la entrega
                </p>
              </div>

              <button
                type="button"
                className="ciudadano-entrega-boton"
                onClick={registrarEntrega}
                disabled={registrandoEntrega}
              >
                {registrandoEntrega
                  ? 'Registrando entrega...'
                  : 'Registrar entrega'}
              </button>
            </div>
          )}
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'historial'}
        >
          <section className="ciudadano-historial">
            <div className="ciudadano-historial-encabezado">
              <span>Mis reciclajes</span>
              <h2>Historial de entregas</h2>
              <p>Consulta el estado de tus materiales reciclados</p>
            </div>

            {entregas.length === 0 && (
              <div className="ciudadano-historial-vacio">
                <span aria-hidden="true">♻️</span>
                <p>Aun no tienes entregas registradas</p>
              </div>
            )}

            <div className="ciudadano-historial-lista">
              {entregas.map((entrega) => {
                const nombreMaterial =
                  entrega.material?.nombre || 'Material reciclable'

                const imagenMaterial =
                  imagenesMateriales[normalizarMaterial(nombreMaterial)]

                return (
                  <details
                    key={entrega.id}
                    className="ciudadano-historial-card"
                  >
                    <summary className="ciudadano-historial-resumen">
                      <div className="ciudadano-historial-icono">
                        {imagenMaterial ? (
                          <img
                            src={imagenMaterial}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span aria-hidden="true">♻️</span>
                        )}
                      </div>

                      <div className="ciudadano-historial-info">
                        <strong>{nombreMaterial}</strong>

                        <small>
                          {entrega.fecha
                            ? new Date(entrega.fecha)
                              .toLocaleDateString('es-CO')
                            : 'Fecha no disponible'}
                        </small>

                        <span
                          className={`ciudadano-historial-estado ${entrega.estado === 'Aprobado' ||
                            entrega.estado === 'Aprobada'
                            ? 'aprobada'
                            : entrega.estado === 'Rechazada'
                              ? 'rechazada'
                              : 'pendiente'
                            }`}
                        >
                          {entrega.estado}
                        </span>
                      </div>

                      <span
                        className="ciudadano-historial-flecha"
                        aria-hidden="true"
                      >
                        ⌄
                      </span>
                    </summary>

                    <div className="ciudadano-historial-detalles">
                      <div>
                        <span>Cantidad entregada</span>
                        <strong>{entrega.cantidad} kg</strong>
                      </div>

                      <div>
                        <span>
                          {entrega.estado === 'Aprobado' ||
                            entrega.estado === 'Aprobada'
                            ? 'EcoPuntos obtenidos'
                            : 'EcoPuntos registrados'}
                        </span>

                        <strong>
                          {entrega.puntos_obtenidos ?? 0}
                        </strong>
                      </div>

                      {entrega.estado === 'Rechazada' &&
                        entrega.motivo_rechazo && (
                          <div className="ciudadano-historial-rechazo">
                            <span>Motivo del rechazo</span>
                            <p>{entrega.motivo_rechazo}</p>
                          </div>
                        )}
                    </div>
                  </details>
                )
              })}
            </div>
          </section>
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'beneficios'}
        >
          <section className="ciudadano-beneficios">
            <div className="ciudadano-beneficios-encabezado">
              <div>
                <span>Canjea tus EcoPuntos</span>
                <h2>Beneficios para ti</h2>
                <p>Elige una recompensa y disfruta tus EcoPuntos</p>
              </div>
            </div>

            <div className="ciudadano-categorias">
              {['Todos', 'Mercado', 'Comida', 'Salud'].map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  className={
                    categoriaSeleccionada === categoria
                      ? 'ciudadano-categoria activa'
                      : 'ciudadano-categoria'
                  }
                  onClick={() => setCategoriaSeleccionada(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          </section>

          {recompensas.length === 0 && (
            <p>No hay recompensas disponibles</p>
          )}

          <div className="ciudadano-beneficios-grid">
            {recompensas
              .filter(
                (recompensa) =>
                  categoriaSeleccionada === 'Todos' ||
                  recompensa.categoria === categoriaSeleccionada
              )
              .map((recompensa) => {
                const sinStock =
                  recompensa.cantidad_disponible <= 0

                const puntosInsuficientes =
                  saldoEcopuntos < recompensa.puntos_requeridos

                const puntosFaltantes =
                  recompensa.puntos_requeridos - saldoEcopuntos

                console.log('Saldo:', saldoEcopuntos)
                console.log(
                  'Recompensa procesando:',
                  recompensaCanjeando
                )

                return (
                  <div
                    key={recompensa.id}
                    className="ciudadano-beneficio-card"
                  >
                    <div className="ciudadano-beneficio-imagen">
                      {recompensa.imagen_url ? (
                        <img
                          src={recompensa.imagen_url}
                          alt={recompensa.nombre}
                          loading="lazy"
                        />
                      ) : (
                        <span>♻️</span>
                      )}
                    </div>

                    <div className="ciudadano-beneficio-contenido">
                      {recompensa.categoria && (
                        <span className="ciudadano-beneficio-categoria">
                          {recompensa.categoria}
                        </span>
                      )}

                      <h3>{recompensa.nombre}</h3>
                      <p>{recompensa.descripcion}</p>

                      <div className="ciudadano-beneficio-datos">
                        <strong>
                          ♻️ {recompensa.puntos_requeridos} EcoPuntos
                        </strong>

                        <span>
                          {recompensa.cantidad_disponible} disponibles
                        </span>
                      </div>

                      {sinStock ? (
                        <button type="button" disabled>
                          Beneficio agotado
                        </button>
                      ) : puntosInsuficientes ? (
                        <button type="button" disabled>
                          Te faltan {puntosFaltantes} EcoPuntos
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => realizarCanje(recompensa)}
                          disabled={
                            recompensaCanjeando !== null ||
                            canjeCancelando !== null ||
                            canjeRegenerando !== null
                          }
                        >
                          {recompensaCanjeando === recompensa.id
                            ? 'Procesando...'
                            : 'Canjear'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>

          <div
            className="ciudadano-sr-anuncio"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
          >
            {anuncioVencimiento}
          </div>

          {canjeConfirmadoReciente && (
            <div
              className="ciudadano-canje-exitoso ciudadano-canje-confirmado"
              role="status"
            >
              <div className="ciudadano-canje-check" aria-hidden="true"></div>

              <h2>Canje confirmado</h2>
              <h3>{canjeConfirmadoReciente.nombre_recompensa}</h3>

              <p className="ciudadano-canje-instruccion">
                Tu beneficio fue confirmado en el comercio aliado.
              </p>

              <div className="ciudadano-canje-detalles">
                <div>
                  <span>EcoPuntos utilizados</span>
                  <strong>{canjeConfirmadoReciente.puntos_utilizados}</strong>
                </div>

                <div>
                  <span>Estado</span>
                  <strong>{canjeConfirmadoReciente.estado}</strong>
                </div>
              </div>
            </div>
          )}

          {canjesPendientes.map((canje) => {
            const segundosRestantes = canje.expira_en
              ? calcularSegundosRestantes(canje)
              : 0
            const codigoVencido =
              !canje.expira_en ||
              segundosRestantes === 0 ||
              !canje.codigo_canje
            const textoTiempo = formatearTiempoCanje(segundosRestantes ?? 0)
            const radioAnillo = 36
            const circunferenciaAnillo = 2 * Math.PI * radioAnillo
            const progresoAnillo = Math.max(
              0,
              Math.min(
                1,
                (segundosRestantes ?? 0) / DURACION_CODIGO_SEGUNDOS
              )
            )
            const desplazamientoAnillo =
              circunferenciaAnillo * (1 - progresoAnillo)

            return (
              <div key={canje.id} className="ciudadano-canje-exitoso">
                <div className="ciudadano-canje-check" aria-hidden="true"></div>

                <h2>
                  {codigoVencido
                    ? 'Tu código venció'
                    : ultimoCanje?.id === canje.id
                      ? 'Canje realizado correctamente'
                      : 'Canje pendiente'}
                </h2>
                <h3>{canje.nombre_recompensa}</h3>

                <p className="ciudadano-canje-instruccion">
                  {codigoVencido
                    ? 'El tiempo de vigencia de 3 minutos terminó. Genera un nuevo código para reclamar tu beneficio en el comercio.'
                    : 'Presenta este codigo en el comercio para recibir tu beneficio'}
                </p>

                <div className="ciudadano-canje-vigencia-fila con-anillo">
                  {!codigoVencido ? (
                    <div className="ciudadano-canje-codigo">
                      <span>Codigo de canje</span>
                      <strong>{canje.codigo_canje}</strong>
                    </div>
                  ) : (
                    <div className="ciudadano-canje-codigo ciudadano-canje-codigo-vencido">
                      <span>Estado del código</span>
                      <strong>Tu código venció</strong>
                    </div>
                  )}

                  <div
                    className={`ciudadano-canje-reloj ${
                      codigoVencido
                        ? 'vencido'
                        : (segundosRestantes ?? 0) <= 30
                          ? 'por-vencer'
                          : ''
                    }`}
                    role="timer"
                    aria-label={`Vigencia del código: ${textoTiempo}`}
                  >
                    <div className="ciudadano-canje-anillo-marco">
                      <svg
                        className="ciudadano-canje-anillo-svg"
                        viewBox="0 0 88 88"
                        aria-hidden="true"
                      >
                        <circle
                          className="ciudadano-canje-anillo-fondo"
                          cx="44"
                          cy="44"
                          r={radioAnillo}
                        />
                        <circle
                          className="ciudadano-canje-anillo-progreso"
                          cx="44"
                          cy="44"
                          r={radioAnillo}
                          strokeDasharray={circunferenciaAnillo}
                          strokeDashoffset={desplazamientoAnillo}
                        />
                      </svg>
                      <span
                        className="ciudadano-canje-reloj-texto"
                        aria-live="off"
                      >
                        {textoTiempo}
                      </span>
                    </div>
                    <span className="ciudadano-canje-reloj-etiqueta">
                      {codigoVencido ? 'Vencido' : 'Vigencia'}
                    </span>
                  </div>
                </div>

                <div className="ciudadano-canje-detalles">
                  <div>
                    <span>EcoPuntos utilizados</span>
                    <strong>{canje.puntos_utilizados}</strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>{codigoVencido ? 'Vencido' : canje.estado}</strong>
                  </div>
                </div>

                <p className="ciudadano-canje-aviso">
                  Este código es válido para un solo uso durante 3 minutos
                </p>

                {codigoVencido && (
                  <button
                    type="button"
                    className="ciudadano-canje-regenerar"
                    onClick={() => regenerarCodigoCanje(canje)}
                    disabled={
                      canjeRegenerando !== null ||
                      canjeCancelando !== null ||
                      recompensaCanjeando !== null
                    }
                  >
                    {canjeRegenerando === canje.id
                      ? 'Generando código...'
                      : 'Generar nuevo código'}
                  </button>
                )}

                <button
                  type="button"
                  className="ciudadano-canje-cancelar"
                  onClick={() => cancelarCanje(canje)}
                  disabled={
                    canjeCancelando !== null ||
                    canjeRegenerando !== null ||
                    recompensaCanjeando !== null
                  }
                >
                  {canjeCancelando === canje.id
                    ? 'Cancelando...'
                    : 'Cancelar canje'}
                </button>
              </div>
            )
          })}
        </div>

        <div
          className="eco-ciudadano-vista"
          hidden={pestanaActiva !== 'perfil'}
        >
          <section className='eco-perfil eco-perfil-editable'>
            <div className='eco-perfil-encabezado'>
              <div className='eco-perfil-foto-contenedor'>
                {fotoVistaPrevia || fotoActual ? (
                  <img
                    src={fotoVistaPrevia || fotoActual}
                    alt='Fotografia de perfil'
                    className='eco-perfil-fotografia'
                  />
                ) : (
                  <div className='eco-perfil-avatar'>
                    {datosPerfil.nombre
                      ?.trim()
                      ?.charAt(0)
                      ?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <h2>Mi perfil</h2>
              <p>Administrar tu informacion personal en EcoCycle</p>

              {editandoPerfil && (
                <div className='eco-perfil-cambiar-foto'>
                  <label
                    htmlFor="eco-foto-perfil"
                    className='eco-perfil-boton-foto'
                  >
                    Cambiar fotografia
                  </label>

                  <input
                    id='eco-foto-perfil'
                    type="file"
                    accept='image/jpeg,image/jpg,image/png'
                    onChange={seleccionarFotoPerfil}
                    style={{ display: 'none' }}
                  />

                  <small>
                    JPEG, JPG o PNG. Maximo 2MB
                  </small>
                </div>
              )}
            </div>

            <div className='eco-perfil-formulario'>
              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-nombre">
                  Nombre completo
                </label>

                <input
                  id='eco-perfil-nombre'
                  type="text"
                  maxLength={30}
                  value={datosPerfil.nombre}
                  disabled={!editandoPerfil || guardandoPerfil}
                  onChange={(e) =>
                    setDatosPerfil({
                      ...datosPerfil,
                      nombre: e.target.value
                    })
                  }
                />
              </div>

              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-correo">
                  Correo electronico
                </label>

                <input
                  id='eco-perfil-correo'
                  type="email"
                  value={datosPerfil.correo}
                  disabled
                />
              </div>

              <div className='eco-perfil-campo'>
                <label htmlFor="eco-perfil-telefono">
                  Telefono
                </label>

                <input
                  id='eco-perfil-telefono'
                  type="tel"
                  maxLength={11}
                  placeholder='Ingresa tu telefono'
                  value={datosPerfil.telefono}
                  disabled={!editandoPerfil || guardandoPerfil}
                  onChange={(e) =>
                    setDatosPerfil({
                      ...datosPerfil,
                      telefono: e.target.value
                    })
                  }
                />
              </div>
              <div className='eso-perfil-campo'>
                <label htmlFor="eco-perfil-fecha">
                  Fecha de nacimiento
                </label>

                <input
                  id='eco-perfil-fecha'
                  type="date"
                  value={datosPerfil.fecha_nacimiento}
                  disabled={!editandoPerfil || guardandoPerfil}
                  onChange={(e) =>
                    setDatosPerfil({
                      ...datosPerfil,
                      fecha_nacimiento: e.target.value
                    })
                  }
                />
              </div>

              <div className='eco-perfil-puntos'>
                <span>Mis puntos disponibles</span>
                <strong>{saldoEcopuntos}</strong>
              </div>

              {(mensajePerfil || mensaje) && (
                <div className='eco-perfil-mensaje' role='status'>
                  {mensajePerfil || mensaje}
                </div>
              )}

              {editandoPerfil ? (
                <div className='eco-perfil-guardando'>
                  <button
                    type='button'
                    className='eco-perfil-guardar'
                    onClick={guardarCambiosPerfil}
                    disabled={guardandoPerfil}
                  >
                    {guardandoPerfil
                      ? 'Guardadno cambios...'
                      : 'Guardar cambios'}
                  </button>

                  <button
                    type='button'
                    className='eco-perfil-cancelar'
                    onClick={cancelarEdicionPerfil}
                    disabled={guardandoPerfil}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  className='eco-perfil-editar'
                  onClick={() => {
                    setMensajePerfil('')
                    setEditandoPerfil(true)
                  }}
                >
                  Editar mi perfil
                </button>
              )}

              <button
                type='button'
                className='eco-perfil-salir'
                onClick={manejarCerrarSesion}
                disabled={cerrandoSesion || guardandoPerfil}
              >
                {cerrandoSesion ? 'Cerrando sesion...' : 'Cerrar sesion'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Ciudadano
