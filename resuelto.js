"use strict";


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://kayzwwgmebtsaiovkeos.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_yj-QjGhy6RQNUzoxg3HQeg_hkZHuSyL";


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

let tickets = [];

let ticketSeleccionado = null;

let usuarioSoporteActual = null;

let canalRealtime = null;


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    iniciarResueltos
);


/* =========================================================
   INICIAR
========================================================= */

async function iniciarResueltos() {

    const usuarioValido =
        await cargarUsuarioActual();

    if (!usuarioValido) {
        return;
    }

    configurarEventos();

    await cargarTickets();

    escucharCambios();

}


/* =========================================================
   CARGAR USUARIO ACTUAL
========================================================= */

async function cargarUsuarioActual() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "ERROR DE SESIÓN:",
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

            window.location.href =
                "index.html";

            return false;
        }


        const usuario =
            data.session.user;


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
                "NO SE ENCONTRÓ EL USUARIO EN public.usuarios"
            );

            return false;
        }


        if (
            usuarioActual.activo === false
        ) {

            await supabaseClient.auth.signOut();

            sessionStorage.removeItem(
                "usuarioSoporte"
            );

            window.location.href =
                "index.html";

            return false;
        }


        usuarioSoporteActual =
            usuarioActual;


        const nombreCompleto =
            String(
                usuarioActual.nombre ||
                "Usuario"
            ).trim();


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


        const nombreUsuario =
            document.getElementById(
                "nombreUsuario"
            );


        if (nombreUsuario) {

            nombreUsuario.textContent =
                nombreCompleto;

        }


        document
            .querySelectorAll(
                ".nombre-usuario, .usuario-nombre"
            )
            .forEach(
                elemento => {

                    elemento.textContent =
                        nombreCompleto;

                }
            );


        return true;


    } catch (error) {

        console.error(
            "ERROR CARGANDO USUARIO:",
            error
        );

        return false;

    }

}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {


    /* =====================================================
       ACTUALIZAR
    ===================================================== */

    document
        .getElementById(
            "btnActualizar"
        )
        ?.addEventListener(
            "click",
            cargarTickets
        );


    /* =====================================================
       BUSCAR
    ===================================================== */

    document
        .getElementById(
            "buscarTicket"
        )
        ?.addEventListener(
            "input",
            renderizarTickets
        );


    /* =====================================================
       CERRAR MODAL
    ===================================================== */

    document
        .getElementById(
            "cerrarModal"
        )
        ?.addEventListener(
            "click",
            cerrarModalTicket
        );


    /* =====================================================
       GUARDAR
    ===================================================== */

    document
        .getElementById(
            "btnGuardarTicket"
        )
        ?.addEventListener(
            "click",
            guardarCambiosTicket
        );


    /* =====================================================
       CERRAR TICKET
    ===================================================== */

    document
        .getElementById(
            "btnCerrarTicket"
        )
        ?.addEventListener(
            "click",
            async () => {

                const estado =
                    document.getElementById(
                        "estadoTicket"
                    );


                if (estado) {

                    estado.value =
                        "Cerrado";

                }


                await guardarCambiosTicket();

            }
        );


    /* =====================================================
       CERRAR HACIENDO CLICK FUERA
    ===================================================== */

    document
        .getElementById(
            "modalTicket"
        )
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "modalTicket"
                ) {

                    cerrarModalTicket();

                }

            }
        );


    /* =====================================================
       ESCAPE
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                cerrarModalTicket();

            }

        }
    );

}


/* =========================================================
   CARGAR TICKETS RESUELTOS
========================================================= */

async function cargarTickets() {

    try {

        const {
            data,
            error
        } = await supabaseClient.rpc(
            "obtener_tickets_soporte"
        );


        if (error) {

            throw error;

        }


        tickets =
            Array.isArray(data)
                ? data.filter(
                    ticket =>
                        normalizar(
                            ticket.estado
                        ) ===
                        "resuelto"
                )
                : [];


        renderizarTickets();


        ponerTexto(
            "ticketsResueltos",
            tickets.length
        );


        ponerTexto(
            "contadorResueltos",
            tickets.length
        );


        ponerTexto(
            "textoCantidad",
            `${tickets.length} ${tickets.length === 1
                ? "ticket"
                : "tickets"
            }`
        );


    } catch (error) {

        console.error(
            "ERROR CARGANDO TICKETS:",
            error
        );


        tickets = [];


        renderizarTickets();


        ponerTexto(
            "ticketsResueltos",
            0
        );


        ponerTexto(
            "contadorResueltos",
            0
        );


        ponerTexto(
            "textoCantidad",
            "0 tickets"
        );

    }

}


