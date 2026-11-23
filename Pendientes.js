/* =========================================================
   MENSAJERÍA EXPRESS
   PENDIENTES.JS

   SISTEMA:
   - Supabase Auth
   - public.usuarios
   - tickets_soporte
   - RPC obtener_tickets_soporte
   - RPC actualizar_ticket_soporte

   PÁGINA:
   - Tickets pendientes
   - Modal de ticket
   - Búsqueda
   - Actualización manual
   - Realtime
   - Sonido de nuevos tickets

   IMPORTANTE:
   - Este archivo está adaptado al HTML de Pendientes.html
   - Las tarjetas utilizan las clases de pendientes.css
========================================================= */


/* =========================================================
   CONFIGURACIÓN SUPABASE
========================================================= */

const SUPABASE_URL = "https://kayzwwgmebtsaiovkeos.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_yj-QjGhy6RQNUzoxg3HQeg_hkZHuSyL";

const AUTH_STORAGE_KEY =
    "mensajeria-intranet-auth";


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            storageKey: AUTH_STORAGE_KEY,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);


/* =========================================================
   VARIABLES GLOBALES
========================================================= */

let usuarioActual = null;

let tickets = [];

let ticketSeleccionado = null;

let canalRealtime = null;

let sonidoActivo = false;

let cargandoTickets = false;


/* =========================================================
   ELEMENTOS DEL DOM
========================================================= */

let nombreUsuario;
let listaTickets;
let sinTickets;
let textoCantidad;
let buscarTicket;
let btnActualizar;
let btnSonido;
let indicadorConexion;

let modalTicket;
let cerrarModal;
let btnCerrarTicket;
let btnGuardarTicket;

let estadoTicket;
let respuestaTicket;


/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    inicializarElementos();

    iniciarPendientes();

});


/* =========================================================
   OBTENER ELEMENTOS DEL DOM
========================================================= */

function inicializarElementos() {

    nombreUsuario =
        document.getElementById("nombreUsuario");

    listaTickets =
        document.getElementById("listaTickets");

    sinTickets =
        document.getElementById("sinTickets");

    textoCantidad =
        document.getElementById("textoCantidad");

    buscarTicket =
        document.getElementById("buscarTicket");

    btnActualizar =
        document.getElementById("btnActualizar");

    btnSonido =
        document.getElementById("btnSonido");

    indicadorConexion =
        document.getElementById("indicadorConexion");


    modalTicket =
        document.getElementById("modalTicket");

    cerrarModal =
        document.getElementById("cerrarModal");

    btnCerrarTicket =
        document.getElementById("btnCerrarTicket");

    btnGuardarTicket =
        document.getElementById("btnGuardarTicket");


    estadoTicket =
        document.getElementById("estadoTicket");

    respuestaTicket =
        document.getElementById("respuestaTicket");


    /* =====================================================
       EVENTOS
    ===================================================== */

    if (buscarTicket) {

        buscarTicket.addEventListener(
            "input",
            aplicarBusqueda
        );

    }


    if (btnActualizar) {

        btnActualizar.addEventListener(
            "click",
            cargarTickets
        );

    }


    if (btnSonido) {

        btnSonido.addEventListener(
            "click",
            activarSonido
        );

    }


    if (cerrarModal) {

        cerrarModal.addEventListener(
            "click",
            cerrarModalTicket
        );

    }


    if (btnCerrarTicket) {

        btnCerrarTicket.addEventListener(
            "click",
            cerrarModalTicket
        );

    }


    if (btnGuardarTicket) {

        btnGuardarTicket.addEventListener(
            "click",
            guardarCambiosTicket
        );

    }


    /* =====================================================
       CERRAR MODAL HACIENDO CLICK EN EL FONDO
    ===================================================== */

    if (modalTicket) {

        modalTicket.addEventListener(
            "click",
            (event) => {

                if (event.target === modalTicket) {

                    cerrarModalTicket();

                }

            }
        );

    }


    /* =====================================================
       CERRAR MODAL CON ESC
    ===================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modalTicket &&
                (
                    modalTicket.classList.contains("mostrar") ||
                    modalTicket.classList.contains("modal-abierto")
                )
            ) {

                cerrarModalTicket();

            }

        }
    );

}


/* =========================================================
   INICIAR PÁGINA
========================================================= */

async function iniciarPendientes() {

    try {

        mostrarEstadoCarga();

        const {
            data: {
                session
            },
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Error obteniendo sesión:",
                error
            );

            redirigirLogin();

            return;

        }


        if (!session) {

            redirigirLogin();

            return;

        }


        await cargarUsuario(session.user);


        if (!usuarioActual) {

            redirigirLogin();

            return;

        }


        if (usuarioActual.activo === false) {

            await supabaseClient.auth.signOut();

            redirigirLogin();

            return;

        }


        guardarUsuarioSession();


        actualizarNombreUsuario();


        await cargarTickets();


        iniciarRealtime();


    } catch (error) {

        console.error(
            "Error iniciando Pendientes:",
            error
        );

        mostrarError(
            "No fue posible cargar los tickets pendientes."
        );

    }

}


