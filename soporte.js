
"use strict";

/* =========================================================
   MENSAJERÍA EXPRESS
   PANEL DE SOPORTE

   SUPABASE
   SESIÓN CENTRAL DE LA INTRANET

   TABLA USUARIOS:
   usuarios

   COLUMNAS:
   id
   nombre
   activo
   creado_en

   FUNCIONES:
   * Tickets
   * Notificaciones
   * Realtime
   * Actualización de estados
   * Usuario actual
   * Cierre de sesión
   * Visualización directa de imágenes adjuntas
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://kayzwwgmebtsaiovkeos.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_yj-QjGhy6RQNUzoxg3HQeg_hkZHuSyL";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            auth: {
                storageKey: "mensajeria-intranet-auth",
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        }
    );


/* =========================================================
   VARIABLES
========================================================= */

let tickets = [];
let ticketsMostrados = [];
let ticketSeleccionado = null;

let ticketsAnteriores = [];
let primeraCarga = true;

let sonidoActivo = true;
let notificacionesActivas = false;

let canalSoporte = null;
let intervaloActualizacion = null;
let toastTimeout = null;

let ticketsNotificados = new Set();


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    iniciarSoporte
);


/* =========================================================
   INICIAR SOPORTE
========================================================= */

async function iniciarSoporte() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (
            error ||
            !data ||
            !data.session
        ) {

            window.location.href =
                "index.html";

            return;

        }


        configurarEventos();

        await cargarUsuarioActual();

        await cargarTickets();

        escucharTickets();

        actualizarConexion(true);

        iniciarActualizacionAutomatica();

        actualizarEstadoBotonNotificaciones();


    } catch (error) {

        console.error(
            "Error iniciando soporte:",
            error
        );

    }

}


/* =========================================================
   CARGAR USUARIO ACTUAL

   TABLA:
   usuarios

   COLUMNAS REALES:
   id
   nombre
   activo
   creado_en

   IMPORTANTE:
   EL EMAIL VIENE DE SUPABASE AUTH,
   NO DE LA TABLA usuarios.
========================================================= */

async function cargarUsuarioActual() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (
            error ||
            !data ||
            !data.session ||
            !data.session.user
        ) {

            window.location.href =
                "index.html";

            return;

        }


        const usuario =
            data.session.user;


        console.log(
            "Usuario autenticado:",
            usuario.id,
            usuario.email
        );


        /* =================================================
           REVISAR SESSION STORAGE
        ================================================= */

        let usuarioGuardado = null;


        try {

            const guardado =
                sessionStorage.getItem(
                    "usuarioSoporte"
                );


            if (guardado) {

                usuarioGuardado =
                    JSON.parse(
                        guardado
                    );

            }

        } catch (error) {

            console.error(
                "Error leyendo usuarioSoporte:",
                error
            );

        }


        /* =================================================
           MOSTRAR USUARIO GUARDADO
        ================================================= */

        if (
            usuarioGuardado &&
            usuarioGuardado.nombre
        ) {

            const nombreGuardado =
                String(
                    usuarioGuardado.nombre
                ).trim();


            const nombreUsuario =
                document.getElementById(
                    "nombreUsuario"
                );


            if (nombreUsuario) {

                nombreUsuario.textContent =
                    nombreGuardado ||
                    "Usuario";

            }

        }


        /* =================================================
           BUSCAR USUARIO EN LA TABLA usuarios
        ================================================= */

        const {
            data: usuarioActual,
            error: errorUsuario
        } = await supabaseClient
            .from("usuarios")
            .select(
                "id, nombre, activo"
            )
            .eq(
                "id",
                usuario.id
            )
            .maybeSingle();


        /* =================================================
           ERROR
        ================================================= */

        if (errorUsuario) {

            console.error(
                "Error consultando usuarios:",
                errorUsuario
            );

            return;

        }


        /* =================================================
           USUARIO NO ENCONTRADO
        ================================================= */

        if (!usuarioActual) {

            console.warn(
                "No se encontró el usuario en la tabla usuarios.",
                "ID:",
                usuario.id
            );

            return;

        }


        /* =================================================
           USUARIO INACTIVO
        ================================================= */

        if (
            usuarioActual.activo === false
        ) {

            console.warn(
                "El usuario está desactivado."
            );


            await supabaseClient.auth.signOut();


            sessionStorage.removeItem(
                "usuarioSoporte"
            );


            window.location.href =
                "index.html";


            return;

        }


        /* =================================================
           GUARDAR USUARIO
        ================================================= */

        sessionStorage.setItem(
            "usuarioSoporte",
            JSON.stringify(
                usuarioActual
            )
        );


        /* =================================================
           MOSTRAR NOMBRE
        ================================================= */

        const nombreCompleto =
            String(
                usuarioActual.nombre ||
                "Usuario"
            ).trim();


        const nombreUsuario =
            document.getElementById(
                "nombreUsuario"
            );


        if (nombreUsuario) {

            nombreUsuario.textContent =
                nombreCompleto ||
                "Usuario";

        }


        console.log(
            "Usuario cargado correctamente:",
            nombreCompleto
        );


    } catch (error) {

        console.error(
            "Error cargando usuario:",
            error
        );

    }

}


