"use strict";

/* =========================================================
   MENSAJERÍA EXPRESS
   HISTORIAL DE TICKETS - TODAS LAS ÁREAS

   FUNCIONAMIENTO:

   - Usa la sesión del LOGIN CENTRAL.
   - Storage: mensajeria-intranet-auth
   - Busca al usuario en todas las áreas.
   - NO utiliza perfiles.
   - NO solicita otro inicio de sesión.
   - Muestra únicamente los tickets del usuario actual.
   - Actualiza automáticamente mediante Realtime.

   ÁREAS:
   - analistas
   - bodega
   - contabilidad
   - jefes
   - meg
   - marketing
   - recursos
   - usuarios
   - it2
   - back_offices
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://kayzwwgmebtsaiovkeos.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_yj-QjGhy6RQNUzoxg3HQeg_hkZHuSyL";


/* =========================================================
   CLIENTE SUPABASE

   IMPORTANTE:
   DEBE SER EL MISMO STORAGE DEL LOGIN CENTRAL
========================================================= */

const supabaseClient = supabase.createClient(
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

let usuarioSesion = null;
let usuarioActual = null;
let tickets = [];
let canalTickets = null;


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log("========================================");
        console.log("MENSAJERÍA EXPRESS");
        console.log("HISTORIAL DE TICKETS");
        console.log("========================================");

        const cargado =
            await cargarUsuario();

        if (!cargado) {
            return;
        }

        configurarEventos();

        await cargarTickets();

        iniciarRealtime();
    }
);


/* =========================================================
   CARGAR USUARIO DE LA SESIÓN

   BUSCA EL USUARIO EN TODAS LAS ÁREAS.
========================================================= */

async function cargarUsuario() {

    try {

        /* =====================================================
           OBTENER SESIÓN CENTRAL
        ===================================================== */

        const {
            data: {
                session
            },
            error: errorSesion
        } =
            await supabaseClient.auth.getSession();


        if (errorSesion) {

            console.error(
                "ERROR OBTENIENDO SESIÓN:",
                errorSesion
            );

            alert(
                "No se pudo comprobar la sesión."
            );

            return false;
        }


        /* =====================================================
           VERIFICAR SESIÓN
        ===================================================== */

        if (
            !session ||
            !session.user
        ) {

            console.warn(
                "NO EXISTE UNA SESIÓN ACTIVA."
            );

            alert(
                "Tu sesión ha expirado. Inicia sesión nuevamente."
            );

            window.location.href =
                "index.html";

            return false;
        }


        /* =====================================================
           GUARDAR USUARIO AUTH
        ===================================================== */

        usuarioSesion =
            session.user;


        console.log("========================================");
        console.log("USUARIO DE LA SESIÓN");
        console.log(
            "UUID:",
            usuarioSesion.id
        );
        console.log(
            "CORREO:",
            usuarioSesion.email
        );
        console.log(
            "STORAGE:",
            "mensajeria-intranet-auth"
        );
        console.log("========================================");


        /* =====================================================
           BUSCAR USUARIO EN TODAS LAS ÁREAS
        ===================================================== */

        const resultado =
            await buscarUsuarioHistorial(
                usuarioSesion.id
            );


        /* =====================================================
           USUARIO NO ENCONTRADO
        ===================================================== */

        if (!resultado) {

            console.error(
                "NO SE ENCONTRÓ EL USUARIO EN NINGUNA ÁREA:",
                usuarioSesion.id
            );

            alert(
                "El usuario actual no está registrado en ninguna área activa de la intranet."
            );

            return false;
        }


        /* =====================================================
           GUARDAR INFORMACIÓN DEL USUARIO

           NO CAMBIA LA FUNCIONALIDAD DEL HISTORIAL.
        ===================================================== */

        usuarioActual = {

            id:
                usuarioSesion.id,

            nombre:
                resultado.nombre || "",

            apellido:
                resultado.apellido || "",

            telefono:
                resultado.telefono || "",

            correo:
                usuarioSesion.email || "",

            area:
                resultado.area || "",

            tabla:
                resultado.tabla || "",

            rol:
                resultado.rol || ""

        };


        console.log("========================================");
        console.log("USUARIO ENCONTRADO");
        console.log(
            "ÁREA:",
            usuarioActual.area
        );
        console.log(
            "TABLA:",
            usuarioActual.tabla
        );
        console.log(
            "NOMBRE:",
            obtenerNombreUsuario()
        );
        console.log("========================================");


        mostrarUsuario();

        return true;


    } catch (error) {

        console.error(
            "ERROR CARGANDO USUARIO:",
            error
        );

        alert(
            "Ocurrió un error cargando los datos del usuario."
        );

        return false;
    }
}


