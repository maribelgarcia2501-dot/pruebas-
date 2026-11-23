
"use strict";

/* =========================================================
   WEBCORP BUSINESS
   LOGIN CENTRAL DE LA INTRANET

   TABLAS SUPABASE:
   - analistas
   - back_offices
   - bodega
   - contabilidad
   - jefes
   - meg
   - marketing
   - recursos
   - usuarios (IT ORIGINAL)
   - it2

   FUNCIONAMIENTO:
   1. Autenticar usuario.
   2. Buscar usuario en las áreas.
   3. Buscar IT original e IT2.
   4. Buscar Back Office.
   5. Guardar nombre, apellido y correo.
   6. Redirigir al panel correspondiente.
========================================================= */


/* =========================================================
   CONFIGURACIÓN SUPABASE
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
   ELEMENTOS HTML
========================================================= */

const loginForm =
    document.getElementById("loginForm");

const correoInput =
    document.getElementById("correo");

const passwordInput =
    document.getElementById("password");

const btnLogin =
    document.getElementById("btnLogin");

const mensaje =
    document.getElementById("mensaje");

const mostrarPassword =
    document.getElementById("mostrarPassword");

const recuperar =
    document.getElementById("recuperar");


/* =========================================================
   CONFIGURACIÓN DE ÁREAS
========================================================= */

const CONFIGURACION_AREAS = [

    {
        tabla: "analistas",
        columna: "id",
        almacenamiento: "analista",
        nombre: "Analistas",
        destino: "panel.html"
    },

    {
        tabla: "bodega",
        columna: "id",
        almacenamiento: "bodega",
        nombre: "Bodega",
        destino: "panel.html"
    },

    {
        tabla: "contabilidad",
        columna: "id",
        almacenamiento: "contabilidad",
        nombre: "Contabilidad",
        destino: "panel.html"
    },

    {
        tabla: "jefes",
        columna: "id",
        almacenamiento: "jefe",
        nombre: "Jefes",
        destino: "jefes.html"
    },

    {
        tabla: "meg",
        columna: "id",
        almacenamiento: "meg",
        nombre: "MEG",
        destino: "panel.html"
    },

    {
        tabla: "marketing",
        columna: "id",
        almacenamiento: "marketing",
        nombre: "Marketing",
        destino: "panel.html"
    },

    {
        tabla: "recursos",
        columna: "id",
        almacenamiento: "recursos",
        nombre: "Recursos",
        destino: "panel.html"
    }

];


/* =========================================================
   CONFIGURACIÓN IT
========================================================= */

const CONFIGURACION_IT = [

    {
        tabla: "usuarios",
        columna: "id",
        almacenamiento: "it",
        nombre: "IT",
        destino: "soporte.html"
    },

    {
        tabla: "it2",
        columna: "id",
        almacenamiento: "it2",
        nombre: "IT 2",
        destino: "panel.html"
    }

];


/* =========================================================
   INICIO DEL SISTEMA
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    configurarLogin();

    configurarPassword();

    configurarRecuperacion();

});


/* =========================================================
   CONFIGURAR FORMULARIO
========================================================= */

function configurarLogin() {

    if (!loginForm) {

        console.error(
            "No se encontró el formulario #loginForm."
        );

        return;
    }

    loginForm.addEventListener(
        "submit",
        iniciarSesion
    );

}


/* =========================================================
   MOSTRAR Y OCULTAR CONTRASEÑA
========================================================= */

function configurarPassword() {

    if (!mostrarPassword || !passwordInput) {
        return;
    }

    mostrarPassword.addEventListener("click", () => {

        const icono =
            mostrarPassword.querySelector("i");

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            if (icono) {
                icono.className = "ri-eye-off-line";
            }

            mostrarPassword.setAttribute(
                "aria-label",
                "Ocultar contraseña"
            );

        } else {

            passwordInput.type = "password";

            if (icono) {
                icono.className = "ri-eye-line";
            }

            mostrarPassword.setAttribute(
                "aria-label",
                "Mostrar contraseña"
            );

        }

    });

}


/* =========================================================
   RECUPERACIÓN DE CONTRASEÑA
========================================================= */

function configurarRecuperacion() {

    if (!recuperar) {
        return;
    }

    recuperar.addEventListener("click", async event => {

        event.preventDefault();

        const correo = correoInput
            ? correoInput.value.trim()
            : "";

        if (!correo) {

            mostrarMensaje(
                "Ingresa tu correo electrónico para recuperar tu contraseña.",
                "error"
            );

            if (correoInput) {
                correoInput.focus();
            }

            return;
        }

        mostrarMensaje(
            "Enviando enlace de recuperación...",
            "info"
        );

        try {

            const { error } =
                await supabaseClient.auth.resetPasswordForEmail(
                    correo,
                    {
                        redirectTo:
                            `${window.location.origin}/index.html`
                    }
                );

            if (error) {
                throw error;
            }

            mostrarMensaje(
                "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
                "success"
            );

        } catch (error) {

            console.error(
                "Error recuperando contraseña:",
                error
            );

            mostrarMensaje(
                obtenerMensajeError(error),
                "error"
            );

        }

    });

}