/* =========================================================
   CONFIGURAR EVENTOS
========================================================= */

function configurarEventos() {

    const btnSonido =
        document.getElementById(
            "btnSonido"
        );


    if (btnSonido) {

        btnSonido.addEventListener(
            "click",
            alternarSonido
        );

    }


    const btnNotificaciones =
        document.getElementById(
            "btnNotificaciones"
        );


    if (btnNotificaciones) {

        btnNotificaciones.addEventListener(
            "click",
            activarNotificaciones
        );

    }


    const btnSalir =
        document.getElementById(
            "btnSalir"
        );


    if (btnSalir) {

        btnSalir.addEventListener(
            "click",
            async () => {

                btnSalir.disabled = true;


                try {

                    await supabaseClient.auth.signOut();


                } catch (error) {

                    console.error(
                        "Error cerrando sesión:",
                        error
                    );


                } finally {

                    sessionStorage.removeItem(
                        "usuarioSoporte"
                    );


                    window.location.href =
                        "index.html";

                }

            }
        );

    }


    const btnActualizar =
        document.getElementById(
            "btnActualizar"
        );


    if (btnActualizar) {

        btnActualizar.addEventListener(
            "click",
            async () => {

                await cargarTickets();

            }
        );

    }


    const buscarTicket =
        document.getElementById(
            "buscarTicket"
        );


    if (buscarTicket) {

        buscarTicket.addEventListener(
            "input",
            aplicarFiltros
        );

    }


    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );


    if (filtroEstado) {

        filtroEstado.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    const filtroPrioridad =
        document.getElementById(
            "filtroPrioridad"
        );


    if (filtroPrioridad) {

        filtroPrioridad.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    const cerrarModal =
        document.getElementById(
            "cerrarModal"
        );


    if (cerrarModal) {

        cerrarModal.addEventListener(
            "click",
            cerrarModalTicket
        );

    }


    const btnCerrarTicket =
        document.getElementById(
            "btnCerrarTicket"
        );


    if (btnCerrarTicket) {

        btnCerrarTicket.addEventListener(
            "click",
            cerrarModalTicket
        );

    }


    const btnGuardarTicket =
        document.getElementById(
            "btnGuardarTicket"
        );


    if (btnGuardarTicket) {

        btnGuardarTicket.addEventListener(
            "click",
            guardarTicket
        );

    }


    const cerrarToast =
        document.getElementById(
            "cerrarToast"
        );


    if (cerrarToast) {

        cerrarToast.addEventListener(
            "click",
            ocultarToast
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {

                return;

            }


            cerrarModalTicket();

        }
    );

}


/* =========================================================
   SONIDO
========================================================= */

function alternarSonido() {

    sonidoActivo =
        !sonidoActivo;


    const btnSonido =
        document.getElementById(
            "btnSonido"
        );


    if (!btnSonido) {

        return;

    }


    if (sonidoActivo) {

        btnSonido.innerHTML = `
            <i class="ri-volume-up-line"></i>
            Sonido activado
        `;

    } else {

        btnSonido.innerHTML = `
            <i class="ri-volume-mute-line"></i>
            Sonido desactivado
        `;

    }

}


/* =========================================================
   NOTIFICACIONES
========================================================= */

async function activarNotificaciones() {

    if (
        !("Notification" in window)
    ) {

        mostrarToast(
            "Notificaciones",
            "Tu navegador no soporta notificaciones."
        );

        return;

    }


    try {

        const permiso =
            await Notification.requestPermission();


        if (
            permiso === "granted"
        ) {

            notificacionesActivas =
                true;


            mostrarToast(
                "Notificaciones activadas",
                "Recibirás avisos de nuevos tickets."
            );


            actualizarEstadoBotonNotificaciones();

        } else {

            notificacionesActivas =
                false;


            mostrarToast(
                "Notificaciones bloqueadas",
                "Debes permitir las notificaciones en el navegador."
            );


            actualizarEstadoBotonNotificaciones();

        }

    } catch (error) {

        console.error(
            "Error activando notificaciones:",
            error
        );

    }

}


/* =========================================================
   ESTADO BOTÓN NOTIFICACIONES
========================================================= */

function actualizarEstadoBotonNotificaciones() {

    const btn =
        document.getElementById(
            "btnNotificaciones"
        );


    if (!btn) {

        return;

    }


    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        notificacionesActivas =
            true;


        btn.innerHTML = `
            <i class="ri-notification-3-fill"></i>
            Notificaciones activas
        `;

    } else {

        notificacionesActivas =
            false;


        btn.innerHTML = `
            <i class="ri-notification-3-line"></i>
            Activar notificaciones
        `;

    }

}