/* =========================================================
   BUSCAR USUARIO PARA HISTORIAL

   BUSCA EN TODAS LAS TABLAS.

   Si una tabla tiene error de RLS,
   continúa con la siguiente.

   IMPORTANTE:
   - Las áreas normales utilizan id.
   - back_offices utiliza usuario_id.
========================================================= */

async function buscarUsuarioHistorial(
    usuarioId
) {

    const tablas = [

        {
            tabla: "analistas",
            columna: "id",
            area: "Analistas"
        },

        {
            tabla: "bodega",
            columna: "id",
            area: "Bodega"
        },

        {
            tabla: "contabilidad",
            columna: "id",
            area: "Contabilidad"
        },

        {
            tabla: "jefes",
            columna: "id",
            area: "Jefes"
        },

        {
            tabla: "meg",
            columna: "id",
            area: "MEG"
        },

        {
            tabla: "marketing",
            columna: "id",
            area: "Marketing"
        },

        {
            tabla: "recursos",
            columna: "id",
            area: "Recursos"
        },

        {
            tabla: "usuarios",
            columna: "id",
            area: "IT"
        },

        {
            tabla: "it2",
            columna: "id",
            area: "IT 2"
        }

    ];


    /* =====================================================
       BUSCAR ÁREAS NORMALES
    ===================================================== */

    for (
        const configuracion
        of tablas
    ) {

        console.log(
            `Buscando usuario en ${configuracion.tabla}...`
        );


        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        configuracion.tabla
                    )
                    .select(
                        "*"
                    )
                    .eq(
                        configuracion.columna,
                        usuarioId
                    )
                    .eq(
                        "activo",
                        true
                    )
                    .maybeSingle();


            /* =================================================
               SI HAY ERROR EN UNA TABLA,
               CONTINUAR CON LA SIGUIENTE.
            ================================================= */

            if (error) {

                console.warn(
                    `No se pudo consultar ${configuracion.tabla}:`,
                    error.message
                );

                continue;
            }


            /* =================================================
               USUARIO ENCONTRADO
            ================================================= */

            if (data) {

                console.log(
                    `USUARIO ENCONTRADO EN ${configuracion.tabla}`
                );


                return {

                    ...data,

                    area:
                        configuracion.area,

                    tabla:
                        configuracion.tabla,

                    rol:
                        configuracion.area

                };
            }


            console.log(
                `No existe usuario activo en ${configuracion.tabla}.`
            );


        } catch (error) {

            console.warn(
                `Error inesperado en ${configuracion.tabla}:`,
                error
            );

            continue;
        }
    }


    /* =====================================================
       BUSCAR BACK OFFICE

       back_offices utiliza usuario_id.
    ===================================================== */

    console.log(
        "Buscando usuario en back_offices..."
    );


    try {

        const {
            data: backOffice,
            error: errorBackOffice
        } =
            await supabaseClient
                .from(
                    "Usuario"
                )
                .select(
                    "*"
                )
                .eq(
                    "usuario_id",
                    usuarioId
                )
                .eq(
                    "activo",
                    true
                )
                .maybeSingle();


        if (errorBackOffice) {

            console.warn(
                "No se pudo consultar back_offices:",
                errorBackOffice.message
            );

        } else if (backOffice) {

            console.log(
                "USUARIO ENCONTRADO"
            );


            return {

                ...backOffice,

                area:
                    "Back Office",

                tabla:
                    "back_offices",

                rol:
                    "Back Office"

            };
        }


    } catch (error) {

        console.warn(
            "Error inesperado consultando back_offices:",
            error
        );
    }


    return null;
}


