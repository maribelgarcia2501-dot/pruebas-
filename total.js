/* =========================================================
   MENSAJERÍA EXPRESS
   TOTAL.JS

   TODOS LOS TICKETS

   SUPABASE AUTH
   public.usuarios
   tickets_soporte

   ARCHIVOS ADJUNTOS:

   * archivo_url
   * archivo
   * url_archivo
   * adjunto
   * adjunto_url
   * archivo_adjunto
   * documento
   * documento_url

   IMPORTANTE:

   * El usuario de soporte se obtiene desde Supabase Auth.
   * Se consulta public.usuarios.
   * NO usa usuarios_soporte.
   * NO usa perfiles.
   * NO requiere rol.
   * modalNombre es el usuario que creó el ticket.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       CONFIGURACIÓN SUPABASE
    ===================================================== */

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


    /* =====================================================
       VARIABLES GLOBALES
    ===================================================== */

    let usuarioSoporteActual = null;

    let tickets = [];

    let ticketsFiltrados = [];

    let ticketSeleccionado = null;

    let canalRealtime = null;

    let sonidoActivado = false;


    /* =====================================================
       ELEMENTOS
    ===================================================== */

    const nombreUsuario =
        document.getElementById("nombreUsuario");

    const listaTickets =
        document.getElementById("listaTickets");

    const sinTickets =
        document.getElementById("sinTickets");

    const textoCantidad =
        document.getElementById("textoCantidad");

    const buscarTicket =
        document.getElementById("buscarTicket");

    const btnActualizar =
        document.getElementById("btnActualizar");

    const btnSonido =
        document.getElementById("btnSonido");

    const indicadorConexion =
        document.getElementById("indicadorConexion");

    const modalTicket =
        document.getElementById("modalTicket");

    const cerrarModalBtn =
        document.getElementById("cerrarModal");

    const btnCerrarTicket =
        document.getElementById("btnCerrarTicket");

    const btnGuardarTicket =
        document.getElementById("btnGuardarTicket");

    const estadoTicket =
        document.getElementById("estadoTicket");

    const respuestaTicket =
        document.getElementById("respuestaTicket");


    /* =====================================================
       INICIAR
    ===================================================== */

    iniciarTotal();


    async function iniciarTotal() {

        try {

            const usuarioCargado =
                await cargarUsuarioActual();

            if (!usuarioCargado) {
                return;
            }


            configurarEventos();


            await cargarTodosLosTickets();


            configurarRealtime();


        } catch (error) {

            console.error(
                "ERROR INICIANDO TODOS LOS TICKETS:",
                error
            );

        }

    }


    /* =====================================================
       CARGAR USUARIO ACTUAL

       AUTH
         ↓
       public.usuarios
         ↓
       id / nombre / activo
    ===================================================== */

    async function cargarUsuarioActual() {

        try {

            const {
                data,
                error
            } =
                await supabaseClient.auth.getSession();


            if (error) {

                console.error(
                    "ERROR OBTENIENDO SESIÓN:",
                    error
                );


                window.location.href =
                    "index.html";


                return false;

            }


            if (
                !data ||
                !data.session ||
                !data.session.user
            ) {

                console.warn(
                    "NO HAY SESIÓN ACTIVA."
                );


                window.location.href =
                    "index.html";


                return false;

            }


            const usuario =
                data.session.user;


            console.log(
                "USUARIO AUTH:",
                usuario
            );


            /* =================================================
               BUSCAR USUARIO EN public.usuarios
            ================================================= */

            const {
                data: usuarioActual,
                error: errorUsuario
            } =
                await supabaseClient
                    .from("usuarios")
                    .select(
                        "id, nombre, activo"
                    )
                    .eq(
                        "id",
                        usuario.id
                    )
                    .maybeSingle();


            if (errorUsuario) {

                console.error(
                    "ERROR CONSULTANDO usuarios:",
                    errorUsuario
                );


                return false;

            }


            if (!usuarioActual) {

                console.error(
                    "NO SE ENCONTRÓ EL USUARIO EN LA TABLA usuarios."
                );


                return false;

            }


            /* =================================================
               COMPROBAR ACTIVO
            ================================================= */

            if (
                usuarioActual.activo === false
            ) {

                console.warn(
                    "EL USUARIO ESTÁ INACTIVO."
                );


                await supabaseClient.auth.signOut();


                sessionStorage.removeItem(
                    "usuarioSoporte"
                );


                window.location.href =
                    "index.html";


                return false;

            }


            /* =================================================
               GUARDAR USUARIO
            ================================================= */

            usuarioSoporteActual =
                usuarioActual;


            const nombreCompleto =
                String(
                    usuarioActual.nombre ||
                    "Usuario"
                ).trim();


            /* =================================================
               MOSTRAR NOMBRE EN HEADER
            ================================================= */

            if (nombreUsuario) {

                nombreUsuario.textContent =
                    nombreCompleto;

            }


            /* =================================================
               OTROS ELEMENTOS DE USUARIO
            ================================================= */

            document
                .querySelectorAll(
                    ".nombre-usuario, .usuario-nombre"
                )
                .forEach(elemento => {

                    elemento.textContent =
                        nombreCompleto;

                });


            /* =================================================
               SESSION STORAGE
            ================================================= */

            sessionStorage.setItem(
                "usuarioSoporte",
                JSON.stringify({
                    id:
                        usuarioActual.id,

                    nombre:
                        usuarioActual.nombre,

                    activo:
                        usuarioActual.activo
                })
            );


            console.log(
                "USUARIO DE SOPORTE CARGADO:",
                usuarioActual
            );


            return true;


        } catch (error) {

            console.error(
                "ERROR CARGANDO USUARIO ACTUAL:",
                error
            );


            return false;

        }

    }


    /* =====================================================
       CONFIGURAR EVENTOS
    ===================================================== */

    function configurarEventos() {


        /* =================================================
           BUSCADOR
        ================================================= */

        if (buscarTicket) {

            buscarTicket.addEventListener(
                "input",
                () => {

                    aplicarBusqueda();

                }
            );

        }


        /* =================================================
           ACTUALIZAR
        ================================================= */

        if (btnActualizar) {

            btnActualizar.addEventListener(
                "click",
                async () => {

                    await cargarTodosLosTickets();

                }
            );

        }


        /* =================================================
           SONIDO
        ================================================= */

        if (btnSonido) {

            btnSonido.addEventListener(
                "click",
                activarDesactivarSonido
            );

        }


        /* =================================================
           CERRAR MODAL
        ================================================= */

        if (cerrarModalBtn) {

            cerrarModalBtn.addEventListener(
                "click",
                cerrarModal
            );

        }


        if (btnCerrarTicket) {

            btnCerrarTicket.addEventListener(
                "click",
                cerrarModal
            );

        }


        /* =================================================
           GUARDAR CAMBIOS
        ================================================= */

        if (btnGuardarTicket) {

            btnGuardarTicket.addEventListener(
                "click",
                guardarCambiosTicket
            );

        }


        /* =================================================
           CLICK FUERA DEL MODAL
        ================================================= */

        if (modalTicket) {

            modalTicket.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modalTicket
                    ) {

                        cerrarModal();

                    }

                }
            );

        }


        /* =================================================
           ESC
        ================================================= */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    cerrarModal();

                }

            }
        );

    }


    /* =====================================================
       CARGAR TODOS LOS TICKETS
    ===================================================== */

    async function cargarTodosLosTickets() {

        mostrarCargando();


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
                    "ERROR OBTENIENDO TODOS LOS TICKETS:",
                    error
                );


                actualizarIndicadorConexion(
                    false
                );


                mostrarError(
                    "No fue posible cargar los tickets."
                );


                return;

            }


            tickets =
                Array.isArray(data)
                    ? data
                    : [];


            ticketsFiltrados =
                [...tickets];


            actualizarIndicadorConexion(
                true
            );


            aplicarBusqueda();


        } catch (error) {

            console.error(
                "ERROR CARGANDO TODOS LOS TICKETS:",
                error
            );


            actualizarIndicadorConexion(
                false
            );


            mostrarError(
                "No fue posible conectar con el servidor."
            );

        }

    }


    /* =====================================================
       BUSCADOR
    ===================================================== */

    function aplicarBusqueda() {

        const texto =
            normalizar(
                buscarTicket
                    ? buscarTicket.value
                    : ""
            );


        if (!texto) {

            ticketsFiltrados =
                [...tickets];

        } else {

            ticketsFiltrados =
                tickets.filter(
                    ticket => {

                        const contenido = [

                            ticket.id,

                            ticket.nombre,

                            ticket.apellido,

                            ticket.correo,

                            ticket.email,

                            ticket.telefono,

                            ticket.phone,

                            ticket.categoria,

                            ticket.prioridad,

                            ticket.asunto,

                            ticket.descripcion,

                            ticket.estado

                        ]
                            .map(
                                valor =>
                                    normalizar(valor)
                            )
                            .join(" ");


                        return contenido.includes(
                            texto
                        );

                    }
                );

        }


        renderizarTickets();

    }


    /* =====================================================
       RENDERIZAR TODOS LOS TICKETS
    ===================================================== */

    function renderizarTickets() {

        if (!listaTickets) {
            return;
        }


        listaTickets.innerHTML =
            "";


        const cantidad =
            ticketsFiltrados.length;


        if (textoCantidad) {

            textoCantidad.textContent =
                cantidad === 1
                    ? "1 ticket"
                    : `${cantidad} tickets`;

        }


        if (cantidad === 0) {

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


        ticketsFiltrados.forEach(
            ticket => {

                const tarjeta =
                    crearTarjetaTicket(
                        ticket
                    );


                listaTickets.appendChild(
                    tarjeta
                );

            }
        );

    }


    /* =====================================================
       CREAR TARJETA
    ===================================================== */

    function crearTarjetaTicket(
        ticket
    ) {

        const tarjeta =
            document.createElement(
                "article"
            );


        tarjeta.className =
            "ticket-card";


        tarjeta.dataset.ticketId =
            ticket.id;


        const nombre =
            escapeHTML(
                ticket.nombre ||
                "Usuario"
            );


        const apellido =
            escapeHTML(
                ticket.apellido ||
                ""
            );


        const asunto =
            escapeHTML(
                ticket.asunto ||
                "Sin asunto"
            );


        const categoria =
            escapeHTML(
                ticket.categoria ||
                "Sin categoría"
            );


        const prioridadTexto =
            ticket.prioridad ||
            "Normal";


        const prioridad =
            escapeHTML(
                prioridadTexto
            );


        const estadoTexto =
            ticket.estado ||
            "Sin estado";


        const estado =
            escapeHTML(
                estadoTexto
            );


        const descripcion =
            escapeHTML(
                ticket.descripcion ||
                "Sin descripción"
            );


        const fecha =
            formatearFecha(
                ticket.creado_en ||
                ticket.created_at ||
                ticket.fecha ||
                ticket.fecha_creacion
            );


        const clasePrioridad =
            obtenerClasePrioridad(
                ticket.prioridad
            );


        const claseEstado =
            obtenerClaseEstado(
                ticket.estado
            );


        tarjeta.innerHTML = `

        <div class="ticket-card-cabecera">

            <div>

                <span class="ticket-id">

                    #${escapeHTML(ticket.id)}

                </span>


                <h4>

                    ${asunto}

                </h4>

            </div>


            <span class="badge-estado ${claseEstado}">

                ${estado}

            </span>

        </div>


        <div class="ticket-card-usuario">

            <div class="avatar">

                <i class="ri-user-line"></i>

            </div>


            <div>

                <strong>

                    ${nombre} ${apellido}

                </strong>


                <span>

                    ${escapeHTML(
            ticket.correo ||
            ticket.email ||
            "Sin correo"
        )}

                </span>

            </div>

        </div>


        <p class="ticket-card-descripcion">

            ${descripcion}

        </p>


        <div class="ticket-card-pie">

            <div>

                <span class="${clasePrioridad}">

                    ${prioridad}

                </span>

            </div>


            <span>

                ${fecha}

            </span>

        </div>

    `;


        tarjeta.addEventListener(
            "click",
            () => {

                abrirModal(ticket);

            }
        );


        return tarjeta;

    }


    /* =====================================================
       ABRIR MODAL
    ===================================================== */

    function abrirModal(
        ticket
    ) {

        if (!modalTicket) {
            return;
        }


        ticketSeleccionado =
            ticket;


        ponerTexto(
            "modalNumero",
            `Ticket #${ticket.id || ""}`
        );


        ponerTexto(
            "modalAsunto",
            ticket.asunto ||
            "Sin asunto"
        );


        /* =================================================
           USUARIO QUE CREÓ EL TICKET

           NO ES EL USUARIO DE SOPORTE.
        ================================================= */

        const nombreSolicitante =
            `${ticket.nombre || "Usuario"} ${ticket.apellido || ""}`
                .trim();


        ponerTexto(
            "modalNombre",
            nombreSolicitante
        );


        ponerTexto(
            "modalCorreo",
            ticket.correo ||
            ticket.email ||
            "No especificado"
        );


        ponerTexto(
            "modalTelefono",
            ticket.telefono ||
            ticket.phone ||
            "No especificado"
        );


        ponerTexto(
            "modalCategoria",
            ticket.categoria ||
            ticket.nombre_categoria ||
            "No especificada"
        );


        ponerTexto(
            "modalPrioridad",
            ticket.prioridad ||
            "Normal"
        );


        ponerTexto(
            "modalEstado",
            ticket.estado ||
            "Sin estado"
        );


        ponerTexto(
            "modalFecha",
            formatearFecha(
                ticket.creado_en ||
                ticket.created_at ||
                ticket.fecha ||
                ticket.fecha_creacion
            )
        );


        ponerTexto(
            "modalDescripcion",
            ticket.descripcion ||
            "Sin descripción"
        );


        /* =================================================
           ARCHIVO ADJUNTO
        ================================================= */

        configurarArchivoAdjunto(
            ticket
        );


        /* =================================================
           ESTADO SELECT
        ================================================= */

        if (estadoTicket) {

            estadoTicket.value =
                obtenerValorEstado(
                    ticket.estado
                );

        }


        /* =================================================
           RESPUESTA
        ================================================= */

        if (respuestaTicket) {

            respuestaTicket.value =
                ticket.respuesta ||
                ticket.respuesta_soporte ||
                ticket.respuesta_backoffice ||
                "";

        }


        modalTicket.classList.add(
            "mostrar"
        );


        document.body.classList.add(
            "modal-abierto"
        );

    }


    /* =====================================================
       CONFIGURAR ARCHIVO ADJUNTO

       SI ES IMAGEN:
       - SE MUESTRA DIRECTAMENTE EN EL MODAL.

       SI NO ES IMAGEN:
       - SE MANTIENE EL BOTÓN "ABRIR ARCHIVO".
    ===================================================== */

    function configurarArchivoAdjunto(
        ticket
    ) {

        const archivoContenedor =
            document.getElementById(
                "modalArchivoContenedor"
            );


        const archivo =
            document.getElementById(
                "modalArchivo"
            );


        if (!archivoContenedor) {
            return;
        }


        const urlArchivo =
            obtenerUrlArchivo(
                ticket
            );


        /* =================================================
           BUSCAR / CREAR IMAGEN
        ================================================= */

        let imagen =
            document.getElementById(
                "modalArchivoImagen"
            );


        if (!imagen) {

            imagen =
                document.createElement(
                    "img"
                );


            imagen.id =
                "modalArchivoImagen";


            imagen.alt =
                "Imagen adjunta del ticket";


            imagen.style.display =
                "none";


            imagen.style.width =
                "100%";


            imagen.style.maxWidth =
                "700px";


            imagen.style.maxHeight =
                "500px";


            imagen.style.objectFit =
                "contain";


            imagen.style.borderRadius =
                "12px";


            imagen.style.margin =
                "15px auto";


            imagen.style.display =
                "none";


            archivoContenedor.appendChild(
                imagen
            );

        }


        /* =================================================
           NO HAY ARCHIVO
        ================================================= */

        if (!urlArchivo) {

            archivoContenedor.style.display =
                "none";


            if (archivo) {

                archivo.style.display =
                    "none";


                archivo.removeAttribute(
                    "href"
                );

            }


            imagen.style.display =
                "none";


            imagen.removeAttribute(
                "src"
            );


            return;

        }


        /* =================================================
           COMPROBAR SI ES IMAGEN
        ================================================= */

        const esImagen =
            esArchivoImagen(
                urlArchivo
            );


        /* =================================================
           SI ES IMAGEN
        ================================================= */

        if (esImagen) {

            if (archivo) {

                archivo.style.display =
                    "none";


                archivo.removeAttribute(
                    "href"
                );

            }


            imagen.src =
                urlArchivo;


            imagen.alt =
                "Imagen adjunta del ticket";


            imagen.style.display =
                "block";


            archivoContenedor.style.display =
                "block";


            return;

        }


        /* =================================================
           SI NO ES IMAGEN
        ================================================= */

        imagen.style.display =
            "none";


        imagen.removeAttribute(
            "src"
        );


        if (archivo) {

            archivo.href =
                urlArchivo;


            archivo.target =
                "_blank";


            archivo.rel =
                "noopener noreferrer";


            archivo.style.display =
                "inline-flex";

        }


        archivoContenedor.style.display =
            "block";

    }


    /* =====================================================
       COMPROBAR SI EL ARCHIVO ES UNA IMAGEN
    ===================================================== */

    function esArchivoImagen(
        url
    ) {

        if (!url) {
            return false;
        }


        const texto =
            String(
                url
            )
                .toLowerCase()
                .trim();


        /* =================================================
           IMÁGENES EN BASE64
        ================================================= */

        if (
            texto.startsWith(
                "data:image/"
            )
        ) {

            return true;

        }


        /* =================================================
           QUITAR QUERY STRING Y HASH
        ================================================= */

        const ruta =
            texto
                .split("?")[0]
                .split("#")[0];


        /* =================================================
           EXTENSIONES DE IMAGEN
        ================================================= */

        return (
            ruta.endsWith(".jpg") ||
            ruta.endsWith(".jpeg") ||
            ruta.endsWith(".png") ||
            ruta.endsWith(".gif") ||
            ruta.endsWith(".webp") ||
            ruta.endsWith(".bmp") ||
            ruta.endsWith(".svg") ||
            ruta.endsWith(".avif")
        );

    }


    /* =====================================================
       OBTENER URL DEL ARCHIVO

       Soporta:

       archivo_url
       archivo
       url_archivo
       adjunto
       adjunto_url
       archivo_adjunto
       documento
       documento_url
    ===================================================== */

    function obtenerUrlArchivo(
        ticket
    ) {

        if (!ticket) {
            return "";
        }


        const posiblesCampos = [

            "archivo_url",

            "archivo",

            "url_archivo",

            "adjunto",

            "adjunto_url",

            "archivo_adjunto",

            "documento",

            "documento_url"

        ];


        for (
            const campo of posiblesCampos
        ) {

            const valor =
                ticket[campo];


            if (
                valor === null ||
                valor === undefined ||
                valor === ""
            ) {

                continue;

            }


            /* =============================================
               SI ES STRING
            ============================================= */

            if (
                typeof valor === "string"
            ) {

                const texto =
                    valor.trim();


                if (!texto) {
                    continue;
                }


                /* =========================================
                   PUEDE SER JSON
                ========================================= */

                if (
                    (
                        texto.startsWith("{") &&
                        texto.endsWith("}")
                    ) ||
                    (
                        texto.startsWith("[") &&
                        texto.endsWith("]")
                    )
                ) {

                    try {

                        const convertido =
                            JSON.parse(
                                texto
                            );


                        const urlJSON =
                            extraerUrlDeValor(
                                convertido
                            );


                        if (urlJSON) {

                            return urlJSON;

                        }

                    } catch (error) {

                        /* No es JSON válido.
                           Se continúa como texto normal. */

                    }

                }


                return texto;

            }


            /* =============================================
               SI ES OBJETO / ARRAY
            ============================================= */

            if (
                typeof valor === "object"
            ) {

                const urlObjeto =
                    extraerUrlDeValor(
                        valor
                    );


                if (urlObjeto) {

                    return urlObjeto;

                }

            }

        }


        return "";

    }


    /* =====================================================
       EXTRAER URL DE OBJETOS DE ARCHIVO
    ===================================================== */

    function extraerUrlDeValor(
        valor
    ) {

        if (!valor) {
            return "";
        }


        if (
            typeof valor === "string"
        ) {

            return valor.trim();

        }


        if (
            Array.isArray(valor)
        ) {

            for (
                const elemento of valor
            ) {

                const url =
                    extraerUrlDeValor(
                        elemento
                    );


                if (url) {
                    return url;
                }

            }


            return "";

        }


        if (
            typeof valor === "object"
        ) {

            const camposUrl = [

                "url",

                "href",

                "publicUrl",

                "public_url",

                "archivo_url",

                "url_archivo",

                "downloadURL",

                "downloadUrl",

                "download_url",

                "path"

            ];


            for (
                const campo of camposUrl
            ) {

                if (
                    valor[campo] !== undefined &&
                    valor[campo] !== null
                ) {

                    const url =
                        String(
                            valor[campo]
                        ).trim();


                    if (url) {

                        /*
                         * Si ya es una URL completa,
                         * se devuelve directamente.
                         */

                        if (
                            url.startsWith(
                                "http://"
                            ) ||
                            url.startsWith(
                                "https://"
                            ) ||
                            url.startsWith(
                                "blob:"
                            ) ||
                            url.startsWith(
                                "data:"
                            )
                        ) {

                            return url;

                        }


                        /*
                         * Si es una ruta de Storage,
                         * intentamos convertirla a URL pública.
                         */

                        if (
                            url.includes("/")
                        ) {

                            const {
                                data
                            } =
                                supabaseClient
                                    .storage
                                    .from("archivos")
                                    .getPublicUrl(
                                        url
                                    );


                            if (
                                data &&
                                data.publicUrl
                            ) {

                                return data.publicUrl;

                            }

                        }

                    }

                }

            }

        }


        return "";

    }


    /* =====================================================
       CERRAR MODAL
    ===================================================== */

    function cerrarModal() {

        if (!modalTicket) {
            return;
        }


        modalTicket.classList.remove(
            "mostrar"
        );


        modalTicket.classList.remove(
            "modal-abierto"
        );


        document.body.classList.remove(
            "modal-abierto"
        );


        ticketSeleccionado =
            null;

    }


    /* =====================================================
       GUARDAR CAMBIOS
    ===================================================== */

    async function guardarCambiosTicket() {

        if (!ticketSeleccionado) {

            return;

        }


        const nuevoEstado =
            estadoTicket
                ? estadoTicket.value
                : "Pendiente";


        const nuevaRespuesta =
            respuestaTicket
                ? respuestaTicket.value.trim()
                : "";


        if (btnGuardarTicket) {

            btnGuardarTicket.disabled =
                true;


            btnGuardarTicket.dataset
                .textoOriginal =
                btnGuardarTicket.innerHTML;


            btnGuardarTicket.innerHTML = `

        <i class="ri-loader-4-line ri-spin"></i>

        Guardando...

`;

        }


        try {

            const {
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
                            nuevaRespuesta
                    }
                );


            if (error) {

                console.error(
                    "ERROR ACTUALIZANDO TICKET:",
                    error
                );


                alert(
                    "No fue posible guardar los cambios."
                );


                return;

            }


            /* =================================================
               ACTUALIZAR TICKET LOCAL
            ================================================= */

            const ticketActual =
                tickets.find(
                    ticket =>
                        String(ticket.id) ===
                        String(ticketSeleccionado.id)
                );


            if (ticketActual) {

                ticketActual.estado =
                    nuevoEstado;


                ticketActual.respuesta =
                    nuevaRespuesta;


                ticketActual.actualizado_en =
                    new Date().toISOString();

            }


            cerrarModal();


            aplicarBusqueda();


            /* =================================================
               IR A LA PÁGINA SEGÚN EL ESTADO
            ================================================= */

            redirigirSegunEstado(
                nuevoEstado
            );


        } catch (error) {

            console.error(
                "ERROR GUARDANDO CAMBIOS:",
                error
            );


            alert(
                "Ocurrió un error al guardar el ticket."
            );


        } finally {

            if (btnGuardarTicket) {

                btnGuardarTicket.disabled =
                    false;


                btnGuardarTicket.innerHTML =
                    btnGuardarTicket.dataset
                        .textoOriginal ||
                    `
<i class="ri-save-line"></i>
Guardar cambios
`;

            }

        }

    }


    /* =====================================================
       REDIRECCIÓN SEGÚN ESTADO
    ===================================================== */

    function redirigirSegunEstado(
        estado
    ) {

        const estadoNormalizado =
            normalizar(
                estado
            );


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

    }


    /* =====================================================
       REALTIME
    ===================================================== */

    function configurarRealtime() {

        try {

            canalRealtime =
                supabaseClient
                    .channel(
                        "tickets-total"
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "tickets_soporte"
                        },
                        async payload => {

                            console.log(
                                "CAMBIO REALTIME:",
                                payload
                            );


                            await cargarTodosLosTickets();


                            if (
                                sonidoActivado &&
                                payload.eventType ===
                                "INSERT"
                            ) {

                                reproducirSonido();

                            }

                        }
                    )
                    .subscribe(
                        status => {

                            console.log(
                                "REALTIME:",
                                status
                            );


                            if (
                                status ===
                                "SUBSCRIBED"
                            ) {

                                actualizarIndicadorConexion(
                                    true
                                );

                            }


                            if (
                                status ===
                                "CHANNEL_ERROR" ||
                                status ===
                                "TIMED_OUT"
                            ) {

                                actualizarIndicadorConexion(
                                    false
                                );

                            }

                        }
                    );


        } catch (error) {

            console.error(
                "ERROR CONFIGURANDO REALTIME:",
                error
            );

        }

    }


    /* =====================================================
       INDICADOR DE CONEXIÓN
    ===================================================== */

    function actualizarIndicadorConexion(
        conectado
    ) {

        if (!indicadorConexion) {
            return;
        }


        if (conectado) {

            indicadorConexion.classList.add(
                "conectado"
            );


            indicadorConexion.classList.remove(
                "desconectado"
            );


            indicadorConexion.innerHTML = `

<i class="ri-checkbox-circle-fill"></i>

Conectado

`;

        } else {

            indicadorConexion.classList.add(
                "desconectado"
            );


            indicadorConexion.classList.remove(
                "conectado"
            );


            indicadorConexion.innerHTML = `

<i class="ri-wifi-off-line"></i>

Sin conexión

`;

        }

    }


    /* =====================================================
       SONIDO
    ===================================================== */

    function activarDesactivarSonido() {

        sonidoActivado =
            !sonidoActivado;


        if (!btnSonido) {
            return;
        }


        if (sonidoActivado) {

            btnSonido.innerHTML = `

<i class="ri-volume-up-line"></i>

Sonido activado

`;


            btnSonido.classList.add(
                "activo"
            );


            reproducirSonido();

        } else {

            btnSonido.innerHTML = `

<i class="ri-volume-mute-line"></i>

Activar sonido

`;


            btnSonido.classList.remove(
                "activo"
            );

        }

    }


    /* =====================================================
       REPRODUCIR SONIDO
    ===================================================== */

    function reproducirSonido() {

        try {

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;


            if (!AudioContext) {
                return;
            }


            const contexto =
                new AudioContext();


            const oscilador =
                contexto.createOscillator();


            const ganancia =
                contexto.createGain();


            oscilador.type =
                "sine";


            oscilador.frequency.value =
                700;


            ganancia.gain.value =
                0.08;


            oscilador.connect(
                ganancia
            );


            ganancia.connect(
                contexto.destination
            );


            oscilador.start();


            oscilador.stop(
                contexto.currentTime +
                0.15
            );


        } catch (error) {

            console.warn(
                "NO SE PUDO REPRODUCIR EL SONIDO:",
                error
            );

        }

    }


    /* =====================================================
       MOSTRAR CARGANDO
    ===================================================== */

    function mostrarCargando() {

        if (!listaTickets) {
            return;
        }


        listaTickets.innerHTML = `

<div class="estado-cargando">

    <i class="ri-loader-4-line ri-spin"></i>

    <span>
        Cargando tickets...
    </span>

</div>

`;


        if (sinTickets) {

            sinTickets.style.display =
                "none";

        }

    }


    /* =====================================================
       MOSTRAR ERROR
    ===================================================== */

    function mostrarError(
        mensaje
    ) {

        if (!listaTickets) {
            return;
        }


        listaTickets.innerHTML = `

<div class="estado-error">

    <i class="ri-error-warning-line"></i>

    <strong>
        ${escapeHTML(mensaje)}
    </strong>


    <button
        type="button"
        id="btnReintentar"
    >

        <i class="ri-refresh-line"></i>

        Intentar nuevamente

    </button>

</div>

`;


        const btnReintentar =
            document.getElementById(
                "btnReintentar"
            );


        if (btnReintentar) {

            btnReintentar.addEventListener(
                "click",
                cargarTodosLosTickets
            );

        }

    }


    /* =====================================================
       ESTADO
    ===================================================== */

    function obtenerValorEstado(
        estado
    ) {

        const valor =
            normalizar(
                estado
            );


        if (
            valor === "pendiente"
        ) {

            return "Pendiente";

        }


        if (
            valor === "en revision"
        ) {

            return "En revisión";

        }


        if (
            valor === "resuelto"
        ) {

            return "Resuelto";

        }


        if (
            valor === "cerrado"
        ) {

            return "Cerrado";

        }


        return "Pendiente";

    }


    /* =====================================================
       CLASE DE ESTADO
    ===================================================== */

    function obtenerClaseEstado(
        estado
    ) {

        const valor =
            normalizar(
                estado
            );


        if (
            valor === "pendiente"
        ) {

            return "pendiente";

        }


        if (
            valor === "en revision"
        ) {

            return "revision";

        }


        if (
            valor === "resuelto"
        ) {

            return "resuelto";

        }


        if (
            valor === "cerrado"
        ) {

            return "cerrado";

        }


        return "";

    }


    /* =====================================================
       CLASE DE PRIORIDAD
    ===================================================== */

    function obtenerClasePrioridad(
        prioridad
    ) {

        const valor =
            normalizar(
                prioridad
            );


        if (
            valor === "urgente" ||
            valor === "critica"
        ) {

            return "prioridad urgente";

        }


        if (
            valor === "alta"
        ) {

            return "prioridad alta";

        }


        if (
            valor === "media" ||
            valor === "baja"
        ) {

            return "prioridad normal";

        }


        return "prioridad normal";

    }


    /* =====================================================
       NORMALIZAR
    ===================================================== */

    function normalizar(
        valor
    ) {

        return String(
            valor ?? ""
        )
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();

    }


    /* =====================================================
       ESCAPAR HTML
    ===================================================== */

    function escapeHTML(
        valor
    ) {

        return String(
            valor ?? ""
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


    /* =====================================================
       PONER TEXTO
    ===================================================== */

    function ponerTexto(
        id,
        texto
    ) {

        const elemento =
            document.getElementById(
                id
            );


        if (!elemento) {
            return;
        }


        elemento.textContent =
            texto ?? "";

    }


    /* =====================================================
       FORMATEAR FECHA
    ===================================================== */

    function formatearFecha(
        fecha
    ) {

        if (!fecha) {

            return "Fecha no disponible";

        }


        const fechaObjeto =
            new Date(
                fecha
            );


        if (
            Number.isNaN(
                fechaObjeto.getTime()
            )
        ) {

            return "Fecha no disponible";

        }


        return fechaObjeto.toLocaleString(
            "es-GT",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    /* =====================================================
       LIMPIEZA REALTIME
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            if (canalRealtime) {

                supabaseClient.removeChannel(
                    canalRealtime
                );

            }

        }
    );


});