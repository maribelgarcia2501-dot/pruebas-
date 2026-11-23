"use strict";

/* =========================================================
   MENSAJERÍA EXPRESS
   AYUDA / SOPORTE TÉCNICO

   FUNCIONAMIENTO:

   - Usa la sesión creada por el LOGIN CENTRAL.
   - Storage: mensajeria-intranet-auth
   - NO crea otra sesión.
   - NO solicita nuevamente correo ni contraseña.
   - Busca al usuario autenticado en todas las áreas.
   - Permite crear tickets.
   - Permite adjuntar archivos.
   - Límite de archivo: 10 MB.
   - NO redirige a panel.html.
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

   MISMA SESIÓN DEL LOGIN CENTRAL
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
let perfilActual = null;


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log("========================================");
        console.log("MENSAJERÍA EXPRESS");
        console.log("AYUDA / SOPORTE TÉCNICO");
        console.log("========================================");


        const formularioAyuda =
            document.getElementById(
                "formularioAyuda"
            );


        if (!formularioAyuda) {

            console.error(
                "No se encontró #formularioAyuda"
            );

            return;
        }


        const autorizado =
            await cargarUsuarioSoporte();


        if (!autorizado) {
            return;
        }


        configurarEventos();
    }
);


/* =========================================================
   CARGAR USUARIO

   PERMITE TICKETS A TODAS LAS ÁREAS:

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

async function cargarUsuarioSoporte() {

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
                "NO EXISTE SESIÓN ACTIVA."
            );

            alert(
                "Debes iniciar sesión desde el sistema."
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
        console.log("SESIÓN ENCONTRADA");
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
            await buscarUsuarioParaSoporte(
                usuarioSesion.id
            );


        /* =====================================================
           USUARIO NO ENCONTRADO
        ===================================================== */

        if (!resultado) {

            console.error(
                "USUARIO NO ENCONTRADO EN NINGUNA ÁREA:",
                usuarioSesion.id
            );

            alert(
                "Este usuario no está autorizado para utilizar esta sección."
            );

            return false;
        }


        /* =====================================================
           CREAR PERFIL COMPATIBLE

           NO CAMBIA LA ESTRUCTURA QUE YA USA
           EL RESTO DEL ARCHIVO.
        ===================================================== */

        perfilActual = {

            id:
                usuarioSesion.id,

            nombre:
                resultado.nombre || "",

            apellido:
                resultado.apellido || "",

            telefono:
                resultado.telefono || "",

            rol:
                resultado.rol ||
                resultado.area ||
                "usuario",

            area:
                resultado.area || "",

            tabla:
                resultado.tabla || ""

        };


        console.log("========================================");
        console.log("USUARIO AUTORIZADO PARA TICKETS");
        console.log(
            "ÁREA:",
            resultado.area
        );
        console.log(
            "TABLA:",
            resultado.tabla
        );
        console.log(
            "NOMBRE:",
            obtenerNombreSoporte()
        );
        console.log(
            "CORREO:",
            obtenerCorreoSoporte()
        );
        console.log(
            "TELÉFONO:",
            obtenerTelefonoSoporte()
        );
        console.log("========================================");


        mostrarDatosSoporte();


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
   BUSCAR USUARIO PARA SOPORTE

   IMPORTANTE:

   Esta función NO crea otra sesión.

   Usa el UUID de Supabase Auth y busca el usuario
   en todas las áreas.

   Si una tabla tiene error, continúa con la siguiente.
========================================================= */