/* =========================================================
   REALTIME
========================================================= */

function escucharCambios() {

    if (canalRealtime) {

        supabaseClient.removeChannel(
            canalRealtime
        );

    }


    canalRealtime =
        supabaseClient
            .channel(
                "tickets-resueltos"
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tickets_soporte"
                },
                () => {

                    cargarTickets();

                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Realtime resueltos:",
                        status
                    );

                }
            );

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


    if (!lista) {

        return;

    }


    const texto =
        normalizar(
            document.getElementById(
                "buscarTicket"
            )?.value || ""
        );


    const filtrados =
        tickets.filter(
            ticket => {

                const contenido = [

                    ticket.id,
                    ticket.nombre,
                    ticket.apellido,
                    ticket.correo,
                    ticket.telefono,
                    ticket.asunto,
                    ticket.descripcion,
                    ticket.categoria,
                    ticket.prioridad,
                    ticket.estado,
                    ticket.respuesta

                ].join(" ");


                return (
                    !texto ||
                    normalizar(
                        contenido
                    ).includes(texto)
                );

            }
        );


    lista.innerHTML = "";


    if (!filtrados.length) {

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


    filtrados.forEach(
        ticket => {

            lista.appendChild(
                crearTarjeta(ticket)
            );

        }
    );

}


/* =========================================================
   CREAR TARJETA
========================================================= */

function crearTarjeta(ticket) {

    const tarjeta =
        document.createElement(
            "article"
        );


    tarjeta.className =
        "ticket-card";


    const nombreUsuario =
        [
            ticket.nombre,
            ticket.apellido
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "Sin nombre";


    const prioridad =
        ticket.prioridad ||
        "Normal";


    tarjeta.innerHTML = `

        <div class="ticket-card-cabecera">

            <div>

                <span class="ticket-id">
                    Ticket #${escapeHTML(ticket.id)}
                </span>

                <h4>
                    ${escapeHTML(
        ticket.asunto ||
        "Sin asunto"
    )}
                </h4>

            </div>


            <span class="badge-estado resuelto">
                Resuelto
            </span>

        </div>


        <div class="ticket-card-usuario">

            <div class="avatar">
                <i class="ri-user-line"></i>
            </div>


            <div>

                <strong>
                    ${escapeHTML(
        nombreUsuario
    )}
                </strong>

                <span>
                    ${escapeHTML(
        ticket.correo ||
        "Sin correo"
    )}
                </span>

            </div>

        </div>


        <p class="ticket-card-descripcion">
            ${escapeHTML(
        ticket.descripcion ||
        "Sin descripción"
    )}
        </p>


        <div class="ticket-card-pie">

            <div>

                <span class="prioridad ${obtenerClasePrioridad(
        prioridad
    )}">
                    ${escapeHTML(
        prioridad
    )}
                </span>

            </div>


            <span>
                ${formatearFecha(
        ticket.creado_en
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


    llenarModal(
        ticket
    );


    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (!modal) {

        return;

    }


    modal.classList.add(
        "mostrar"
    );


    document.body.classList.add(
        "modal-abierto"
    );

}


/* =========================================================
   LLENAR MODAL
========================================================= */

function llenarModal(ticket) {

    const nombreUsuario =
        [
            ticket.nombre,
            ticket.apellido
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "Sin nombre";


    ponerTexto(
        "modalNumero",
        `Ticket #${ticket.id || ""}`
    );


    ponerTexto(
        "modalAsunto",
        ticket.asunto ||
        "Sin asunto"
    );


    ponerTexto(
        "modalNombre",
        nombreUsuario
    );


    ponerTexto(
        "modalCorreo",
        ticket.correo ||
        "Sin correo"
    );


    ponerTexto(
        "modalTelefono",
        ticket.telefono ||
        "Sin teléfono"
    );


    ponerTexto(
        "modalCategoria",
        ticket.categoria ||
        "Sin categoría"
    );


    ponerTexto(
        "modalPrioridad",
        ticket.prioridad ||
        "Normal"
    );


    ponerTexto(
        "modalEstado",
        ticket.estado ||
        "Resuelto"
    );


    ponerTexto(
        "modalFecha",
        formatearFecha(
            ticket.creado_en
        )
    );


    ponerTexto(
        "modalDescripcion",
        ticket.descripcion ||
        "Sin descripción"
    );


    /* =====================================================
       ARCHIVO ADJUNTO
    ===================================================== */

    cargarArchivoAdjunto(
        ticket
    );


    /* =====================================================
       ESTADO
    ===================================================== */

    const estado =
        document.getElementById(
            "estadoTicket"
        );


    if (estado) {

        estado.value =
            obtenerValorEstado(
                ticket.estado
            );

    }


    /* =====================================================
       RESPUESTA
    ===================================================== */

    const respuesta =
        document.getElementById(
            "respuestaTicket"
        );


    if (respuesta) {

        respuesta.value =
            ticket.respuesta ||
            "";

    }

}