/* =========================================================
   CARGAR TICKETS
========================================================= */

async function cargarTickets() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                "obtener_tickets_soporte"
            );


        if (error) {

            console.error(
                "Error cargando tickets:",
                error
            );


            actualizarConexion(false);


            return;

        }


        tickets =
            Array.isArray(data)
                ? data
                : [];


        actualizarConexion(true);


        aplicarFiltros();


        if (primeraCarga) {

            ticketsAnteriores =
                [...tickets];


            primeraCarga =
                false;


            return;

        }


        detectarNuevosTickets();


    } catch (error) {

        console.error(
            "Error cargando tickets:",
            error
        );


        actualizarConexion(false);

    }

}


/* =========================================================
   REALTIME
========================================================= */

function escucharTickets() {

    try {

        if (canalSoporte) {

            supabaseClient.removeChannel(
                canalSoporte
            );

        }


        canalSoporte =
            supabaseClient
                .channel(
                    "soporte-tickets"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "tickets_soporte"
                    },
                    async () => {

                        await cargarTickets();

                    }
                )
                .subscribe(
                    status => {

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            actualizarConexion(
                                true
                            );

                        }


                        if (
                            status ===
                            "CHANNEL_ERROR" ||
                            status ===
                            "TIMED_OUT"
                        ) {

                            actualizarConexion(
                                false
                            );

                        }

                    }
                );


    } catch (error) {

        console.error(
            "Error configurando realtime:",
            error
        );


        actualizarConexion(false);

    }

}


/* =========================================================
   DETECTAR NUEVOS TICKETS
========================================================= */

function detectarNuevosTickets() {

    if (
        !ticketsAnteriores ||
        ticketsAnteriores.length === 0
    ) {

        ticketsAnteriores =
            [...tickets];


        return;

    }


    const anteriores =
        new Set(
            ticketsAnteriores.map(
                ticket => ticket.id
            )
        );


    const nuevos =
        tickets.filter(
            ticket =>
                !anteriores.has(
                    ticket.id
                )
        );


    if (
        nuevos.length > 0
    ) {

        nuevos.forEach(
            ticket => {

                if (
                    !ticketsNotificados.has(
                        ticket.id
                    )
                ) {

                    mostrarNotificacionNueva(
                        ticket
                    );


                    ticketsNotificados.add(
                        ticket.id
                    );

                }

            }
        );

    }


    ticketsAnteriores =
        [...tickets];

}