/* =========================================================
   INICIAR SESIÓN
========================================================= */

async function iniciarSesion(event) {

    event.preventDefault();

    const correo = correoInput
        ? correoInput.value.trim()
        : "";

    const password = passwordInput
        ? passwordInput.value
        : "";

    if (!correo || !password) {

        mostrarMensaje(
            "Completa todos los campos.",
            "error"
        );

        return;
    }

    cambiarEstadoBoton(
        true,
        "Verificando..."
    );

    limpiarMensaje();

    limpiarDatosAreas();

    try {

        /* CERRAR SESIÓN ANTERIOR */

        const {
            error: errorSesionAnterior
        } = await supabaseClient.auth.signOut();

        if (errorSesionAnterior) {

            console.error(
                "Error cerrando sesión anterior:",
                errorSesionAnterior
            );

        }


        /* AUTENTICAR USUARIO */

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({

            email: correo,
            password: password

        });

        if (error) {
            throw error;
        }

        if (!data || !data.user) {

            throw new Error(
                "No se pudo obtener el usuario autenticado."
            );

        }

        const usuario = data.user;

        const correoUsuario =
            usuario.email || correo;

        console.log(
            "Usuario autenticado correctamente:",
            usuario.id
        );

        console.log(
            "Correo autenticado:",
            correoUsuario
        );


        /* BUSCAR ÁREAS */

        const resultadoArea =
            await buscarEnAreas(
                CONFIGURACION_AREAS,
                usuario.id
            );

        if (resultadoArea) {

            entrarAlArea(
                resultadoArea,
                usuario
            );

            return;

        }


        /* BUSCAR IT */

        const resultadoIT =
            await buscarEnAreas(
                CONFIGURACION_IT,
                usuario.id
            );

        if (resultadoIT) {

            entrarAlArea(
                resultadoIT,
                usuario
            );

            return;

        }


        /* BUSCAR BACK OFFICE */

        console.log(
            "Buscando Back Office..."
        );

        try {

            const {
                data: backOffice,
                error: errorBackOffice
            } = await supabaseClient
                .from("back_offices")
                .select("*")
                .eq(
                    "usuario_id",
                    usuario.id
                )
                .eq(
                    "activo",
                    true
                )
                .maybeSingle();

            if (errorBackOffice) {

                console.error(
                    "Error consultando Back Office:",
                    errorBackOffice
                );

            } else if (backOffice) {

                console.log(
                    "Back Office encontrado:",
                    backOffice
                );

                const resultadoBackOffice = {

                    datos: backOffice,

                    tabla: "back_offices",

                    almacenamiento: "back_office",

                    nombre: "Back Office",

                    destino: "panel.html"

                };

                entrarAlArea(
                    resultadoBackOffice,
                    usuario
                );

                return;

            }

        } catch (errorBackOffice) {

            console.error(
                "Error inesperado en Back Office:",
                errorBackOffice
            );

        }


        /* SIN ÁREA ACTIVA */

        console.error(
            "No se encontró un área activa para el usuario:",
            usuario.id
        );

        await supabaseClient.auth.signOut();

        limpiarDatosAreas();

        mostrarMensaje(
            "Tu usuario no tiene un área activa asignada dentro de la intranet. Revisa que esté registrado y activo en su tabla.",
            "error"
        );

    } catch (error) {

        console.error(
            "Error iniciando sesión:",
            error
        );

        await supabaseClient.auth.signOut();

        limpiarDatosAreas();

        mostrarMensaje(
            obtenerMensajeError(error),
            "error"
        );

    } finally {

        cambiarEstadoBoton(
            false,
            "Iniciar sesión"
        );

    }

}


/* =========================================================
   BUSCAR USUARIO EN LAS TABLAS

   IMPORTANTE:
   - Si una tabla falla, continúa con la siguiente.
   - No detiene toda la búsqueda.
   - Busca por UUID.
   - Requiere activo = true.
========================================================= */

async function buscarEnAreas(
    configuraciones,
    usuarioId
) {

    for (const area of configuraciones) {

        console.log(
            `Buscando usuario en tabla: ${area.tabla}`
        );

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from(area.tabla)
                .select("*")
                .eq(
                    area.columna,
                    usuarioId
                )
                .eq(
                    "activo",
                    true
                )
                .maybeSingle();

            if (error) {

                console.error(
                    `Error consultando ${area.tabla}:`,
                    error.message
                );

                continue;

            }

            if (data) {

                console.log(
                    `USUARIO ENCONTRADO EN: ${area.tabla}`,
                    data
                );

                return {

                    datos: data,

                    tabla: area.tabla,

                    almacenamiento: area.almacenamiento,

                    nombre: area.nombre,

                    destino: area.destino

                };

            }

            console.log(
                `No existe usuario activo en ${area.tabla}.`
            );

        } catch (error) {

            console.error(
                `Error inesperado en ${area.tabla}:`,
                error
            );

            continue;

        }

    }

    console.warn(
        "No se encontró al usuario en las tablas consultadas:",
        usuarioId
    );

    return null;

}