/* =========================================================
   CARGAR ARCHIVO ADJUNTO
========================================================= */

async function cargarArchivoAdjunto(ticket) {

    const contenedor =
        document.getElementById(
            "modalArchivoContenedor"
        );


    if (!contenedor) {

        return;

    }


    contenedor.style.display =
        "none";


    contenedor.innerHTML =
        "";


    const archivo =
        obtenerArchivoTicket(
            ticket
        );


    if (!archivo) {

        return;

    }


    const urls =
        obtenerURLsArchivo(
            archivo
        );


    if (!urls.length) {

        return;

    }


    const urlImagen =
        urls.find(
            url =>
                pareceImagen(url)
        );


    if (urlImagen) {

        const imagenValida =
            await probarImagen(
                urlImagen
            );


        if (imagenValida) {

            mostrarImagenEnModal(
                contenedor,
                urlImagen
            );

            return;

        }

    }


    mostrarEnlaceArchivo(
        contenedor,
        urls[0]
    );

}


/* =========================================================
   OBTENER ARCHIVO DEL TICKET
========================================================= */

function obtenerArchivoTicket(ticket) {

    const campos = [

        "archivo_url",
        "archivo",

        "adjunto_url",
        "adjunto",

        "archivo_adjunto_url",
        "archivo_adjunto",

        "imagen_url",
        "imagen",

        "image_url",
        "image",

        "foto_url",
        "foto",

        "evidencia_url",
        "evidencia",

        "documento_url",
        "documento",

        "attachment_url",
        "attachment",

        "file_url",
        "file",

        "archivo_path",
        "ruta_archivo",

        "ruta_imagen",
        "storage_path",

        "file_path",
        "image_path",

        "photo_url",
        "photo",

        "url_imagen",
        "imagen_adjunto",

        "imagen_adjunto_url",
        "archivo_imagen",

        "archivo_imagen_url",

        "url"

    ];


    for (const campo of campos) {

        if (
            ticket &&
            ticket[campo]
        ) {

            return ticket[campo];

        }

    }


    return null;

}


/* =========================================================
   OBTENER URLS
========================================================= */

function obtenerURLsArchivo(archivo) {

    const urls = [];


    const agregar = valor => {

        if (
            !valor ||
            typeof valor !== "string"
        ) {

            return;

        }


        const texto =
            valor.trim();


        if (!texto) {

            return;

        }


        if (
            !urls.includes(texto)
        ) {

            urls.push(texto);

        }

    };


    if (
        Array.isArray(archivo)
    ) {

        archivo.forEach(
            elemento => {

                if (
                    typeof elemento ===
                    "string"
                ) {

                    agregar(
                        elemento
                    );

                }

                else if (
                    elemento &&
                    typeof elemento ===
                    "object"
                ) {

                    agregar(
                        elemento.url
                    );

                    agregar(
                        elemento.href
                    );

                    agregar(
                        elemento.path
                    );

                }

            }
        );

    }


    else if (
        typeof archivo ===
        "object"
    ) {

        agregar(
            archivo.url
        );

        agregar(
            archivo.href
        );

        agregar(
            archivo.path
        );

    }


    else if (
        typeof archivo ===
        "string"
    ) {

        let texto =
            archivo.trim();


        if (
            texto.startsWith("[") ||
            texto.startsWith("{")
        ) {

            try {

                const convertido =
                    JSON.parse(
                        texto
                    );


                return obtenerURLsArchivo(
                    convertido
                );

            } catch (error) {

                /* Continúa como texto normal */

            }

        }


        agregar(
            texto
        );

    }


    return urls;

}


/* =========================================================
   DETECTAR SI ES IMAGEN
========================================================= */

function pareceImagen(url) {

    if (!url) {

        return false;

    }


    const texto =
        String(url)
            .toLowerCase()
            .split("?")[0]
            .split("#")[0];


    if (
        texto.startsWith(
            "data:image/"
        )
    ) {

        return true;

    }


    return (
        /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i
            .test(texto)
    );

}


/* =========================================================
   PROBAR IMAGEN
========================================================= */

function probarImagen(url) {

    return new Promise(
        resolve => {

            const imagen =
                new Image();


            imagen.onload =
                () => {

                    resolve(true);

                };


            imagen.onerror =
                () => {

                    resolve(false);

                };


            imagen.src =
                url;

        }
    );

}


