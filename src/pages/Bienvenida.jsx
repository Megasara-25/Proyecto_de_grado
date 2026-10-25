import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import logoEcocycle from '../assets/ecocycle-logo.png'
import imagenReciclar from '../assets/onboarding/01_Reciclar_Facil.png'
import imagenEntregas from '../assets/onboarding/02_Encuentra_Entrega_Acumula.png'
import imagenPuntos from '../assets/onboarding/03_puntos_acumulables.png'
import './Bienvenida.css'

const LANDING_URL = 'https://megasara-25.github.io/Landig-Ecocycle/'

const pantallas = [{
    numero:'01',
    categoria: '¿Que es EcoCycle?',
    imagen: imagenReciclar,
    titulo: 'Reciclar ahora es mas facil',
    descripcion: "EcoCycle conecta a als personas con puntos de recoleccion para darles una nueva oportunidad a sus residuos",
    detalle: 'Una forma sencilla de contribuir al cuidado del planeta'
}, {
    numero:'02',
    categoria: '¿como funcona?',
    imagen: imagenEntregas,
    titulo: 'Encuentra, entrega y acumula',
    descripcion: 'Ubicacion donde reciclar, entrega tus materiales y recibe Ecopuntos por las entregas validadas',
    detalle:'Cada entrega cuenta y te acerca a nuevas recopensas'
},
{
    numero:'03',
    categoria:'¿Que meneficios tiene?',
    imagen: imagenPuntos,
    titulo: 'Tus acciones tiene recompensas',
    descripcion: 'Canjea tus ecopuntos por beneficios en comercio aliados y aprender a reciclar de forma responsable',
    detalle:'COnoce tambien a los personajes educativos de EcoCycle'
}]

function Bienvenida({ irALogin, irARegistro}){
    const [paso, setPaso] = useState(0)
    const pantalla = pantallas[paso]
    const esUltima = paso === pantallas.length -1

    const abrirLanding = async () => {
        if(Capacitor.isNativePlatform()){
            const {Browser} = await import('@capacitor/browser')
            await Browser.open({url: LANDING_URL})
        }else {
            window.open(LANDING_URL, '_blank', 'noopener,noreferrer')
        }
    }

    const siguiente = () => {
        setPaso((actual) => Math.min(actual + 1, pantallas.length -1))
    } 

    const anterior = () => {
        setPaso((actual) => Math.max(actual - 1, 0))
    }

    return(
        <main className='eco-bienvenida'>
            <div className='eco-bienvenida-fondo eco-bienvenida-fondo-uno'/>
            <div className ='eco-bienvenida-fondo eco-bienvenida-fondo-dos'/>

            <section className= 'eco-bienvenida-tarjeta'>
                <header className= 'eco-bienvenida-encabezado'>
                    <img
                        src={logoEcocycle}
                        alt='EcoCycle'
                        className='eco-bienvenida-logo'
                    />

                    {!esUltima && (
                        <button
                            type= 'button'
                            className= 'eco-bienvenida-saltar'
                            onClick={irALogin}
                            aria-label='Saltar introduccion e ir al inicio de sesion'
                        >
                             Saltar <span arial-hidden='true'></span>
                        </button>
                        )}
                </header>
                    <div className='eco-bienvenida-contenido'>
                        <div className='eco-bienvenida-ilustracion' aria-hidden='true'>
                            <img
                                src={pantalla.imagen}
                                alt={`Ilustración: ${pantalla.categoria}`}
                                className='eco-bienvenida-imagen'
                            />
                        </div>

                        <div className=' eco-bienvenida-informacion'>
                            <span className='eco-bienvenida-categoria'>
                                {pantalla.categoria}
                            </span>

                            <h1>{pantalla.titulo}</h1>

                            <p className='eco-bienvenida-descripcion'>
                                {pantalla.descripcion}
                            </p>

                            <p className='eco-bienvenida-detalle'>
                                {pantalla.detalle}
                            </p>
                        </div>
                    </div>

                    <footer className='eco-bienvenida-footer'>
                        <div
                           className='eco-bienvenida-indicadores'
                           aria-label={`Pantalla ${paso + 1} de ${pantallas.length}`}
                        >
                            {pantallas.map((item,indice)=>(
                                <span
                                    key={item.numero}
                                    className={
                                        indice === paso
                                        ? 'eco-bienvenida-punto activo'
                                        : 'eco-bienvenida-punto'
                                    }
                                />
                            ))}
                        </div>

                        {!esUltima ? (
                            <div className='eco-bienvenida-acciones'>
                                {paso > 0 &&(
                                    <button
                                        type='button'
                                        className='eco-bienvenida-boton-secundario'
                                        onClick={anterior}
                                    >
                                        Anterior
                                    </button>
                                )}

                                <button
                                    type='button'
                                    className='eco-bienvenida-boton-principal'
                                    onClick={siguiente}
                                >
                                    Siguiente
                                </button>
                            </div>
                        ):(
                            <div className='eco-bienvenida-acciones-finales'>
                                <button
                                    type='button'
                                    className='eco-bienvenida-boton-principal'
                                    onClick={irALogin}
                                >
                                    Iniciar sesion
                                </button>

                                <button
                                    type='button'
                                    className='eco-bienvenida-boton-secundario'
                                    onClick={irARegistro}
                                >
                                    Crear cuenta
                                </button>

                                <button
                                    type='button'
                                    className='eco-bienvenida-enlace'
                                    onClick={()=>{
                                        void abrirLanding().catch(() => {
                                            window.location.href = LANDING_URL
                                        })
                                    }}
                                >
                                    Conoce mas sobre EcoCyle
                                </button>
                            </div>
                        )}
                    <p className='eco-bienvenida-pie'>
                          pequeñas acciones, grandes cambios
                    </p>
                </footer>
            </section>
        </main>
    )
}

export default Bienvenida