/* =========================================================
   ENTRAR AL ÁREA
========================================================= */

function entrarAlArea(resultado, usuario) {

    guardarDatosArea(
        resultado.almacenamiento,
        resultado.datos,
        resultado.tabla,
        usuario.email
    );

    mostrarMensaje(
        `Acceso autorizado. Entrando a ${resultado.nombre}...`,
        "success"
    );

    console.log(
        "Área autorizada:",
        resultado.nombre
    );

    console.log(
        "Tabla:",
        resultado.tabla
    );

    console.log(
        "Destino:",
        resultado.destino
    );

    setTimeout(() => {

        window.location.href =
            resultado.destino;

    }, 400);

}


/* =========================================================
   GUARDAR DATOS DEL USUARIO
========================================================= */

function guardarDatosArea(
    nombreArea,
    datos,
    tabla,
    correo
) {

    const nombre =
        String(
            datos.nombre ||
            datos.nombres ||
            ""
        ).trim();

    const apellido =
        String(
            datos.apellido ||
            datos.apellidos ||
            ""
        ).trim();

    const nombreCompleto =
        `${nombre} ${apellido}`.trim();

    const usuarioSesion = {

        id:
            datos.id ||
            datos.usuario_id,

        usuario_id:
            datos.usuario_id ||
            datos.id,

        nombre:
            nombre,

        apellido:
            apellido,

        nombreCompleto:
            nombreCompleto || "Usuario",

        correo:
            correo || "",

        telefono:
            datos.telefono || "",

        area:
            nombreArea,

        tabla:
            tabla

    };

    sessionStorage.setItem(
        nombreArea,
        JSON.stringify(usuarioSesion)
    );

    sessionStorage.setItem(
        "areaUsuario",
        nombreArea
    );

    sessionStorage.setItem(
        "usuarioIntranet",
        JSON.stringify(usuarioSesion)
    );

    console.log(
        "Nombre guardado:",
        usuarioSesion.nombreCompleto
    );

    console.log(
        "Correo guardado:",
        usuarioSesion.correo
    );

    console.log(
        "Área:",
        usuarioSesion.area
    );

}


/* =========================================================
   LIMPIAR DATOS ANTERIORES
========================================================= */

function limpiarDatosAreas() {

    const claves = [

        "analista",
        "back_office",
        "bodega",
        "contabilidad",
        "jefe",
        "meg",
        "marketing",
        "recursos",
        "it",
        "it2",
        "areaUsuario",
        "usuarioIntranet"

    ];

    claves.forEach(clave => {

        sessionStorage.removeItem(clave);

    });

}


/* =========================================================
   MOSTRAR MENSAJES
========================================================= */

function mostrarMensaje(
    texto,
    tipo = "info"
) {

    if (!mensaje) {
        return;
    }

    mensaje.textContent = texto;

    mensaje.className = "mensaje";

    mensaje.classList.add(
        `mensaje-${tipo}`
    );

}


/* =========================================================
   LIMPIAR MENSAJES
========================================================= */

function limpiarMensaje() {

    if (!mensaje) {
        return;
    }

    mensaje.textContent = "";

    mensaje.className = "mensaje";

}


/* =========================================================
   ESTADO DEL BOTÓN
========================================================= */

function cambiarEstadoBoton(
    cargando,
    texto
) {

    if (!btnLogin) {
        return;
    }

    btnLogin.disabled = cargando;

    if (cargando) {

        btnLogin.innerHTML = `
            <span class="button-content">
                <i class="ri-loader-4-line ri-spin"></i>
                ${texto}
            </span>
        `;

    } else {

        btnLogin.innerHTML = `
            <span class="button-content">
                <i class="ri-login-box-line"></i>
                ${texto}
            </span>
        `;

    }

}


/* =========================================================
   MENSAJES DE ERROR
========================================================= */

function obtenerMensajeError(error) {

    if (!error) {

        return "Ocurrió un error inesperado.";

    }

    const mensajeError =
        error.message
            ? error.message.toLowerCase()
            : "";

    if (
        mensajeError.includes(
            "invalid login credentials"
        )
    ) {

        return "Correo o contraseña incorrectos.";

    }

    if (
        mensajeError.includes(
            "email not confirmed"
        )
    ) {

        return "Tu correo electrónico todavía no ha sido confirmado.";

    }

    if (
        mensajeError.includes(
            "too many requests"
        )
    ) {

        return "Demasiados intentos. Espera unos minutos e inténtalo nuevamente.";

    }

    if (
        mensajeError.includes(
            "network"
        )
    ) {

        return "No se pudo conectar con el servidor. Revisa tu conexión.";

    }

    if (
        mensajeError.includes(
            "permission denied"
        ) ||
        mensajeError.includes(
            "row-level security"
        )
    ) {

        return "No tienes permisos para consultar tu área. Revisa las políticas RLS de Supabase.";

    }

    return (
        error.message ||
        "No se pudo iniciar sesión."
    );

}