/* =========================================================
   CARGAR USUARIO ACTUAL
========================================================= */

async function cargarUsuario(userAuth) {

    if (!userAuth || !userAuth.id) {

        usuarioActual = null;

        return;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("usuarios")
        .select("id,nombre,activo")
        .eq("id", userAuth.id)
        .maybeSingle();


    if (error) {

        console.error(
            "Error cargando usuario:",
            error
        );

        usuarioActual = null;

        return;

    }


    if (!data) {

        usuarioActual = null;

        return;

    }


    usuarioActual = data;

}


/* =========================================================
   GUARDAR USUARIO EN SESSION STORAGE
========================================================= */

function guardarUsuarioSession() {

    if (!usuarioActual) {
        return;
    }


    try {

        sessionStorage.setItem(
            "usuarioSoporte",
            JSON.stringify(usuarioActual)
        );

    } catch (error) {

        console.warn(
            "No fue posible guardar usuarioSoporte:",
            error
        );

    }

}


/* =========================================================
   MOSTRAR NOMBRE DEL USUARIO
========================================================= */

function actualizarNombreUsuario() {

    if (!nombreUsuario) {
        return;
    }


    const nombre =
        usuarioActual?.nombre ||
        "Usuario";


    nombreUsuario.textContent =
        nombre;

}


/* =========================================================
   CARGAR TICKETS
========================================================= */

async function cargarTickets() {

    if (cargandoTickets) {
        return;
    }


    cargandoTickets = true;


    try {

        if (btnActualizar) {

            btnActualizar.disabled = true;

            btnActualizar.classList.add(
                "cargando"
            );

        }


        const {
            data,
            error
        } = await supabaseClient.rpc(
            "obtener_tickets_soporte"
        );


        if (error) {

            console.error(
                "Error obteniendo tickets:",
                error
            );

            mostrarError(
                "No fue posible obtener los tickets."
            );

            return;

        }


        const todosLosTickets =
            Array.isArray(data)
                ? data
                : [];


        tickets =
            todosLosTickets.filter(
                ticket => {

                    const estado =
                        normalizar(
                            ticket?.estado
                        );

                    return estado === "pendiente";

                }
            );


        aplicarBusqueda();


        actualizarConexion(
            true
        );


    } catch (error) {

        console.error(
            "Error cargando tickets:",
            error
        );

        mostrarError(
            "Ocurrió un error al cargar los tickets."
        );

        actualizarConexion(
            false
        );


    } finally {

        cargandoTickets = false;


        if (btnActualizar) {

            btnActualizar.disabled = false;

            btnActualizar.classList.remove(
                "cargando"
            );

        }

    }

}


/* =========================================================
   MOSTRAR ESTADO DE CARGA
========================================================= */

function mostrarEstadoCarga() {

    if (!listaTickets) {
        return;
    }


    listaTickets.innerHTML = `
        <div class="estado-cargando">
            <i class="ri-loader-4-line"></i>
            <span>Cargando tickets...</span>
        </div>
    `;


    if (sinTickets) {

        sinTickets.style.display =
            "none";

    }

}


/* =========================================================
   MOSTRAR ERROR
========================================================= */

function mostrarError(mensaje) {

    if (!listaTickets) {
        return;
    }


    listaTickets.innerHTML = `
        <div class="estado-error">
            <i class="ri-error-warning-line"></i>
            <span>${escapeHTML(mensaje)}</span>
        </div>
    `;


    if (sinTickets) {

        sinTickets.style.display =
            "none";

    }


    if (textoCantidad) {

        textoCantidad.textContent =
            "Error";

    }

}


/* =========================================================
   APLICAR BÚSQUEDA
========================================================= */

function aplicarBusqueda() {

    if (!listaTickets) {
        return;
    }


    const texto =
        normalizar(
            buscarTicket?.value || ""
        );


    let resultados = tickets;


    if (texto) {

        resultados =
            tickets.filter(
                ticket =>
                    ticketCoincide(
                        ticket,
                        texto
                    )
            );

    }


    renderizarTickets(
        resultados
    );

}


/* =========================================================
   COMPROBAR SI UN TICKET COINCIDE
========================================================= */

function ticketCoincide(ticket, texto) {

    const campos = [

        ticket?.id,

        ticket?.nombre,

        ticket?.apellido,

        ticket?.correo,

        ticket?.email,

        ticket?.telefono,

        ticket?.phone,

        ticket?.categoria,

        ticket?.prioridad,

        ticket?.asunto,

        ticket?.descripcion

    ];


    return campos.some(
        campo =>
            normalizar(campo).includes(
                texto
            )
    );

}


/* =========================================================
   RENDERIZAR TICKETS
========================================================= */

function renderizarTickets(
    lista
) {

    if (!listaTickets) {
        return;
    }


    listaTickets.innerHTML = "";


    if (!Array.isArray(lista) || lista.length === 0) {

        if (sinTickets) {

            sinTickets.style.display =
                "block";

        }


        actualizarCantidad(
            0
        );


        return;

    }


    if (sinTickets) {

        sinTickets.style.display =
            "none";

    }


    actualizarCantidad(
        lista.length
    );


    const fragment =
        document.createDocumentFragment();


    lista.forEach(
        ticket => {

            const tarjeta =
                crearTarjetaTicket(
                    ticket
                );


            fragment.appendChild(
                tarjeta
            );

        }
    );


    listaTickets.appendChild(
        fragment
    );

}


/* =========================================================
   ACTUALIZAR CANTIDAD
========================================================= */

function actualizarCantidad(
    cantidad
) {

    if (!textoCantidad) {
        return;
    }


    textoCantidad.textContent =
        cantidad === 1
            ? "1 ticket"
            : `${cantidad} tickets`;

}


/* =========================================================
   CREAR TARJETA
========================================================= */

function crearTarjetaTicket(
    ticket
) {

    const tarjeta =
        document.createElement(
            "article"
        );


    tarjeta.className =
        "ticket-card";


    const nombre =
        obtenerNombreCompleto(
            ticket
        );


    const correo =
        obtenerCorreo(
            ticket
        );


    const telefono =
        obtenerTelefono(
            ticket
        );


    const asunto =
        ticket?.asunto ||
        "Sin asunto";


    const descripcion =
        ticket?.descripcion ||
        "Sin descripción";


    const categoria =
        ticket?.categoria ||
        "Sin categoría";


    const prioridad =
        ticket?.prioridad ||
        "Normal";


    const fecha =
        formatearFecha(
            ticket?.creado_en ||
            ticket?.created_at ||
            ticket?.fecha ||
            ticket?.fecha_creacion
        );


    const id =
        ticket?.id ??
        "0";


    const clasePrioridad =
        obtenerClasePrioridad(
            prioridad
        );


    const informacionUsuario =
        correo
            ? `${correo}${telefono ? " · " + telefono : ""}`
            : (
                telefono ||
                "Sin información de contacto"
            );


    tarjeta.innerHTML = `

        <div class="ticket-card-cabecera">

            <div>

                <span class="ticket-id">
                    Ticket #${escapeHTML(id)}
                </span>

                <h4>
                    ${escapeHTML(asunto)}
                </h4>

            </div>


            <span class="badge-estado pendiente">
                Pendiente
            </span>

        </div>


        <div class="ticket-card-usuario">

            <div class="avatar">
                <i class="ri-user-line"></i>
            </div>


            <div>

                <strong>
                    ${escapeHTML(nombre)}
                </strong>

                <span>
                    ${escapeHTML(informacionUsuario)}
                </span>

            </div>

        </div>


        <div class="ticket-card-descripcion">
            ${escapeHTML(descripcion)}
        </div>


        <div class="ticket-card-pie">

            <div>

                <span class="prioridad ${clasePrioridad}">
                    ${escapeHTML(
        formatearPrioridad(
            prioridad
        )
    )}
                </span>

                <span>
                    ${escapeHTML(categoria)}
                </span>

            </div>


            <span>
                ${escapeHTML(fecha)}
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
   OBTENER NOMBRE COMPLETO
========================================================= */

function obtenerNombreCompleto(
    ticket
) {

    const nombre =
        ticket?.nombre ||
        ticket?.nombres ||
        "";


    const apellido =
        ticket?.apellido ||
        ticket?.apellidos ||
        "";


    const completo =
        `${nombre} ${apellido}`.trim();


    if (completo) {
        return completo;
    }


    return (
        ticket?.usuario ||
        ticket?.nombre_usuario ||
        ticket?.correo ||
        "Usuario"
    );

}


/* =========================================================
   OBTENER CORREO
========================================================= */

function obtenerCorreo(
    ticket
) {

    return (
        ticket?.correo ||
        ticket?.email ||
        ticket?.correo_usuario ||
        ""
    );

}


/* =========================================================
   OBTENER TELÉFONO
========================================================= */

function obtenerTelefono(
    ticket
) {

    return (
        ticket?.telefono ||
        ticket?.phone ||
        ticket?.celular ||
        ""
    );

}


/* =========================================================
   PRIORIDAD
========================================================= */

function obtenerClasePrioridad(
    prioridad
) {

    const valor =
        normalizar(
            prioridad
        );


    if (
        valor === "urgente" ||
        valor === "critica" ||
        valor === "crítica"
    ) {

        return "urgente";

    }


    if (
        valor === "alta" ||
        valor === "alto"
    ) {

        return "alta";

    }


    /*
       El CSS de Pendientes solamente contempla:
       - normal
       - alta
       - urgente

       Media y baja se muestran visualmente
       como prioridad normal.
    */

    return "normal";

}


/* =========================================================
   TEXTO DE PRIORIDAD
========================================================= */

function formatearPrioridad(
    prioridad
) {

    const valor =
        normalizar(
            prioridad
        );


    if (
        valor === "urgente" ||
        valor === "critica" ||
        valor === "crítica"
    ) {

        return "Urgente";

    }


    if (
        valor === "alta" ||
        valor === "alto"
    ) {

        return "Alta";

    }


    return "Normal";

}


/* =========================================================
   ABRIR TICKET
========================================================= */

function abrirTicket(
    ticket
) {

    if (!ticket || !modalTicket) {
        return;
    }


    ticketSeleccionado =
        ticket;


    const id =
        ticket?.id ??
        "0";


    const asunto =
        ticket?.asunto ||
        "Sin asunto";


    const nombre =
        obtenerNombreCompleto(
            ticket
        );


    const correo =
        obtenerCorreo(
            ticket
        );


    const telefono =
        obtenerTelefono(
            ticket
        );


    const categoria =
        ticket?.categoria ||
        "Sin categoría";


    const prioridad =
        ticket?.prioridad ||
        "Normal";


    const estado =
        ticket?.estado ||
        "Pendiente";


    const fecha =
        formatearFechaCompleta(
            ticket?.creado_en ||
            ticket?.created_at ||
            ticket?.fecha ||
            ticket?.fecha_creacion
        );


    const descripcion =
        ticket?.descripcion ||
        "Sin descripción";


    ponerTexto(
        "modalNumero",
        `Ticket #${id}`
    );


    ponerTexto(
        "modalAsunto",
        asunto
    );


    ponerTexto(
        "modalNombre",
        nombre
    );


    ponerTexto(
        "modalCorreo",
        correo || "Sin correo"
    );


    ponerTexto(
        "modalTelefono",
        telefono || "Sin teléfono"
    );


    ponerTexto(
        "modalCategoria",
        categoria
    );


    ponerTexto(
        "modalPrioridad",
        formatearPrioridad(
            prioridad
        )
    );


    ponerTexto(
        "modalEstado",
        formatearEstado(
            estado
        )
    );


    ponerTexto(
        "modalFecha",
        fecha
    );


    ponerTexto(
        "modalDescripcion",
        descripcion
    );


    cargarArchivo(
        ticket
    );


    if (estadoTicket) {

        const estadoNormalizado =
            normalizar(
                estado
            );


        if (
            estadoNormalizado === "en revision" ||
            estadoNormalizado === "en revisión"
        ) {

            estadoTicket.value =
                "En revisión";

        } else if (
            estadoNormalizado === "resuelto"
        ) {

            estadoTicket.value =
                "Resuelto";

        } else if (
            estadoNormalizado === "cerrado"
        ) {

            estadoTicket.value =
                "Cerrado";

        } else {

            estadoTicket.value =
                "Pendiente";

        }

    }


    if (respuestaTicket) {

        respuestaTicket.value =
            ticket?.respuesta ||
            ticket?.respuesta_soporte ||
            ticket?.respuesta_backoffice ||
            "";

    }


    modalTicket.classList.add(
        "mostrar"
    );


    modalTicket.classList.add(
        "modal-abierto"
    );


    document.body.classList.add(
        "modal-abierto"
    );


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   CARGAR ARCHIVO ADJUNTO
   LAS IMÁGENES SE MUESTRAN DIRECTAMENTE
========================================================= */

function cargarArchivo(
    ticket
) {

    const contenedor =
        document.getElementById(
            "modalArchivoContenedor"
        );


    const enlace =
        document.getElementById(
            "modalArchivo"
        );


    if (!contenedor || !enlace) {
        return;
    }


    const archivo =
        obtenerArchivo(
            ticket
        );


    /* =====================================================
       CREAR IMAGEN AUTOMÁTICAMENTE
       NO NECESITAMOS MODIFICAR EL HTML
    ===================================================== */

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


        imagen.style.height =
            "auto";


        imagen.style.objectFit =
            "contain";


        imagen.style.margin =
            "10px auto";


        imagen.style.borderRadius =
            "12px";


        imagen.style.cursor =
            "pointer";


        imagen.style.background =
            "#f5f5f5";


        imagen.style.padding =
            "5px";


        contenedor.appendChild(
            imagen
        );

    }


    /* =====================================================
       NO HAY ARCHIVO
    ===================================================== */

    if (!archivo) {

        contenedor.style.display =
            "none";


        enlace.removeAttribute(
            "href"
        );


        enlace.style.display =
            "";


        imagen.style.display =
            "none";


        imagen.removeAttribute(
            "src"
        );


        return;

    }


    /* =====================================================
       CONFIGURAR ENLACE
    ===================================================== */

    enlace.href =
        archivo;


    enlace.target =
        "_blank";


    enlace.rel =
        "noopener noreferrer";


    /* =====================================================
       LIMPIAR EVENTOS ANTERIORES
    ===================================================== */

    imagen.onload = null;

    imagen.onerror = null;


    /* =====================================================
       INTENTAR CARGAR EL ARCHIVO COMO IMAGEN
       
       NO DEPENDE DE .JPG / .PNG EN LA URL.
       
       Si Supabase devuelve una URL larga,
       el navegador determinará si realmente
       es una imagen.
    ===================================================== */

    imagen.onload = () => {

        /* ================================================
           LA IMAGEN EXISTE Y CARGÓ CORRECTAMENTE
        ================================================ */

        imagen.style.display =
            "block";


        enlace.style.display =
            "none";


        contenedor.style.display =
            "block";

    };


    imagen.onerror = () => {

        /* ================================================
           NO ES UNA IMAGEN
           
           REGRESAMOS AL COMPORTAMIENTO ORIGINAL.
        ================================================ */

        imagen.style.display =
            "none";


        imagen.removeAttribute(
            "src"
        );


        enlace.style.display =
            "";


        contenedor.style.display =
            "block";

    };


    /* =====================================================
       CARGAR ARCHIVO COMO IMAGEN
    ===================================================== */

    imagen.src =
        archivo;


    /*
       Mientras se comprueba si es una imagen,
       ocultamos el enlace.
    */

    imagen.style.display =
        "none";


    enlace.style.display =
        "none";


    contenedor.style.display =
        "block";

}