/* =========================================================
   MOSTRAR NOTIFICACIÓN NUEVA
========================================================= */

function mostrarNotificacionNueva(ticket) {

    const contador =
        document.getElementById(
            "contadorNuevos"
        );


    const texto =
        document.getElementById(
            "textoNotificacion"
        );


    if (contador) {

        const actual =
            parseInt(
                contador.textContent || "0",
                10
            );


        contador.textContent =
            actual + 1;

    }


    if (texto) {

        texto.textContent =
            "Nuevo ticket recibido";

    }


    mostrarToast(
        "Nuevo ticket",
        ticket.asunto ||
        "Has recibido una nueva solicitud."
    );


    if (sonidoActivo) {

        reproducirSonido();

    }


    if (
        notificacionesActivas &&
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        try {

            new Notification(
                "Nuevo ticket",
                {
                    body:
                        ticket.asunto ||
                        "Has recibido una nueva solicitud.",

                    icon:
                        "/favicon.ico"
                }
            );


        } catch (error) {

            console.error(
                "Error mostrando notificación:",
                error
            );

        }

    }

}


/* =========================================================
   SONIDO
========================================================= */

function reproducirSonido() {

    try {

        const contexto =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        const oscilador =
            contexto.createOscillator();


        const ganancia =
            contexto.createGain();


        oscilador.type =
            "sine";


        oscilador.frequency.value =
            800;


        ganancia.gain.setValueAtTime(
            0.001,
            contexto.currentTime
        );


        ganancia.gain.exponentialRampToValueAtTime(
            0.2,
            contexto.currentTime + 0.01
        );


        ganancia.gain.exponentialRampToValueAtTime(
            0.001,
            contexto.currentTime + 0.35
        );


        oscilador.connect(
            ganancia
        );


        ganancia.connect(
            contexto.destination
        );


        oscilador.start();


        oscilador.stop(
            contexto.currentTime + 0.35
        );


    } catch (error) {

        console.error(
            "No se pudo reproducir sonido:",
            error
        );

    }

}


/* =========================================================
   FILTROS
========================================================= */

function aplicarFiltros() {

    const buscar =
        document.getElementById(
            "buscarTicket"
        );


    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );


    const filtroPrioridad =
        document.getElementById(
            "filtroPrioridad"
        );


    const texto =
        buscar
            ? buscar.value
                .trim()
                .toLowerCase()
            : "";


    const estado =
        filtroEstado
            ? filtroEstado.value
            : "Todos";


    const prioridad =
        filtroPrioridad
            ? filtroPrioridad.value
            : "Todas";


    ticketsMostrados =
        tickets.filter(
            ticket => {

                const contenido =
                    [
                        ticket.nombre,
                        ticket.apellido,
                        ticket.asunto,
                        ticket.id,
                        ticket.telefono,
                        ticket.correo
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                const coincideBusqueda =
                    !texto ||
                    contenido.includes(
                        texto
                    );


                const estadoTicket =
                    normalizarEstado(
                        ticket.estado
                    );


                const coincideEstado =
                    estado === "Todos" ||
                    normalizarEstado(
                        estado
                    ) === estadoTicket;


                const prioridadTicket =
                    normalizarTexto(
                        ticket.prioridad
                    );


                const coincidePrioridad =
                    prioridad === "Todas" ||
                    normalizarTexto(
                        prioridad
                    ) === prioridadTicket;


                return (
                    coincideBusqueda &&
                    coincideEstado &&
                    coincidePrioridad
                );

            }
        );


    actualizarEstadisticas();

    renderizarTickets();

}


/* =========================================================
   ESTADÍSTICAS
========================================================= */