async function buscarUsuarioParaSoporte(
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
       BUSCAR EN ÁREAS NORMALES
    ===================================================== */

    for (
        const configuracion
        of tablas
    ) {

        console.log(
            `Buscando usuario para soporte en: ${configuracion.tabla}`
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


            if (error) {

                console.error(
                    `Error consultando ${configuracion.tabla}:`,
                    error.message
                );

                continue;
            }


            if (data) {

                console.log(
                    `USUARIO ENCONTRADO PARA SOPORTE EN ${configuracion.tabla}`
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

            console.error(
                `Error inesperado en ${configuracion.tabla}:`,
                error
            );

            continue;
        }
    }


    /* =====================================================
       BUSCAR BACK OFFICE

       Back Office utiliza usuario_id
       en lugar de id.
    ===================================================== */

    console.log(
        "Buscando usuario para soporte en: back_offices"
    );


    try {

        const {
            data: backOffice,
            error: errorBackOffice
        } =
            await supabaseClient
                .from(
                    "back_offices"
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

            console.error(
                "Error consultando back_offices:",
                errorBackOffice.message
            );

        } else if (backOffice) {

            console.log(
                "USUARIO ENCONTRADO PARA SOPORTE EN back_offices"
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

        console.error(
            "Error inesperado consultando back_offices:",
            error
        );
    }


    return null;
}


/* =========================================================
   MOSTRAR DATOS DEL USUARIO
========================================================= */

function mostrarDatosSoporte() {

    const usuarioActual =
        document.getElementById(
            "usuarioActual"
        );


    if (!usuarioActual) {
        return;
    }


    usuarioActual.textContent =
        obtenerNombreSoporte();


    const usuarioInfo =
        usuarioActual.closest(
            ".usuario-info"
        );


    if (usuarioInfo) {

        const span =
            usuarioInfo.querySelector(
                "span"
            );


        if (span) {

            span.textContent =
                "Soporte conectado";
        }
    }


    const usuarioEstado =
        document.querySelector(
            ".usuario-estado"
        );


    if (usuarioEstado) {

        usuarioEstado.innerHTML =
            '<i class="ri-checkbox-circle-fill"></i> Soporte conectado';
    }
}


/* =========================================================
   NOMBRE
========================================================= */

function obtenerNombreSoporte() {

    if (
        perfilActual
    ) {

        const nombre =
            String(
                perfilActual.nombre || ""
            ).trim();


        const apellido =
            String(
                perfilActual.apellido || ""
            ).trim();


        const completo =
            `${nombre} ${apellido}`.trim();


        if (completo) {

            return completo;
        }
    }


    return (
        usuarioSesion?.email ||
        "Soporte"
    );
}


/* =========================================================
   TELÉFONO
========================================================= */

function obtenerTelefonoSoporte() {

    if (
        perfilActual?.telefono
    ) {

        return String(
            perfilActual.telefono
        ).trim();
    }


    return null;
}


/* =========================================================
   CORREO
========================================================= */

function obtenerCorreoSoporte() {

    return (
        usuarioSesion?.email ||
        null
    );
}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {

    const descripcion =
        document.getElementById(
            "descripcion"
        );


    const contadorDescripcion =
        document.getElementById(
            "contadorDescripcion"
        );


    const archivo =
        document.getElementById(
            "archivo"
        );


    const nombreArchivo =
        document.getElementById(
            "nombreArchivo"
        );


    const btnCancelar =
        document.getElementById(
            "btnCancelar"
        );


    const cerrarMensaje =
        document.getElementById(
            "cerrarMensaje"
        );


    const formularioAyuda =
        document.getElementById(
            "formularioAyuda"
        );


    /* =====================================================
       CONTADOR
    ===================================================== */

    if (
        descripcion &&
        contadorDescripcion
    ) {

        contadorDescripcion.textContent =
            `${descripcion.value.length} / 2000`;


        descripcion.addEventListener(
            "input",
            () => {

                contadorDescripcion.textContent =
                    `${descripcion.value.length} / 2000`;
            }
        );
    }


    /* =====================================================
       ARCHIVO
    ===================================================== */

    if (
        archivo &&
        nombreArchivo
    ) {

        archivo.addEventListener(
            "change",
            manejarArchivo
        );
    }


    /* =====================================================
       CANCELAR
    ===================================================== */

    if (btnCancelar) {

        btnCancelar.addEventListener(
            "click",
            () => {

                if (formularioAyuda) {

                    formularioAyuda.reset();
                }


                if (contadorDescripcion) {

                    contadorDescripcion.textContent =
                        "0 / 2000";
                }


                if (nombreArchivo) {

                    nombreArchivo.textContent =
                        "No se ha seleccionado ningún archivo.";
                }
            }
        );
    }


    /* =====================================================
       CERRAR MENSAJE
    ===================================================== */

    if (cerrarMensaje) {

        cerrarMensaje.addEventListener(
            "click",
            () => {

                const mensajeExito =
                    document.getElementById(
                        "mensajeExito"
                    );


                if (mensajeExito) {

                    mensajeExito.style.display =
                        "none";
                }
            }
        );
    }


    /* =====================================================
       FORMULARIO
    ===================================================== */

    if (formularioAyuda) {

        formularioAyuda.addEventListener(
            "submit",
            enviarTicket
        );
    }
}


/* =========================================================
   MANEJAR ARCHIVO
========================================================= */

function manejarArchivo(event) {

    const inputArchivo =
        event.target;


    const nombreArchivo =
        document.getElementById(
            "nombreArchivo"
        );


    if (
        !inputArchivo ||
        !inputArchivo.files ||
        inputArchivo.files.length === 0
    ) {

        if (nombreArchivo) {

            nombreArchivo.textContent =
                "No se ha seleccionado ningún archivo.";
        }

        return;
    }


    const archivoSeleccionado =
        inputArchivo.files[0];


    const maximo =
        10 * 1024 * 1024;


    if (
        archivoSeleccionado.size >
        maximo
    ) {

        alert(
            "El archivo no puede superar los 10 MB."
        );


        inputArchivo.value =
            "";


        if (nombreArchivo) {

            nombreArchivo.textContent =
                "No se ha seleccionado ningún archivo.";
        }


        return;
    }


    if (nombreArchivo) {

        nombreArchivo.textContent =
            `${archivoSeleccionado.name} (${formatearTamano(
                archivoSeleccionado.size
            )})`;
    }
}


/* =========================================================
   FORMATEAR TAMAÑO
========================================================= */

function formatearTamano(bytes) {

    if (
        !bytes ||
        bytes <= 0
    ) {

        return "0 Bytes";
    }


    const unidades = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const indice =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(
                    1024,
                    indice
                )
            ).toFixed(2)
        ) +
        " " +
        unidades[indice]
    );
}


/* =========================================================
   GENERAR NOMBRE DE ARCHIVO
========================================================= */

function generarNombreArchivo(
    archivo
) {

    const nombreOriginal =
        String(
            archivo?.name ||
            "archivo"
        );


    const posicionPunto =
        nombreOriginal.lastIndexOf(".");


    let extension =
        "";


    if (
        posicionPunto > -1
    ) {

        extension =
            nombreOriginal
                .substring(
                    posicionPunto + 1
                )
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );
    }


    const nombreSinExtension =
        posicionPunto > -1
            ? nombreOriginal.substring(
                0,
                posicionPunto
            )
            : nombreOriginal;


    const nombreBase =
        nombreSinExtension
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            )
            .substring(
                0,
                50
            );


    const tiempo =
        Date.now();


    const aleatorio =
        Math.random()
            .toString(36)
            .substring(
                2,
                10
            );


    return (
        `${usuarioSesion.id}/` +
        `${tiempo}_${aleatorio}_` +
        `${nombreBase || "archivo"}.` +
        `${extension || "archivo"}`
    );
}