/* =========================================================
   DETECTAR SI EL ARCHIVO ES UNA IMAGEN
========================================================= */

function esImagenAdjunta(
    archivo
) {

    if (!archivo) {
        return false;
    }


    const valor =
        String(archivo)
            .toLowerCase()
            .split("?")[0]
            .split("#")[0];


    /* =====================================================
       DATA URI
    ===================================================== */

    if (
        valor.startsWith(
            "data:image/"
        )
    ) {

        return true;

    }


    /* =====================================================
       EXTENSIONES DE IMAGEN
    ===================================================== */

    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(
        valor
    );

}


/* =========================================================
   OBTENER ARCHIVO
========================================================= */

function obtenerArchivo(
    ticket
) {

    const posiblesCampos = [

        ticket?.archivo,

        ticket?.archivo_url,

        ticket?.url_archivo,

        ticket?.adjunto,

        ticket?.adjunto_url,

        ticket?.archivo_adjunto,

        ticket?.documento,

        ticket?.documento_url

    ];


    for (
        const archivo of posiblesCampos
    ) {

        if (
            archivo &&
            typeof archivo === "string"
        ) {

            return archivo;

        }

    }


    return "";

}


/* =========================================================
   CERRAR MODAL
========================================================= */

function cerrarModalTicket() {

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


    document.body.style.overflow =
        "";


    ticketSeleccionado =
        null;

}