function actualizarEstadisticas() {

    const total =
        tickets.length;


    const pendientes =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) ===
                "pendiente"
        ).length;


    const revision =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) ===
                "en revision"
        ).length;


    const resueltos =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) ===
                "resuelto"
        ).length;


    const totalElement =
        document.getElementById(
            "totalTickets"
        );


    const pendientesElement =
        document.getElementById(
            "ticketsPendientes"
        );


    const revisionElement =
        document.getElementById(
            "ticketsRevision"
        );


    const resueltosElement =
        document.getElementById(
            "ticketsResueltos"
        );


    if (totalElement) {

        totalElement.textContent =
            total;

    }


    if (pendientesElement) {

        pendientesElement.textContent =
            pendientes;

    }


    if (revisionElement) {

        revisionElement.textContent =
            revision;

    }


    if (resueltosElement) {

        resueltosElement.textContent =
            resueltos;

    }

}


/* =========================================================
   RENDERIZAR TICKETS
========================================================= */

function renderizarTickets() {

    const lista =
        document.getElementById(
            "listaTickets"
        );


    const sinTickets =
        document.getElementById(
            "sinTickets"
        );


    const textoCantidad =
        document.getElementById(
            "textoCantidad"
        );


    if (!lista) {

        return;

    }


    lista.innerHTML =
        "";


    if (textoCantidad) {

        textoCantidad.textContent =
            `${ticketsMostrados.length} ${ticketsMostrados.length === 1
                ? "ticket"
                : "tickets"
            }`;

    }


    if (
        ticketsMostrados.length === 0
    ) {

        if (sinTickets) {

            sinTickets.style.display =
                "block";

        }


        return;

    }


    if (sinTickets) {

        sinTickets.style.display =
            "none";

    }


    ticketsMostrados.forEach(
        ticket => {

            const tarjeta =
                crearTarjetaTicket(
                    ticket
                );


            lista.appendChild(
                tarjeta
            );

        }
    );

}


/* =========================================================
   CREAR TARJETA
========================================================= */

function crearTarjetaTicket(ticket) {

    const tarjeta =
        document.createElement(
            "div"
        );


    tarjeta.className =
        "ticket-card";


    const estado =
        ticket.estado ||
        "Pendiente";


    const prioridad =
        ticket.prioridad ||
        "Normal";


    const nombre =
        [
            ticket.nombre,
            ticket.apellido
        ]
            .filter(Boolean)
            .join(" ") ||
        "Usuario";


    const asunto =
        ticket.asunto ||
        "Sin asunto";


    const descripcion =
        ticket.descripcion ||
        "Sin descripción";


    tarjeta.innerHTML = `

        <div class="ticket-card-cabecera">

            <div>

                <span class="ticket-id">
                    #${ticket.id || "0"}
                </span>

                <h4>
                    ${escaparHTML(asunto)}
                </h4>

            </div>

            <span class="badge-estado ${obtenerClaseEstado(estado)}">
                ${escaparHTML(estado)}
            </span>

        </div>


        <div class="ticket-card-usuario">

            <div class="avatar">
                <i class="ri-user-line"></i>
            </div>

            <div>

                <strong>
                    ${escaparHTML(nombre)}
                </strong>

                <span>
                    ${escaparHTML(
        ticket.correo ||
        "Sin correo"
    )}
                </span>

            </div>

        </div>


        <p class="ticket-card-descripcion">
            ${escaparHTML(descripcion)}
        </p>


        <div class="ticket-card-pie">

            <span class="prioridad ${obtenerClasePrioridad(prioridad)}">
                ${escaparHTML(prioridad)}
            </span>

            <span>
                ${formatearFecha(
        ticket.creado_en ||
        ticket.fecha
    )}
            </span>

        </div>

    `;


    tarjeta.addEventListener(
        "click",
        () => {

            abrirTicket(
                ticket
            );

        }
    );


    return tarjeta;

}


/* =========================================================
   ABRIR TICKET
========================================================= */