/* =========================================================
   MOSTRAR USUARIO
========================================================= */

function mostrarUsuario() {

    const usuarioActualElement =
        document.getElementById(
            "usuarioActual"
        );


    if (!usuarioActualElement) {
        return;
    }


    const nombre =
        String(
            usuarioActual?.nombre ||
            usuarioSesion?.email ||
            "Usuario"
        ).trim();


    usuarioActualElement.textContent =
        nombre;
}


/* =========================================================
   OBTENER NOMBRE DEL USUARIO
========================================================= */

function obtenerNombreUsuario() {

    if (
        usuarioActual
    ) {

        const nombre =
            String(
                usuarioActual.nombre ||
                ""
            ).trim();


        const apellido =
            String(
                usuarioActual.apellido ||
                ""
            ).trim();


        const nombreCompleto =
            `${nombre} ${apellido}`.trim();


        if (nombreCompleto) {

            return nombreCompleto;
        }
    }


    return (
        usuarioSesion?.email ||
        "Usuario"
    );
}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {

    const buscar =
        document.getElementById(
            "buscarTicket"
        );


    const filtro =
        document.getElementById(
            "filtroEstado"
        );


    const cerrarModal =
        document.getElementById(
            "cerrarModal"
        );


    const btnCerrarModal =
        document.getElementById(
            "btnCerrarModal"
        );


    if (buscar) {

        buscar.addEventListener(
            "input",
            aplicarFiltros
        );
    }


    if (filtro) {

        filtro.addEventListener(
            "change",
            aplicarFiltros
        );
    }


    if (cerrarModal) {

        cerrarModal.addEventListener(
            "click",
            cerrarDetalle
        );
    }


    if (btnCerrarModal) {

        btnCerrarModal.addEventListener(
            "click",
            cerrarDetalle
        );
    }


    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    cerrarDetalle();
                }
            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                cerrarDetalle();
            }
        }
    );
}


/* =========================================================
   CARGAR TICKETS
========================================================= */

async function cargarTickets() {

    const cargando =
        document.getElementById(
            "cargando"
        );


    const lista =
        document.getElementById(
            "listaTickets"
        );


    const sinTickets =
        document.getElementById(
            "sinTickets"
        );


    const sinResultados =
        document.getElementById(
            "sinResultados"
        );


    if (cargando) {

        cargando.style.display =
            "flex";
    }


    if (lista) {

        lista.innerHTML =
            "";
    }


    if (sinTickets) {

        sinTickets.style.display =
            "none";
    }


    if (sinResultados) {

        sinResultados.style.display =
            "none";
    }


    try {

        if (!usuarioSesion?.id) {

            throw new Error(
                "No existe un usuario autenticado."
            );
        }


        console.log(
            "CARGANDO TICKETS DEL USUARIO:",
            usuarioSesion.id
        );


        /* =====================================================
           IMPORTANTE:

           Cada usuario solamente consulta sus propios tickets.
        ===================================================== */

        const {
            data,
            error
        } =
            await supabaseClient
                .from("tickets_soporte")
                .select(
                    [
                        "id",
                        "usuario_id",
                        "nombre_usuario",
                        "correo_usuario",
                        "telefono_usuario",
                        "categoria",
                        "prioridad",
                        "asunto",
                        "descripcion",
                        "archivo_url",
                        "estado",
                        "respuesta",
                        "creado_en",
                        "actualizado_en"
                    ].join(",")
                )
                .eq(
                    "usuario_id",
                    usuarioSesion.id
                )
                .order(
                    "creado_en",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "ERROR CARGANDO TICKETS:",
                error
            );

            throw error;
        }


        tickets =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "TICKETS ENCONTRADOS:",
            tickets.length
        );


        actualizarResumen();

        aplicarFiltros();


    } catch (error) {

        console.error(
            "ERROR HISTORIAL:",
            error
        );


        tickets = [];


        if (lista) {

            lista.innerHTML = `
                <div class="sin-tickets">
                    <div class="sin-tickets-icono">
                        <i class="ri-error-warning-line"></i>
                    </div>

                    <h3>
                        No se pudo cargar el historial
                    </h3>

                    <p>
                        ${escapeHtml(
                            error?.message ||
                            "Ocurrió un error consultando los tickets."
                        )}
                    </p>
                </div>
            `;
        }


    } finally {

        if (cargando) {

            cargando.style.display =
                "none";
        }
    }
}