/* =========================================================
   GUARDAR CAMBIOS
========================================================= */

async function guardarCambiosTicket() {

    if (!ticketSeleccionado) {

        mostrarAlerta(
            "No hay ningún ticket seleccionado."
        );

        return;

    }


    if (!estadoTicket) {
        return;
    }


    const nuevoEstado =
        estadoTicket.value;


    const respuesta =
        respuestaTicket?.value?.trim() ||
        "";


    const ticketId =
        ticketSeleccionado.id;


    if (!ticketId) {

        mostrarAlerta(
            "El ticket no tiene un ID válido."
        );

        return;

    }


    const estadoNormalizado =
        normalizar(
            nuevoEstado
        );


    if (
        ![
            "pendiente",
            "en revision",
            "en revisión",
            "resuelto",
            "cerrado"
        ].includes(
            estadoNormalizado
        )
    ) {

        mostrarAlerta(
            "El estado seleccionado no es válido."
        );

        return;

    }


    try {

        if (btnGuardarTicket) {

            btnGuardarTicket.disabled =
                true;


            btnGuardarTicket.classList.add(
                "cargando"
            );


            btnGuardarTicket.innerHTML = `
                <i class="ri-loader-4-line"></i>
                Guardando...
            `;

        }


        const {
            error
        } = await supabaseClient.rpc(
            "actualizar_ticket_soporte",
            {
                p_ticket_id:
                    ticketId,

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


            mostrarAlerta(
                "No fue posible guardar los cambios."
            );


            return;

        }


        actualizarTicketLocal(
            ticketId,
            nuevoEstado,
            respuesta
        );


        cerrarModalTicket();


        const estadoFinal =
            normalizar(
                nuevoEstado
            );


        /*
           Si continúa pendiente,
           permanece en esta página.

           Si cambia de estado,
           se envía a su página correspondiente.
        */

        if (
            estadoFinal === "en revision" ||
            estadoFinal === "en revisión"
        ) {

            window.location.href =
                "revision.html";


            return;

        }


        if (
            estadoFinal === "resuelto"
        ) {

            window.location.href =
                "resuelto.html";


            return;

        }


        if (
            estadoFinal === "cerrado"
        ) {

            window.location.href =
                "Cerrado.html";


            return;

        }


        aplicarBusqueda();


        mostrarAlerta(
            "Cambios guardados correctamente."
        );


    } catch (error) {

        console.error(
            "Error guardando ticket:",
            error
        );


        mostrarAlerta(
            "Ocurrió un error al guardar los cambios."
        );


    } finally {

        if (btnGuardarTicket) {

            btnGuardarTicket.disabled =
                false;


            btnGuardarTicket.classList.remove(
                "cargando"
            );


            btnGuardarTicket.innerHTML = `
                <i class="ri-save-line"></i>
                Guardar cambios
            `;

        }

    }

}


/* =========================================================
   ACTUALIZAR TICKET LOCALMENTE
========================================================= */

function actualizarTicketLocal(
    ticketId,
    nuevoEstado,
    respuesta
) {

    const indice =
        tickets.findIndex(
            ticket =>
                String(ticket?.id) ===
                String(ticketId)
        );


    if (indice === -1) {
        return;
    }


    tickets[indice] = {

        ...tickets[indice],

        estado:
            nuevoEstado,

        respuesta:
            respuesta

    };


    /*
       En Pendientes solamente deben
       quedar tickets cuyo estado sea Pendiente.
    */

    tickets =
        tickets.filter(
            ticket =>
                normalizar(
                    ticket?.estado
                ) === "pendiente"
        );

}


/* =========================================================
   REALTIME
========================================================= */

function iniciarRealtime() {

    if (canalRealtime) {

        try {

            supabaseClient.removeChannel(
                canalRealtime
            );

        } catch (error) {

            console.warn(
                "No fue posible eliminar canal anterior:",
                error
            );

        }

    }


    canalRealtime =
        supabaseClient
            .channel(
                "tickets-pendientes"
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tickets_soporte"
                },
                manejarCambioRealtime
            )
            .subscribe(
                estado => {

                    console.log(
                        "Estado Realtime:",
                        estado
                    );


                    if (
                        estado ===
                        "SUBSCRIBED"
                    ) {

                        actualizarConexion(
                            true
                        );

                    }


                    if (
                        estado ===
                        "CHANNEL_ERROR" ||
                        estado ===
                        "TIMED_OUT" ||
                        estado ===
                        "CLOSED"
                    ) {

                        actualizarConexion(
                            false
                        );

                    }

                }
            );

}