/* =========================================================
   SUBIR ARCHIVO
========================================================= */

async function subirArchivo(
    archivoSeleccionado
) {

    if (
        !archivoSeleccionado
    ) {

        return null;
    }


    if (
        !usuarioSesion?.id
    ) {

        throw new Error(
            "No existe una sesión válida."
        );
    }


    const maximo =
        10 * 1024 * 1024;


    if (
        archivoSeleccionado.size >
        maximo
    ) {

        throw new Error(
            "El archivo no puede superar los 10 MB."
        );
    }


    const nombreArchivoStorage =
        generarNombreArchivo(
            archivoSeleccionado
        );


    const {
        data: uploadData,
        error: errorArchivo
    } =
        await supabaseClient
            .storage
            .from("tickets")
            .upload(
                nombreArchivoStorage,
                archivoSeleccionado,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType:
                        archivoSeleccionado.type ||
                        "application/octet-stream"
                }
            );


    if (errorArchivo) {

        console.error(
            "ERROR SUBIENDO ARCHIVO:",
            errorArchivo
        );


        throw new Error(
            "No se pudo subir el archivo: " +
            (
                errorArchivo.message ||
                "Error desconocido."
            )
        );
    }


    console.log(
        "ARCHIVO SUBIDO:",
        uploadData
    );


    const {
        data: urlData
    } =
        supabaseClient
            .storage
            .from("tickets")
            .getPublicUrl(
                nombreArchivoStorage
            );


    return (
        urlData?.publicUrl ||
        null
    );
}


/* =========================================================
   ENVIAR TICKET
========================================================= */