function abrirTicket(ticket) {

    ticketSeleccionado =
        ticket;


    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (!modal) {

        return;

    }


    establecerTexto(
        "modalNumero",
        `Ticket #${ticket.id || "0"}`
    );


    establecerTexto(
        "modalAsunto",
        ticket.asunto ||
        "Sin asunto"
    );


    establecerTexto(
        "modalNombre",
        [
            ticket.nombre,
            ticket.apellido
        ]
            .filter(Boolean)
            .join(" ") ||
        "Usuario"
    );


    establecerTexto(
        "modalCorreo",
        ticket.correo ||
        "Sin correo"
    );


    establecerTexto(
        "modalTelefono",
        ticket.telefono ||
        "Sin teléfono"
    );


    establecerTexto(
        "modalCategoria",
        ticket.categoria ||
        ticket.problema ||
        "-"
    );


    establecerTexto(
        "modalPrioridad",
        ticket.prioridad ||
        "-"
    );


    establecerTexto(
        "modalEstado",
        ticket.estado ||
        "-"
    );


    establecerTexto(
        "modalFecha",
        formatearFecha(
            ticket.creado_en ||
            ticket.fecha
        )
    );


    establecerTexto(
        "modalDescripcion",
        ticket.descripcion ||
        "-"
    );


    const estadoTicket =
        document.getElementById(
            "estadoTicket"
        );


    if (estadoTicket) {

        estadoTicket.value =
            encontrarOpcionEstado(
                ticket.estado
            );

    }


    const respuestaTicket =
        document.getElementById(
            "respuestaTicket"
        );


    if (respuestaTicket) {

        respuestaTicket.value =
            ticket.respuesta ||
            ticket.respuesta_soporte ||
            "";

    }


    /* =====================================================
       CARGAR ARCHIVO / IMAGEN
    ===================================================== */

    cargarArchivoTicket(
        ticket
    );


    modal.classList.add(
        "modal-abierto"
    );


    document.body.classList.add(
        "modal-abierto"
    );

}


/* =========================================================
   ARCHIVO / IMAGEN
========================================================= */

function cargarArchivoTicket(ticket) {

    const contenedor =
        document.getElementById(
            "modalArchivoContenedor"
        );


    const archivo =
        document.getElementById(
            "modalArchivo"
        );


    if (
        !contenedor ||
        !archivo
    ) {

        return;

    }


    /* =====================================================
       OBTENER URL
    ===================================================== */

    const url =
        ticket.archivo_url ||
        ticket.archivo ||
        ticket.adjunto_url ||
        "";


    /* =====================================================
       NO HAY ARCHIVO
    ===================================================== */

    if (!url) {

        contenedor.style.display =
            "none";


        archivo.innerHTML =
            "";


        archivo.removeAttribute(
            "href"
        );


        archivo.removeAttribute(
            "target"
        );


        archivo.removeAttribute(
            "rel"
        );


        return;

    }


    /* =====================================================
       MOSTRAR CONTENEDOR
    ===================================================== */

    contenedor.style.display =
        "block";


    /* =====================================================
       LIMPIAR ANTERIOR
    ===================================================== */

    archivo.innerHTML =
        "";


    archivo.removeAttribute(
        "target"
    );


    archivo.removeAttribute(
        "rel"
    );


    /* =====================================================
       DETECTAR EXTENSIÓN
    ===================================================== */

    const urlSinParametros =
        String(url)
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();


    const esImagen =
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i
            .test(
                urlSinParametros
            );


    /* =====================================================
       IMAGEN
    ===================================================== */

    if (esImagen) {

        archivo.removeAttribute(
            "href"
        );


        archivo.innerHTML = `

            <div class="modal-imagen-adjunto">

                <img
                    src="${escaparHTML(url)}"
                    alt="Imagen adjunta del ticket"
                    class="imagen-adjunta-ticket"
                    loading="eager"
                >

            </div>

        `;


        return;

    }


    /* =====================================================
       ARCHIVO NORMAL
    ===================================================== */

    archivo.href =
        url;


    archivo.target =
        "_blank";


    archivo.rel =
        "noopener noreferrer";


    archivo.innerHTML = `

        <div class="archivo-adjunto">

            <i class="ri-file-line"></i>

            <span>
                Ver archivo adjunto
            </span>

        </div>

    `;

}


/* =========================================================
   CERRAR MODAL
========================================================= */