/* =========================================================
   MANEJAR CAMBIOS REALTIME
========================================================= */

async function manejarCambioRealtime(
    payload
) {

    console.log(
        "Cambio Realtime:",
        payload
    );


    const evento =
        payload?.eventType;


    /*
       Cuando se crea un nuevo ticket
       pendiente, se agrega y se reproduce
       sonido si está activado.
    */

    if (evento === "INSERT") {

        const nuevoTicket =
            payload?.new;


        if (
            nuevoTicket &&
            normalizar(
                nuevoTicket.estado
            ) === "pendiente"
        ) {

            const yaExiste =
                tickets.some(
                    ticket =>
                        String(ticket?.id) ===
                        String(nuevoTicket?.id)
                );


            if (!yaExiste) {

                tickets.unshift(
                    nuevoTicket
                );


                aplicarBusqueda();


                if (sonidoActivo) {

                    reproducirSonido();

                }

            }

        }


        return;

    }


    /*
       Cuando se actualiza un ticket,
       se reemplaza la versión local.
    */

    if (evento === "UPDATE") {

        const ticketActualizado =
            payload?.new;


        if (!ticketActualizado) {
            return;
        }


        const estado =
            normalizar(
                ticketActualizado.estado
            );


        const indice =
            tickets.findIndex(
                ticket =>
                    String(ticket?.id) ===
                    String(ticketActualizado?.id)
            );


        if (
            estado === "pendiente"
        ) {

            if (indice >= 0) {

                tickets[indice] =
                    ticketActualizado;

            } else {

                tickets.unshift(
                    ticketActualizado
                );


                if (sonidoActivo) {

                    reproducirSonido();

                }

            }

        } else {

            if (indice >= 0) {

                tickets.splice(
                    indice,
                    1
                );

            }

        }


        aplicarBusqueda();


        return;

    }


    /*
       Cuando se elimina un ticket.
    */

    if (evento === "DELETE") {

        const ticketEliminado =
            payload?.old;


        if (!ticketEliminado) {
            return;
        }


        tickets =
            tickets.filter(
                ticket =>
                    String(ticket?.id) !==
                    String(ticketEliminado?.id)
            );


        aplicarBusqueda();

    }

}