async function enviarTicket(
    event
) {

    event.preventDefault();


    if (
        !usuarioSesion ||
        !perfilActual
    ) {

        alert(
            "No se encontraron los datos del usuario."
        );

        return;
    }


    const formularioAyuda =
        document.getElementById(
            "formularioAyuda"
        );


    const btnEnviar =
        document.getElementById(
            "btnEnviar"
        );


    const categoria =
        document.getElementById(
            "categoria"
        )?.value.trim();


    const prioridad =
        document.getElementById(
            "prioridad"
        )?.value.trim();


    const asunto =
        document.getElementById(
            "asunto"
        )?.value.trim();


    const descripcion =
        document.getElementById(
            "descripcion"
        )?.value.trim();


    const archivo =
        document.getElementById(
            "archivo"
        );


    /* =====================================================
       VALIDACIONES
    ===================================================== */

    if (!categoria) {

        alert(
            "Selecciona una categoría."
        );

        return;
    }


    if (!prioridad) {

        alert(
            "Selecciona una prioridad."
        );

        return;
    }


    if (!asunto) {

        alert(
            "Escribe el asunto."
        );

        return;
    }


    if (
        asunto.length > 200
    ) {

        alert(
            "El asunto no puede superar los 200 caracteres."
        );

        return;
    }


    if (!descripcion) {

        alert(
            "Escribe una descripción."
        );

        return;
    }


    if (
        descripcion.length < 10
    ) {

        alert(
            "La descripción debe tener al menos 10 caracteres."
        );

        return;
    }


    if (
        descripcion.length > 2000
    ) {

        alert(
            "La descripción no puede superar los 2000 caracteres."
        );

        return;
    }


    if (
        archivo?.files?.length > 0 &&
        archivo.files[0].size >
        10 * 1024 * 1024
    ) {

        alert(
            "El archivo no puede superar los 10 MB."
        );

        return;
    }


    /* =====================================================
       BLOQUEAR BOTÓN
    ===================================================== */

    if (btnEnviar) {

        btnEnviar.disabled =
            true;

        btnEnviar.innerHTML =
            '<i class="ri-loader-4-line ri-spin"></i> Enviando...';
    }


    try {

        let archivoUrl =
            null;


        /* =================================================
           SUBIR ARCHIVO
        ================================================= */

        if (
            archivo?.files?.length > 0
        ) {

            archivoUrl =
                await subirArchivo(
                    archivo.files[0]
                );
        }


        /* =================================================
           DATOS DEL TICKET
        ================================================= */

        const datosTicket = {

            usuario_id:
                usuarioSesion.id,

            nombre_usuario:
                obtenerNombreSoporte(),

            correo_usuario:
                obtenerCorreoSoporte(),

            telefono_usuario:
                obtenerTelefonoSoporte(),

            categoria:
                categoria,

            prioridad:
                prioridad,

            asunto:
                asunto,

            descripcion:
                descripcion,

            archivo_url:
                archivoUrl,

            estado:
                "Pendiente"
        };


        console.log(
            "DATOS DEL TICKET:",
            datosTicket
        );


        /* =================================================
           INSERTAR TICKET
        ================================================= */

        const {
            data: ticket,
            error: errorTicket
        } =
            await supabaseClient
                .from("tickets_soporte")
                .insert(
                    datosTicket
                )
                .select()
                .single();


        if (errorTicket) {

            console.error(
                "ERROR GUARDANDO TICKET:",
                errorTicket
            );

            throw new Error(
                errorTicket.message ||
                "No se pudo guardar el ticket."
            );
        }


        console.log(
            "TICKET CREADO:",
            ticket
        );


        /* =================================================
           MOSTRAR ÉXITO
        ================================================= */

        mostrarResultadoExito(
            ticket
        );


        /* =================================================
           LIMPIAR FORMULARIO
        ================================================= */

        if (formularioAyuda) {

            formularioAyuda.reset();
        }


        const contadorDescripcion =
            document.getElementById(
                "contadorDescripcion"
            );


        const nombreArchivo =
            document.getElementById(
                "nombreArchivo"
            );


        if (contadorDescripcion) {

            contadorDescripcion.textContent =
                "0 / 2000";
        }


        if (nombreArchivo) {

            nombreArchivo.textContent =
                "No se ha seleccionado ningún archivo.";
        }


    } catch (error) {

        console.error(
            "ERROR COMPLETO EN SOPORTE:",
            error
        );


        alert(
            "No se pudo enviar la solicitud.\n\n" +
            (
                error?.message ||
                "Revisa la consola del navegador."
            )
        );


    } finally {

        if (btnEnviar) {

            btnEnviar.disabled =
                false;

            btnEnviar.innerHTML =
                '<i class="ri-send-plane-fill"></i> Crear ticket';
        }
    }
}


/* =========================================================
   RESULTADO
========================================================= */

function mostrarResultadoExito(
    ticket
) {

    const mensajeExito =
        document.getElementById(
            "mensajeExito"
        );


    const tituloResultado =
        document.getElementById(
            "tituloResultado"
        );


    const textoExito =
        document.getElementById(
            "textoExito"
        );


    const iconoResultado =
        document.getElementById(
            "iconoResultado"
        );


    if (tituloResultado) {

        tituloResultado.textContent =
            "Solicitud enviada correctamente";
    }


    if (iconoResultado) {

        iconoResultado.className =
            "ri-checkbox-circle-line";
    }


    if (textoExito) {

        textoExito.textContent =
            `Solicitud enviada correctamente por ${obtenerNombreSoporte()}.\n\n` +
            `Número de ticket: #${ticket.id}\n\n` +
            `Tu solicitud quedó pendiente para Soporte Técnico.`;
    }


    if (mensajeExito) {

        mensajeExito.style.display =
            "flex";
    }
}