/* =========================================================
   MOSTRAR IMAGEN EN EL MODAL
   SIN ZOOM
   SIN CLICK
   SIN ABRIR OTRA PESTAÑA
========================================================= */

function mostrarImagenEnModal(
    contenedor,
    url
) {

    contenedor.style.display =
        "block";


    contenedor.innerHTML = `

        <div
            class="modal-imagen-adjunto"
            style="
                width:100%;
                display:flex;
                align-items:center;
                justify-content:center;
            "
        >

            <img
                src="${escapeHTML(url)}"
                alt="Imagen adjunta del ticket"
                class="imagen-adjunta-ticket"
                loading="eager"
                draggable="false"
                style="
                    display:block;
                    width:100%;
                    max-width:700px;
                    max-height:500px;
                    height:auto;
                    object-fit:contain;
                    margin:0 auto;
                    border-radius:12px;
                    border:1px solid #e5e7eb;
                    background:#f8fafc;
                    box-shadow:0 4px 15px rgba(0,0,0,.08);
                    cursor:default;
                    user-select:none;
                    pointer-events:none;
                "
            >

        </div>

    `;

}


/* =========================================================
   MOSTRAR ENLACE PARA ARCHIVOS NO IMAGEN
========================================================= */

function mostrarEnlaceArchivo(
    contenedor,
    url
) {

    contenedor.style.display =
        "block";


    contenedor.innerHTML = `

        <a
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="archivo-adjunto"
        >

            <i class="ri-attachment-2"></i>

            Ver archivo adjunto

        </a>

    `;

}


/* =========================================================
   GUARDAR CAMBIOS
========================================================= */

async function guardarCambiosTicket() {

    if (!ticketSeleccionado) {

        return;

    }


    const estado =
        document.getElementById(
            "estadoTicket"
        )?.value ||
        "Resuelto";


    const respuesta =
        document.getElementById(
            "respuestaTicket"
        )?.value ||
        "";


    try {

        const {
            error
        } = await supabaseClient.rpc(
            "actualizar_ticket_soporte",
            {
                p_ticket_id:
                    ticketSeleccionado.id,

                p_estado:
                    estado,

                p_respuesta:
                    respuesta
            }
        );


        if (error) {

            throw error;

        }


        cerrarModalTicket();


        await cargarTickets();


    } catch (error) {

        console.error(
            "ERROR ACTUALIZANDO TICKET:",
            error
        );


        alert(
            error?.message ||
            "No se pudo actualizar el ticket."
        );

    }

}


/* =========================================================
   CERRAR MODAL
========================================================= */

function cerrarModalTicket() {

    const modal =
        document.getElementById(
            "modalTicket"
        );


    if (modal) {

        modal.classList.remove(
            "mostrar"
        );

        modal.classList.remove(
            "modal-abierto"
        );

    }


    document.body.classList.remove(
        "modal-abierto"
    );


    const contenedor =
        document.getElementById(
            "modalArchivoContenedor"
        );


    if (contenedor) {

        contenedor.innerHTML =
            "";

        contenedor.style.display =
            "none";

    }


    ticketSeleccionado =
        null;

}


/* =========================================================
   OBTENER VALOR DE ESTADO
========================================================= */

function obtenerValorEstado(estado) {

    switch (
    normalizar(estado)
    ) {

        case "pendiente":

            return "Pendiente";


        case "en revision":

            return "En revisión";


        case "resuelto":

            return "Resuelto";


        case "cerrado":

            return "Cerrado";


        default:

            return "Resuelto";

    }

}


/* =========================================================
   PONER TEXTO
========================================================= */

function ponerTexto(
    id,
    texto
) {

    const elemento =
        document.getElementById(
            id
        );


    if (elemento) {

        elemento.textContent =
            texto ?? "";

    }

}


/* =========================================================
   NORMALIZAR
========================================================= */

function normalizar(valor) {

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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(valor) {

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


/* =========================================================
   FORMATEAR FECHA
========================================================= */

function formatearFecha(fecha) {

    if (!fecha) {

        return "Sin fecha";

    }


    const date =
        new Date(
            fecha
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Sin fecha";

    }


    return date.toLocaleString(
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


/* =========================================================
   CLASE DE PRIORIDAD
========================================================= */

function obtenerClasePrioridad(
    prioridad
) {

    switch (
    normalizar(prioridad)
    ) {

        case "alta":

            return "alta";


        case "urgente":

            return "urgente";


        case "normal":

            return "normal";


        default:

            return "normal";

    }

}


/* =========================================================
   LIMPIAR REALTIME AL SALIR
========================================================= */

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