/* =========================================================
   ESTADO DE CONEXIÓN
========================================================= */

function actualizarConexion(
    conectado
) {

    if (!indicadorConexion) {
        return;
    }


    indicadorConexion.classList.remove(
        "conectado",
        "desconectado"
    );


    if (conectado) {

        indicadorConexion.classList.add(
            "conectado"
        );


        indicadorConexion.innerHTML = `
            <i class="ri-checkbox-circle-fill"></i>
            Conectado
        `;

    } else {

        indicadorConexion.classList.add(
            "desconectado"
        );


        indicadorConexion.innerHTML = `
            <i class="ri-close-circle-fill"></i>
            Desconectado
        `;

    }

}


/* =========================================================
   ACTIVAR SONIDO
========================================================= */

function activarSonido() {

    sonidoActivo =
        !sonidoActivo;


    if (!btnSonido) {
        return;
    }


    if (sonidoActivo) {

        btnSonido.innerHTML = `
            <i class="ri-volume-up-line"></i>
            Sonido activado
        `;


        btnSonido.classList.add(
            "activo"
        );


        /*
           Se reproduce un sonido corto
           para solicitar permiso del navegador
           para el contexto de audio.
        */

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


/* =========================================================
   REPRODUCIR SONIDO
========================================================= */

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


        oscilador.frequency.setValueAtTime(
            880,
            contexto.currentTime
        );


        oscilador.frequency.exponentialRampToValueAtTime(
            660,
            contexto.currentTime + 0.15
        );


        ganancia.gain.setValueAtTime(
            0.0001,
            contexto.currentTime
        );


        ganancia.gain.exponentialRampToValueAtTime(
            0.15,
            contexto.currentTime + 0.01
        );


        ganancia.gain.exponentialRampToValueAtTime(
            0.0001,
            contexto.currentTime + 0.2
        );


        oscilador.connect(
            ganancia
        );


        ganancia.connect(
            contexto.destination
        );


        oscilador.start();


        oscilador.stop(
            contexto.currentTime + 0.2
        );


        oscilador.addEventListener(
            "ended",
            () => {

                contexto.close().catch(
                    () => { }
                );

            }
        );


    } catch (error) {

        console.warn(
            "No fue posible reproducir sonido:",
            error
        );

    }

}