function cerrarModalTicket() {

    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "modal-abierto"
    );


    document.body.classList.remove(
        "modal-abierto"
    );


    ticketSeleccionado =
        null;

}


/* =========================================================
   GUARDAR TICKET
========================================================= */

async function guardarTicket() {

    if (!ticketSeleccionado) {

        return;

    }


    const estadoTicket =
        document.getElementById(
            "estadoTicket"
        );


    const respuestaTicket =
        document.getElementById(
            "respuestaTicket"
        );


    const btnGuardar =
        document.getElementById(
            "btnGuardarTicket"
        );


    const nuevoEstado =
        estadoTicket
            ? estadoTicket.value
            : ticketSeleccionado.estado;


    const respuesta =
        respuestaTicket
            ? respuestaTicket.value.trim()
            : "";


    if (btnGuardar) {

        btnGuardar.disabled =
            true;


        btnGuardar.innerHTML = `
            <i class="ri-loader-4-line ri-spin"></i>
            Guardando...
        `;

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                "actualizar_ticket_soporte",
                {
                    p_ticket_id:
                        ticketSeleccionado.id,

                    p_estado:
                        nuevoEstado,

                    p_respuesta:
                        respuesta
                }
            );


        if (error) {

            console.error(
                "Error actualizando ticket:",
                error
            );


            mostrarToast(
                "Error",
                "No se pudieron guardar los cambios."
            );


            return;

        }


        mostrarToast(
            "Ticket actualizado",
            "Los cambios se guardaron correctamente."
        );


        const ticketActualizado =
            tickets.find(
                ticket =>
                    ticket.id ===
                    ticketSeleccionado.id
            );


        if (ticketActualizado) {

            ticketActualizado.estado =
                nuevoEstado;


            ticketActualizado.respuesta =
                respuesta;

        }


        cerrarModalTicket();


        aplicarFiltros();


        const estadoNormalizado =
            normalizarEstado(
                nuevoEstado
            );


        setTimeout(
            () => {

                if (
                    estadoNormalizado ===
                    "pendiente"
                ) {

                    window.location.href =
                        "Pendientes.html";

                    return;

                }


                if (
                    estadoNormalizado ===
                    "en revision"
                ) {

                    window.location.href =
                        "revision.html";

                    return;

                }


                if (
                    estadoNormalizado ===
                    "resuelto"
                ) {

                    window.location.href =
                        "resuelto.html";

                    return;

                }


                if (
                    estadoNormalizado ===
                    "cerrado"
                ) {

                    window.location.href =
                        "Cerrado.html";

                    return;

                }

            },
            700
        );


    } catch (error) {

        console.error(
            "Error guardando ticket:",
            error
        );


        mostrarToast(
            "Error",
            "Ocurrió un error al guardar el ticket."
        );


    } finally {

        if (btnGuardar) {

            btnGuardar.disabled =
                false;


            btnGuardar.innerHTML = `
                <i class="ri-save-line"></i>
                Guardar cambios
            `;

        }

    }

}


/* =========================================================
   CONEXIÓN
========================================================= */

function actualizarConexion(
    conectado
) {

    const indicador =
        document.getElementById(
            "indicadorConexion"
        );


    if (!indicador) {

        return;

    }


    if (conectado) {

        indicador.className =
            "conexion conectado";


        indicador.innerHTML = `
            <i class="ri-checkbox-circle-fill"></i>
            Conectado
        `;

    } else {

        indicador.className =
            "conexion";


        indicador.innerHTML = `
            <i class="ri-close-circle-fill"></i>
            Desconectado
        `;

    }

}


/* =========================================================
   ACTUALIZACIÓN AUTOMÁTICA
========================================================= */

function iniciarActualizacionAutomatica() {

    if (intervaloActualizacion) {

        clearInterval(
            intervaloActualizacion
        );

    }


    intervaloActualizacion =
        setInterval(
            async () => {

                await cargarTickets();

            },
            60000
        );

}


/* =========================================================
   TOAST
========================================================= */