/* =========================================================
   RESUMEN
========================================================= */

function actualizarResumen() {

    const total =
        tickets.length;


    const pendientes =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) === "pendiente"
        ).length;


    const revision =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) === "en revisión"
        ).length;


    const resueltos =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) === "resuelto"
        ).length;


    const cerrados =
        tickets.filter(
            ticket =>
                normalizarEstado(
                    ticket.estado
                ) === "cerrado"
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


    const cerradosElement =
        document.getElementById(
            "ticketsCerrados"
        );


    if (cerradosElement) {

        cerradosElement.textContent =
            cerrados;
    }
}


/* =========================================================
   FILTROS
========================================================= */

function aplicarFiltros() {

    const buscar =
        document.getElementById(
            "buscarTicket"
        )?.value
            ?.trim()
            .toLowerCase() ||
        "";


    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        )?.value ||
        "Todos";


    const ticketsFiltrados =
        tickets.filter(
            ticket => {

                const texto =
                    [
                        ticket.id,
                        ticket.asunto,
                        ticket.categoria,
                        ticket.descripcion,
                        ticket.prioridad,
                        ticket.estado
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                const coincideBusqueda =
                    !buscar ||
                    texto.includes(
                        buscar
                    );


                const coincideEstado =
                    filtroEstado === "Todos" ||
                    normalizarEstado(
                        ticket.estado
                    ) ===
                    normalizarEstado(
                        filtroEstado
                    );


                return (
                    coincideBusqueda &&
                    coincideEstado
                );
            }
        );


    renderizarTickets(
        ticketsFiltrados
    );
}


/* =========================================================
   RENDERIZAR
========================================================= */

function renderizarTickets(
    listaTickets
) {

    const lista =
        document.getElementById(
            "listaTickets"
        );


    const sinResultados =
        document.getElementById(
            "sinResultados"
        );


    const sinTickets =
        document.getElementById(
            "sinTickets"
        );


    if (!lista) {
        return;
    }


    lista.innerHTML =
        "";


    if (tickets.length === 0) {

        lista.style.display =
            "none";


        if (sinTickets) {

            sinTickets.style.display =
                "block";
        }


        if (sinResultados) {

            sinResultados.style.display =
                "none";
        }


        return;
    }


    if (listaTickets.length === 0) {

        lista.style.display =
            "none";


        if (sinTickets) {

            sinTickets.style.display =
                "none";
        }


        if (sinResultados) {

            sinResultados.style.display =
                "block";
        }


        return;
    }


    lista.style.display =
        "flex";


    if (sinTickets) {

        sinTickets.style.display =
            "none";
    }


    if (sinResultados) {

        sinResultados.style.display =
            "none";
    }


    listaTickets.forEach(
        ticket => {

            lista.appendChild(
                crearTicketCard(
                    ticket
                )
            );
        }
    );
}


/* =========================================================
   CREAR TARJETA
========================================================= */