/* =========================================================
   FORMATEAR ESTADO
========================================================= */

function formatearEstado(
    estado
) {

    const valor =
        normalizar(
            estado
        );


    if (
        valor === "en revision" ||
        valor === "en revisión"
    ) {

        return "En revisión";

    }


    if (valor === "resuelto") {

        return "Resuelto";

    }


    if (valor === "cerrado") {

        return "Cerrado";

    }


    return "Pendiente";

}


/* =========================================================
   FORMATEAR FECHA CORTA
========================================================= */

function formatearFecha(
    fecha
) {

    if (!fecha) {
        return "Sin fecha";
    }


    try {

        const fechaObjeto =
            new Date(fecha);


        if (
            Number.isNaN(
                fechaObjeto.getTime()
            )
        ) {

            return "Sin fecha";

        }


        return fechaObjeto.toLocaleDateString(
            "es-HN",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    } catch (error) {

        return "Sin fecha";

    }

}


/* =========================================================
   FORMATEAR FECHA COMPLETA
========================================================= */

function formatearFechaCompleta(
    fecha
) {

    if (!fecha) {
        return "Sin fecha";
    }


    try {

        const fechaObjeto =
            new Date(fecha);


        if (
            Number.isNaN(
                fechaObjeto.getTime()
            )
        ) {

            return "Sin fecha";

        }


        return fechaObjeto.toLocaleString(
            "es-HN",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (error) {

        return "Sin fecha";

    }

}


/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

function normalizar(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return "";

    }


    return String(valor)
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim();

}


/* =========================================================
   COLOCAR TEXTO DE FORMA SEGURA
========================================================= */

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
        texto ??
        "";

}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escapeHTML(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return "";

    }


    return String(valor)
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
   MOSTRAR ALERTA
========================================================= */

function mostrarAlerta(
    mensaje
) {

    /*
       Si el proyecto tiene una función
       global de notificaciones, se puede
       utilizar automáticamente.
    */

    if (
        typeof window.mostrarNotificacion ===
        "function"
    ) {

        window.mostrarNotificacion(
            mensaje
        );


        return;

    }


    if (
        typeof window.mostrarToast ===
        "function"
    ) {

        window.mostrarToast(
            mensaje
        );


        return;

    }


    /*
       Fallback sencillo.
    */

    console.log(
        "Mensajería Express:",
        mensaje
    );

}


/* =========================================================
   REDIRECCIÓN AL LOGIN
========================================================= */

function redirigirLogin() {

    window.location.href =
        "index.html";

}


/* =========================================================
   LIMPIEZA AL SALIR
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (canalRealtime) {

            try {

                supabaseClient.removeChannel(
                    canalRealtime
                );

            } catch (error) {

                console.warn(
                    "Error cerrando Realtime:",
                    error
                );

            }

        }

    }
);


/* =========================================================
   DETECTAR CAMBIOS DE SESIÓN
========================================================= */

supabaseClient.auth.onAuthStateChange(
    async (
        evento,
        session
    ) => {

        console.log(
            "Cambio de autenticación:",
            evento
        );


        if (
            evento === "SIGNED_OUT"
        ) {

            window.location.href =
                "index.html";

            return;

        }


        if (
            evento === "TOKEN_REFRESHED" &&
            !session
        ) {

            window.location.href =
                "index.html";

        }

    }
);


/* =========================================================
   EXPORTAR FUNCIONES ÚTILES
   PARA HTML SI SE NECESITAN
========================================================= */

window.abrirTicket =
    abrirTicket;

window.cerrarModalTicket =
    cerrarModalTicket;

window.cargarTickets =
    cargarTickets;

window.activarSonido =
    activarSonido;