function mostrarToast(
    titulo,
    texto
) {

    const toast =
        document.getElementById(
            "toast"
        );


    const toastTitulo =
        document.getElementById(
            "toastTitulo"
        );


    const toastTexto =
        document.getElementById(
            "toastTexto"
        );


    if (!toast) {

        return;

    }


    if (toastTitulo) {

        toastTitulo.textContent =
            titulo;

    }


    if (toastTexto) {

        toastTexto.textContent =
            texto;

    }


    toast.classList.add(
        "mostrar"
    );


    if (toastTimeout) {

        clearTimeout(
            toastTimeout
        );

    }


    toastTimeout =
        setTimeout(
            ocultarToast,
            5000
        );

}


/* =========================================================
   OCULTAR TOAST
========================================================= */

function ocultarToast() {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        return;

    }


    toast.classList.remove(
        "mostrar"
    );

}


/* =========================================================
   ESTABLECER TEXTO
========================================================= */

function establecerTexto(
    id,
    texto
) {

    const elemento =
        document.getElementById(
            id
        );


    if (elemento) {

        elemento.textContent =
            texto;

    }

}


/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

function normalizarTexto(
    texto
) {

    return String(
        texto || ""
    )
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim()
        .toLowerCase();

}


/* =========================================================
   NORMALIZAR ESTADO
========================================================= */

function normalizarEstado(
    estado
) {

    return normalizarTexto(
        estado
    );

}


/* =========================================================
   CLASE ESTADO
========================================================= */

function obtenerClaseEstado(
    estado
) {

    const normalizado =
        normalizarEstado(
            estado
        );


    if (
        normalizado ===
        "pendiente"
    ) {

        return "pendiente";

    }


    if (
        normalizado ===
        "en revision"
    ) {

        return "revision";

    }


    if (
        normalizado ===
        "resuelto"
    ) {

        return "resuelto";

    }


    if (
        normalizado ===
        "cerrado"
    ) {

        return "cerrado";

    }


    return "";

}


/* =========================================================
   CLASE PRIORIDAD
========================================================= */

function obtenerClasePrioridad(
    prioridad
) {

    const normalizada =
        normalizarTexto(
            prioridad
        );


    if (
        normalizada ===
        "urgente"
    ) {

        return "urgente";

    }


    if (
        normalizada ===
        "alta"
    ) {

        return "alta";

    }


    return "normal";

}


/* =========================================================
   ENCONTRAR OPCIÓN DE ESTADO
========================================================= */

function encontrarOpcionEstado(
    estado
) {

    const normalizado =
        normalizarEstado(
            estado
        );


    if (
        normalizado ===
        "en revision"
    ) {

        return "En revisión";

    }


    if (
        normalizado ===
        "resuelto"
    ) {

        return "Resuelto";

    }


    if (
        normalizado ===
        "cerrado"
    ) {

        return "Cerrado";

    }


    return "Pendiente";

}


/* =========================================================
   FORMATEAR FECHA
========================================================= */

function formatearFecha(
    fecha
) {

    if (!fecha) {

        return "-";

    }


    try {

        const fechaObj =
            new Date(
                fecha
            );


        if (
            Number.isNaN(
                fechaObj.getTime()
            )
        ) {

            return String(
                fecha
            );

        }


        return fechaObj.toLocaleString(
            "es-GT",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );


    } catch (error) {

        return String(
            fecha
        );

    }

}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escaparHTML(
    texto
) {

    return String(
        texto ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   CLIC FUERA DEL MODAL
========================================================= */

window.addEventListener(
    "click",
    event => {

        const modal =
            document.getElementById(
                "modalTicket"
            );


        if (
            modal &&
            event.target === modal
        ) {

            cerrarModalTicket();

        }

    }
);


/* =========================================================
   LIMPIEZA AL SALIR
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (intervaloActualizacion) {

            clearInterval(
                intervaloActualizacion
            );

        }


        if (canalSoporte) {

            try {

                supabaseClient.removeChannel(
                    canalSoporte
                );

            } catch (error) {

                console.error(
                    "Error cerrando canal:",
                    error
                );

            }

        }

    }
);