function crearTicketCard(
    ticket
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "ticket-card";


    const estado =
        obtenerEstadoVisual(
            ticket.estado
        );


    const fecha =
        formatearFecha(
            ticket.creado_en
        );


    const descripcion =
        ticket.descripcion ||
        "Sin descripción";


    const descripcionCorta =
        descripcion.length > 180
            ? descripcion.substring(
                0,
                180
            ) + "..."
            : descripcion;


    card.innerHTML = `
        <div class="ticket-superior">

            <div class="ticket-identificacion">

                <span class="ticket-numero">
                    Ticket #${escapeHtml(
                        String(ticket.id)
                    )}
                </span>

                <h3 class="ticket-asunto">
                    ${escapeHtml(
                        ticket.asunto ||
                        "Sin asunto"
                    )}
                </h3>

            </div>

            <span class="ticket-estado ${estado.clase}">

                <i class="${estado.icono}"></i>

                ${escapeHtml(
                    estado.texto
                )}

            </span>

        </div>


        <p class="ticket-descripcion">

            ${escapeHtml(
                descripcionCorta
            )}

        </p>


        <div class="ticket-informacion">

            <span class="ticket-dato">

                <i class="ri-folder-settings-line"></i>

                ${escapeHtml(
                    ticket.categoria ||
                    "Sin categoría"
                )}

            </span>


            <span class="ticket-dato prioridad">

                <i class="ri-alarm-warning-line"></i>

                ${escapeHtml(
                    ticket.prioridad ||
                    "Normal"
                )}

            </span>


            ${ticket.respuesta
            ? `
                        <span class="ticket-dato">

                            <i class="ri-message-3-line"></i>

                            Tiene respuesta

                        </span>
                    `
            : ""
        }

        </div>


        <div class="ticket-pie">

            <span class="ticket-fecha">

                <i class="ri-calendar-line"></i>

                ${escapeHtml(
                    fecha
                )}

            </span>


            <button
                type="button"
                class="btn-ver-ticket"
            >

                <i class="ri-eye-line"></i>

                Ver detalles

            </button>

        </div>
    `;


    const boton =
        card.querySelector(
            ".btn-ver-ticket"
        );


    if (boton) {

        boton.addEventListener(
            "click",
            () => {

                abrirDetalle(
                    ticket
                );
            }
        );
    }


    return card;
}


/* =========================================================
   ABRIR DETALLE
========================================================= */

function abrirDetalle(
    ticket
) {

    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (!modal) {
        return;
    }


    const estado =
        obtenerEstadoVisual(
            ticket.estado
        );


    const modalNumero =
        document.getElementById(
            "modalNumero"
        );


    const modalAsunto =
        document.getElementById(
            "modalAsunto"
        );


    const modalEstado =
        document.getElementById(
            "modalEstado"
        );


    const modalCategoria =
        document.getElementById(
            "modalCategoria"
        );


    const modalPrioridad =
        document.getElementById(
            "modalPrioridad"
        );


    const modalFecha =
        document.getElementById(
            "modalFecha"
        );


    const modalActualizado =
        document.getElementById(
            "modalActualizado"
        );


    const modalDescripcion =
        document.getElementById(
            "modalDescripcion"
        );


    const modalRespuesta =
        document.getElementById(
            "modalRespuesta"
        );


    const modalArchivo =
        document.getElementById(
            "modalArchivo"
        );


    const modalArchivoLink =
        document.getElementById(
            "modalArchivoLink"
        );


    if (modalNumero) {

        modalNumero.textContent =
            `Ticket #${ticket.id}`;
    }


    if (modalAsunto) {

        modalAsunto.textContent =
            ticket.asunto ||
            "Sin asunto";
    }


    if (modalEstado) {

        modalEstado.textContent =
            estado.texto;


        modalEstado.className =
            "modal-estado " +
            estado.clase;
    }


    if (modalCategoria) {

        modalCategoria.textContent =
            ticket.categoria ||
            "Sin categoría";
    }


    if (modalPrioridad) {

        modalPrioridad.textContent =
            ticket.prioridad ||
            "Normal";
    }


    if (modalFecha) {

        modalFecha.textContent =
            formatearFecha(
                ticket.creado_en
            );
    }


    if (modalActualizado) {

        modalActualizado.textContent =
            formatearFecha(
                ticket.actualizado_en
            );
    }


    if (modalDescripcion) {

        modalDescripcion.textContent =
            ticket.descripcion ||
            "Sin descripción.";
    }


    if (modalRespuesta) {

        modalRespuesta.textContent =
            ticket.respuesta ||
            "Aún no hay respuesta de soporte.";
    }


    if (
        modalArchivo &&
        modalArchivoLink
    ) {

        if (ticket.archivo_url) {

            modalArchivo.style.display =
                "block";


            modalArchivoLink.href =
                ticket.archivo_url;


            modalArchivoLink.target =
                "_blank";


            modalArchivoLink.rel =
                "noopener noreferrer";

        } else {

            modalArchivo.style.display =
                "none";


            modalArchivoLink.href =
                "#";
        }
    }


    modal.classList.add(
        "mostrar"
    );


    document.body.style.overflow =
        "hidden";
}


/* =========================================================
   CERRAR MODAL
========================================================= */

function cerrarDetalle() {

    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "mostrar"
    );


    document.body.style.overflow =
        "";
}


/* =========================================================
   ESTADO VISUAL
========================================================= */

function obtenerEstadoVisual(
    estado
) {

    const estadoNormalizado =
        normalizarEstado(
            estado
        );


    if (
        estadoNormalizado ===
        "en revisión"
    ) {

        return {

            texto:
                "En revisión",

            clase:
                "revision",

            icono:
                "ri-loader-4-line"
        };
    }


    if (
        estadoNormalizado ===
        "revision"
    ) {

        return {

            texto:
                "En revisión",

            clase:
                "revision",

            icono:
                "ri-loader-4-line"
        };
    }


    if (
        estadoNormalizado ===
        "resuelto"
    ) {

        return {

            texto:
                "Resuelto",

            clase:
                "resuelto",

            icono:
                "ri-checkbox-circle-line"
        };
    }


    if (
        estadoNormalizado ===
        "cerrado"
    ) {

        return {

            texto:
                "Cerrado",

            clase:
                "cerrado",

            icono:
                "ri-lock-line"
        };
    }


    return {

        texto:
            "Pendiente",

        clase:
            "pendiente",

        icono:
            "ri-time-line"
    };
}


/* =========================================================
   NORMALIZAR ESTADO
========================================================= */

function normalizarEstado(
    estado
) {

    return String(
        estado ||
        "Pendiente"
    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );
}


/* =========================================================
   FORMATEAR FECHA
========================================================= */

function formatearFecha(
    fecha
) {

    if (!fecha) {

        return "Sin fecha";
    }


    const fechaObj =
        new Date(
            fecha
        );


    if (
        Number.isNaN(
            fechaObj.getTime()
        )
    ) {

        return "Sin fecha";
    }


    return new Intl.DateTimeFormat(
        "es-GT",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short"
        }
    ).format(
        fechaObj
    );
}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escapeHtml(
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
   REALTIME
========================================================= */

function iniciarRealtime() {

    if (
        !usuarioSesion?.id
    ) {

        return;
    }


    if (canalTickets) {

        supabaseClient.removeChannel(
            canalTickets
        );
    }


    const nombreCanal =
        "historial-tickets-" +
        usuarioSesion.id +
        "-" +
        Date.now();


    canalTickets =
        supabaseClient
            .channel(
                nombreCanal
            )
            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "tickets_soporte",

                    filter:
                        `usuario_id=eq.${usuarioSesion.id}`
                },
                async payload => {

                    console.log(
                        "========================================"
                    );

                    console.log(
                        "CAMBIO DETECTADO EN TICKET"
                    );

                    console.log(
                        payload
                    );

                    console.log(
                        "========================================"
                    );


                    await cargarTickets();
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "REALTIME HISTORIAL:",
                        status
                    );
                }
            );
}


/* =========================================================
   LIMPIAR REALTIME AL SALIR
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (canalTickets) {

            supabaseClient.removeChannel(
                canalTickets
            );

            canalTickets =
                null;
        }
    }
);