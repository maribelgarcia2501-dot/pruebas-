/* =========================================================
   WEB CORP BUSINESS
   CATÁLOGO DE PRODUCTOS
   SUPABASE - VERSIÓN PARA SERVIDOR / WEB
========================================================= */

"use strict";


/* =========================================================
   MARCA DE CONTROL
========================================================= */

console.log("==========================================");
console.log("CATALOGO.JS - WEB CORP BUSINESS");
console.log("URL:", window.location.href);
console.log("ORIGEN:", window.location.origin);
console.log("==========================================");


/* =========================================================
   CONFIGURACIÓN SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://zoyplgxxbnjhvorgyrdq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_JHpEeo8gwS5ov9eH6g3eJA_pp5K-TuN";


const SUPABASE_REST_URL =
    `${SUPABASE_URL}/rest/v1/catalogo_productos`;


/* =========================================================
   CLIENTE SUPABASE
========================================================= */

let supabaseClient = null;


if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
) {

    try {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );

        console.log(
            "Supabase JS cargado correctamente."
        );

    } catch (error) {

        console.warn(
            "No se pudo inicializar Supabase JS:",
            error
        );

    }

} else {

    console.warn(
        "Supabase JS no está disponible."
    );

}


/* =========================================================
   INICIAR CATÁLOGO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "DOM cargado."
        );


        /* =====================================================
           ELEMENTOS PRINCIPALES
        ====================================================== */

        const buscador =
            document.getElementById(
                "buscadorProductos"
            );

        const btnBuscar =
            document.getElementById(
                "btnBuscar"
            );

        const botonesCategoria =
            document.querySelectorAll(
                ".categoria-btn"
            );

        const catalogo =
            document.getElementById(
                "catalogoProductos"
            );

        const sinResultados =
            document.getElementById(
                "sinResultados"
            );

        const contadorProductos =
            document.getElementById(
                "contadorProductos"
            );


        /* =====================================================
           MODAL
        ====================================================== */

        const modal =
            document.getElementById(
                "modalProducto"
            );

        const cerrarModal =
            document.getElementById(
                "cerrarModal"
            );

        const modalImagenPrincipal =
            document.getElementById(
                "modalImagenPrincipal"
            );

        const modalCodigo =
            document.getElementById(
                "modalCodigo"
            );

        const modalNombre =
            document.getElementById(
                "modalNombre"
            );

        const modalPrecio =
            document.getElementById(
                "modalPrecio"
            );

        const modalDescripcion =
            document.getElementById(
                "modalDescripcion"
            );

        const modalCaracteristicas =
            document.getElementById(
                "modalCaracteristicas"
            );

        const modalContraindicaciones =
            document.getElementById(
                "modalContraindicaciones"
            );


        /* =====================================================
           PROVEEDOR
        ====================================================== */

        const modalProveedor =
            document.getElementById(
                "modalProveedor"
            );

        const modalProveedorTexto =
            document.getElementById(
                "modalProveedorTexto"
            );


        /* =====================================================
           GALERÍA
        ====================================================== */

        const imagenAnterior =
            document.getElementById(
                "imagenAnterior"
            );

        const imagenSiguiente =
            document.getElementById(
                "imagenSiguiente"
            );

        const miniaturas = [

            document.getElementById(
                "miniatura1"
            ),

            document.getElementById(
                "miniatura2"
            ),

            document.getElementById(
                "miniatura3"
            ),

            document.getElementById(
                "miniatura4"
            ),

            document.getElementById(
                "miniatura5"
            ),

            document.getElementById(
                "miniatura6"
            )

        ];


        /* =====================================================
           VERIFICACIÓN HTML
        ====================================================== */

        console.log(
            "Elemento #catalogoProductos:",
            catalogo
        );

        console.log(
            "Elemento #buscadorProductos:",
            buscador
        );

        console.log(
            "Elemento #modalProducto:",
            modal
        );


        if (
            !catalogo
        ) {

            console.error(
                "ERROR CRÍTICO: No existe #catalogoProductos"
            );

            return;

        }


        /* =====================================================
           CONTROLES ZOOM
        ====================================================== */

        let btnZoomMenos = null;
        let btnZoomMas = null;
        let btnZoomReset = null;


        if (
            modalImagenPrincipal
        ) {

            const contenedorImagen =
                modalImagenPrincipal.parentElement;


            if (
                contenedorImagen
            ) {

                const controlesZoom =
                    document.createElement(
                        "div"
                    );

                controlesZoom.className =
                    "controles-zoom";

                controlesZoom.setAttribute(
                    "aria-label",
                    "Controles de zoom"
                );

                controlesZoom.style.position =
                    "absolute";

                controlesZoom.style.right =
                    "15px";

                controlesZoom.style.bottom =
                    "15px";

                controlesZoom.style.zIndex =
                    "20";

                controlesZoom.style.display =
                    "flex";

                controlesZoom.style.gap =
                    "6px";


                function crearBotonZoom(
                    texto,
                    titulo
                ) {

                    const boton =
                        document.createElement(
                            "button"
                        );

                    boton.type =
                        "button";

                    boton.textContent =
                        texto;

                    boton.title =
                        titulo;

                    boton.setAttribute(
                        "aria-label",
                        titulo
                    );

                    boton.style.width =
                        "38px";

                    boton.style.height =
                        "38px";

                    boton.style.border =
                        "none";

                    boton.style.borderRadius =
                        "50%";

                    boton.style.cursor =
                        "pointer";

                    boton.style.fontSize =
                        "20px";

                    boton.style.fontWeight =
                        "bold";

                    boton.style.background =
                        "rgba(0, 0, 0, 0.75)";

                    boton.style.color =
                        "#ffffff";

                    boton.style.display =
                        "flex";

                    boton.style.alignItems =
                        "center";

                    boton.style.justifyContent =
                        "center";

                    boton.style.backdropFilter =
                        "blur(4px)";

                    return boton;

                }


                btnZoomMenos =
                    crearBotonZoom(
                        "−",
                        "Hacer imagen más pequeña"
                    );


                btnZoomReset =
                    crearBotonZoom(
                        "↺",
                        "Restablecer tamaño"
                    );


                btnZoomMas =
                    crearBotonZoom(
                        "+",
                        "Agrandar imagen"
                    );


                controlesZoom.appendChild(
                    btnZoomMenos
                );

                controlesZoom.appendChild(
                    btnZoomReset
                );

                controlesZoom.appendChild(
                    btnZoomMas
                );


                const posicionActual =
                    getComputedStyle(
                        contenedorImagen
                    ).position;


                if (
                    posicionActual === "static"
                ) {

                    contenedorImagen.style.position =
                        "relative";

                }


                contenedorImagen.appendChild(
                    controlesZoom
                );

            }

        }


        /* =====================================================
           VARIABLES
        ====================================================== */

        let categoriaActual =
            "todos";

        let textoBusqueda =
            "";

        let productoActual =
            null;

        let imagenActual =
            0;

        let imagenesProducto =
            [];

        let productosData =
            [];

        let tarjetasProductos =
            [];


        /* =====================================================
           ZOOM
        ====================================================== */

        let nivelZoom =
            1;

        const zoomMinimo =
            1;

        const zoomMaximo =
            3;

        const pasoZoom =
            0.25;


        /* =====================================================
           CARGAR PRODUCTOS
        ====================================================== */

        await cargarProductos();


        /* =====================================================
           BUSCADOR
        ====================================================== */

        if (
            buscador
        ) {

            buscador.addEventListener(
                "input",
                () => {

                    textoBusqueda =
                        buscador.value
                            .trim()
                            .toLowerCase();

                    actualizarCatalogo();

                }
            );


            buscador.addEventListener(
                "keydown",
                (evento) => {

                    if (
                        evento.key === "Enter"
                    ) {

                        evento.preventDefault();

                        textoBusqueda =
                            buscador.value
                                .trim()
                                .toLowerCase();

                        actualizarCatalogo();

                    }

                }
            );

        }


        /* =====================================================
           BOTÓN BUSCAR
        ====================================================== */

        if (
            btnBuscar
        ) {

            btnBuscar.addEventListener(
                "click",
                () => {

                    textoBusqueda =
                        buscador
                            ? buscador.value
                                .trim()
                                .toLowerCase()
                            : "";

                    actualizarCatalogo();

                }
            );

        }


        /* =====================================================
           CATEGORÍAS
        ====================================================== */

        botonesCategoria.forEach(
            (boton) => {

                boton.addEventListener(
                    "click",
                    () => {

                        botonesCategoria.forEach(
                            (btn) => {

                                btn.classList.remove(
                                    "activo"
                                );

                            }
                        );


                        boton.classList.add(
                            "activo"
                        );


                        categoriaActual =
                            normalizarCategoria(
                                boton.dataset.categoria ||
                                "todos"
                            );


                        actualizarCatalogo();

                    }
                );

            }
        );


        /* =====================================================
           CARGAR PRODUCTOS
        ====================================================== */

        async function cargarProductos() {

            mostrarEstadoCarga();


            console.log(
                "------------------------------------------"
            );

            console.log(
                "INICIANDO CARGA DE PRODUCTOS"
            );

            console.log(
                "Origen:",
                window.location.origin
            );

            console.log(
                "Página:",
                window.location.href
            );

            console.log(
                "REST:",
                SUPABASE_REST_URL
            );


            let datos =
                [];


            /* =================================================
               MÉTODO PRINCIPAL
            ================================================= */

            try {

                datos =
                    await cargarProductosREST();

            } catch (
                errorREST
            ) {

                console.error(
                    "Error consultando REST:",
                    errorREST
                );


                /* =============================================
                   RESPALDO CON SUPABASE JS
                ============================================== */

                if (
                    supabaseClient
                ) {

                    try {

                        console.log(
                            "Intentando consulta mediante Supabase JS..."
                        );


                        const resultado =
                            await supabaseClient
                                .from(
                                    "catalogo_productos"
                                )
                                .select("*")
                                .eq(
                                    "activo",
                                    true
                                )
                                .order(
                                    "creado_en",
                                    {
                                        ascending:
                                            false
                                    }
                                );


                        if (
                            resultado.error
                        ) {

                            throw resultado.error;

                        }


                        datos =
                            Array.isArray(
                                resultado.data
                            )
                                ? resultado.data
                                : [];


                        console.log(
                            "Supabase JS devolvió:",
                            datos.length,
                            "productos"
                        );

                    } catch (
                        errorSupabase
                    ) {

                        console.error(
                            "También falló Supabase JS:",
                            errorSupabase
                        );


                        mostrarErrorCarga(
                            errorSupabase.message ||
                            "No fue posible conectar con Supabase."
                        );

                        return;

                    }

                } else {

                    mostrarErrorCarga(
                        errorREST.message ||
                        "No fue posible conectar con Supabase."
                    );

                    return;

                }

            }


            if (
                !Array.isArray(
                    datos
                )
            ) {

                datos =
                    [];

            }


            productosData =
                datos;


            console.log(
                "=========================================="
            );

            console.log(
                "PRODUCTOS CARGADOS:",
                productosData.length
            );

            console.log(
                "=========================================="
            );


            if (
                productosData.length === 0
            ) {

                console.warn(
                    "Supabase respondió correctamente pero no hay productos activos."
                );

            }


            renderizarProductos(
                productosData
            );


            actualizarCatalogo();

        }


        /* =====================================================
           CONSULTA REST DIRECTA
        ====================================================== */

        async function cargarProductosREST() {

            const url =
                `${SUPABASE_REST_URL}?select=*&activo=eq.true&order=creado_en.desc`;


            console.log(
                "Consultando REST:"
            );

            console.log(
                url
            );


            const respuesta =
                await fetch(
                    url,
                    {
                        method:
                            "GET",

                        headers:
                            {
                                "apikey":
                                    SUPABASE_PUBLISHABLE_KEY,

                                "Authorization":
                                    `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,

                                "Accept":
                                    "application/json"
                            },

                        cache:
                            "no-store"
                    }
                );


            console.log(
                "REST STATUS:",
                respuesta.status
            );


            if (
                !respuesta.ok
            ) {

                const textoError =
                    await respuesta.text();


                throw new Error(
                    `Supabase REST ${respuesta.status}: ${textoError}`
                );

            }


            const data =
                await respuesta.json();


            if (
                !Array.isArray(
                    data
                )
            ) {

                throw new Error(
                    "Supabase no devolvió un arreglo de productos."
                );

            }


            console.log(
                "REST respondió correctamente."
            );

            console.log(
                "Productos encontrados:",
                data.length
            );


            return data;

        }


        /* =====================================================
           MOSTRAR CARGA
        ====================================================== */

        function mostrarEstadoCarga() {

            if (
                !catalogo
            ) {

                return;

            }


            catalogo.innerHTML = `

                <div class="cargando-catalogo">

                    <i class="fa-solid fa-spinner fa-spin"></i>

                    <p>
                        Cargando productos...
                    </p>

                </div>

            `;

        }


        /* =====================================================
           MOSTRAR ERROR
        ====================================================== */

        function mostrarErrorCarga(
            mensaje
        ) {

            if (
                !catalogo
            ) {

                return;

            }


            console.error(
                "No se pudieron cargar los productos:",
                mensaje
            );


            catalogo.innerHTML = `

                <div class="cargando-catalogo">

                    <i class="fa-solid fa-triangle-exclamation"></i>

                    <p>
                        No fue posible cargar los productos.
                    </p>

                    <small>
                        ${escaparHTML(
                            mensaje ||
                            "Error desconocido"
                        )}
                    </small>

                </div>

            `;


            if (
                contadorProductos
            ) {

                contadorProductos.textContent =
                    "0 productos";

            }

        }


        /* =====================================================
           ESCAPAR HTML
        ====================================================== */

        function escaparHTML(
            texto
        ) {

            return String(
                texto || ""
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
           RENDERIZAR PRODUCTOS
        ====================================================== */

        function renderizarProductos(
            lista
        ) {

            if (
                !catalogo
            ) {

                return;

            }


            catalogo.innerHTML =
                "";


            tarjetasProductos =
                [];


            lista.forEach(
                (producto) => {

                    const card =
                        crearTarjetaProducto(
                            producto
                        );


                    if (
                        card
                    ) {

                        catalogo.appendChild(
                            card
                        );

                        tarjetasProductos.push(
                            card
                        );

                    }

                }
            );


            console.log(
                "Tarjetas creadas:",
                tarjetasProductos.length
            );


            tarjetasProductos.forEach(
                (producto) => {

                    const boton =
                        producto.querySelector(
                            ".btn-ver-producto"
                        );


                    if (
                        boton
                    ) {

                        boton.addEventListener(
                            "click",
                            (evento) => {

                                evento.stopPropagation();

                                abrirProducto(
                                    producto
                                );

                            }
                        );

                    }


                    producto.addEventListener(
                        "click",
                        () => {

                            abrirProducto(
                                producto
                            );

                        }
                    );

                }
            );

        }


        /* =====================================================
           CREAR TARJETA
        ====================================================== */

        function crearTarjetaProducto(
            producto
        ) {

            const article =
                document.createElement(
                    "article"
                );

            article.className =
                "producto-card";


            const nombre =
                String(
                    producto.nombre ||
                    "Producto"
                );


            const codigo =
                String(
                    producto.codigo ||
                    "SIN CÓDIGO"
                );


            const categoria =
                normalizarCategoria(
                    producto.categoria ||
                    "otros"
                );


            const descripcion =
                String(
                    producto.descripcion ||
                    "Información del producto no disponible."
                );


            const contraindicaciones =
                String(
                    producto.contraindicaciones ||
                    "No se especificaron contraindicaciones."
                );


            const proveedor =
                String(
                    producto.proveedor ||
                    producto.tag ||
                    ""
                ).trim();


            const caracteristicas =
                String(
                    producto.caracteristicas ||
                    ""
                ).trim();


            const precio =
                producto.precio ??
                "0";


            const imagenes =
                obtenerImagenes(
                    producto.fotos
                );


            const imagenPrincipal =
                imagenes.length > 0
                    ? imagenes[0]
                    : obtenerImagenPlaceholder();


            /* =================================================
               DATOS
            ================================================== */

            article.dataset.categoria =
                categoria;

            article.dataset.nombre =
                nombre;

            article.dataset.codigo =
                codigo;

            article.dataset.precio =
                String(
                    precio
                );

            article.dataset.descripcion =
                descripcion;

            article.dataset.proveedor =
                proveedor;

            article.dataset.caracteristicas =
                caracteristicas;

            article.dataset.contraindicaciones =
                contraindicaciones;


            for (
                let i = 0;
                i < 6;
                i++
            ) {

                article.dataset[
                    `imagen${i + 1}`
                ] =
                    imagenes[i] ||
                    "";

            }


            /* =================================================
               IMAGEN
            ================================================== */

            const contenedorImagen =
                document.createElement(
                    "div"
                );

            contenedorImagen.className =
                "producto-imagen";


            const img =
                document.createElement(
                    "img"
                );

            img.src =
                imagenPrincipal;

            img.alt =
                nombre;

            img.loading =
                "lazy";


            img.onerror =
                () => {

                    if (
                        img.src !==
                        obtenerImagenPlaceholder()
                    ) {

                        img.src =
                            obtenerImagenPlaceholder();

                    }

                };


            const spanCodigo =
                document.createElement(
                    "span"
                );

            spanCodigo.className =
                "producto-codigo";

            spanCodigo.textContent =
                codigo;


            contenedorImagen.appendChild(
                img
            );

            contenedorImagen.appendChild(
                spanCodigo
            );


            /* =================================================
               INFORMACIÓN
            ================================================== */

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "producto-info";


            const h2 =
                document.createElement(
                    "h2"
                );

            h2.textContent =
                nombre;


            /*
             * IMPORTANTE:
             * Este texto es FIJO en la tarjeta.
             * La descripción completa aparece solamente
             * dentro del modal.
             */

            const p =
                document.createElement(
                    "p"
                );

            p.textContent =
                "Producto disponible en catálogo.";


            /* =================================================
               FOOTER
            ================================================== */

            const footer =
                document.createElement(
                    "div"
                );

            footer.className =
                "producto-footer";


            const precioSpan =
                document.createElement(
                    "span"
                );

            precioSpan.className =
                "precio";


            if (
                precio &&
                String(
                    precio
                ) !== "0" &&
                String(
                    precio
                ) !== "null"
            ) {

                precioSpan.textContent =
                    formatearPrecio(
                        precio
                    );

            }


            const boton =
                document.createElement(
                    "button"
                );

            boton.className =
                "btn-ver-producto";

            boton.type =
                "button";

            boton.innerHTML =
                `
                    <i class="fa-solid fa-eye"></i>
                    Ver detalles
                `;


            footer.appendChild(
                precioSpan
            );

            footer.appendChild(
                boton
            );


            info.appendChild(
                h2
            );

            info.appendChild(
                p
            );

            info.appendChild(
                footer
            );


            article.appendChild(
                contenedorImagen
            );

            article.appendChild(
                info
            );


            return article;

        }


        /* =====================================================
           OBTENER IMÁGENES
        ====================================================== */

        function obtenerImagenes(
            fotos
        ) {

            if (
                !fotos
            ) {

                return [];

            }


            let lista =
                fotos;


            if (
                typeof lista === "string"
            ) {

                try {

                    lista =
                        JSON.parse(
                            lista
                        );

                } catch (
                    error
                ) {

                    if (
                        lista.trim() !== ""
                    ) {

                        lista = [
                            lista
                        ];

                    } else {

                        lista = [];

                    }

                }

            }


            if (
                !Array.isArray(
                    lista
                )
            ) {

                return [];

            }


            return lista
                .map(
                    (foto) => {

                        if (
                            typeof foto === "string"
                        ) {

                            return foto.trim();

                        }


                        if (
                            foto &&
                            typeof foto === "object"
                        ) {

                            if (
                                foto.url &&
                                typeof foto.url === "string"
                            ) {

                                return foto.url.trim();

                            }


                            if (
                                foto.path &&
                                typeof foto.path === "string"
                            ) {

                                return obtenerUrlPublica(
                                    foto.path
                                );

                            }

                        }


                        return "";

                    }
                )
                .filter(
                    url =>
                        url !== ""
                )
                .slice(
                    0,
                    6
                );

        }


        /* =====================================================
           STORAGE
        ====================================================== */

        function obtenerUrlPublica(
            path
        ) {

            if (
                !supabaseClient
            ) {

                return "";

            }


            try {

                const resultado =
                    supabaseClient
                        .storage
                        .from(
                            "catalogo-fotos"
                        )
                        .getPublicUrl(
                            path
                        );


                return resultado &&
                    resultado.data &&
                    resultado.data.publicUrl
                    ? resultado.data.publicUrl
                    : "";

            } catch (
                error
            ) {

                console.error(
                    "Error obteniendo URL pública:",
                    error
                );

                return "";

            }

        }


        /* =====================================================
           PLACEHOLDER
        ====================================================== */

        function obtenerImagenPlaceholder() {

            return (
                "https://placehold.co/800x800?text=Sin+imagen"
            );

        }


        /* =====================================================
           NORMALIZAR CATEGORÍA
        ====================================================== */

        function normalizarCategoria(
            categoria
        ) {

            const valor =
                String(
                    categoria || ""
                )
                    .trim()
                    .toLowerCase()
                    .normalize(
                        "NFD"
                    )
                    .replace(
                        /[\u0300-\u036f]/g,
                        ""
                    );


            const equivalencias = {

                todos:
                    "todos",

                bienestar:
                    "bienestar",

                digestivo:
                    "digestivos",

                digestivos:
                    "digestivos",

                articulacion:
                    "articulaciones",

                articulaciones:
                    "articulaciones",

                control:
                    "control",

                urinario:
                    "urinario",

                masculino:
                    "masculino",

                otros:
                    "otros",

                vitamina:
                    "vitaminas",

                vitaminas:
                    "vitaminas",

                suplemento:
                    "suplementos",

                suplementos:
                    "suplementos",

                medicamento:
                    "medicamentos",

                medicamentos:
                    "medicamentos",

                bebida:
                    "bebidas",

                bebidas:
                    "bebidas",

                alimento:
                    "alimentos",

                alimentos:
                    "alimentos"

            };


            return (
                equivalencias[
                    valor
                ] ||
                valor
            );

        }


        /* =====================================================
           ACTUALIZAR CATÁLOGO
        ====================================================== */

        function actualizarCatalogo() {

            let cantidadVisible =
                0;


            tarjetasProductos.forEach(
                (producto) => {

                    const categoria =
                        normalizarCategoria(
                            producto.dataset.categoria ||
                            ""
                        );


                    const nombre =
                        (
                            producto.dataset.nombre ||
                            ""
                        ).toLowerCase();


                    const codigo =
                        (
                            producto.dataset.codigo ||
                            ""
                        ).toLowerCase();


                    const descripcion =
                        (
                            producto.dataset.descripcion ||
                            ""
                        ).toLowerCase();


                    const proveedor =
                        (
                            producto.dataset.proveedor ||
                            ""
                        ).toLowerCase();


                    const caracteristicas =
                        (
                            producto.dataset.caracteristicas ||
                            ""
                        ).toLowerCase();


                    const coincideCategoria =
                        categoriaActual === "todos" ||
                        categoria ===
                            normalizarCategoria(
                                categoriaActual
                            );


                    const coincideBusqueda =
                        textoBusqueda === "" ||
                        nombre.includes(
                            textoBusqueda
                        ) ||
                        codigo.includes(
                            textoBusqueda
                        ) ||
                        descripcion.includes(
                            textoBusqueda
                        ) ||
                        proveedor.includes(
                            textoBusqueda
                        ) ||
                        caracteristicas.includes(
                            textoBusqueda
                        );


                    if (
                        coincideCategoria &&
                        coincideBusqueda
                    ) {

                        producto.style.display =
                            "";

                        cantidadVisible++;

                    } else {

                        producto.style.display =
                            "none";

                    }

                }
            );


            if (
                contadorProductos
            ) {

                contadorProductos.textContent =
                    cantidadVisible === 1
                        ? "1 producto"
                        : `${cantidadVisible} productos`;

            }


            if (
                sinResultados
            ) {

                if (
                    cantidadVisible === 0
                ) {

                    sinResultados.classList.add(
                        "mostrar"
                    );

                } else {

                    sinResultados.classList.remove(
                        "mostrar"
                    );

                }

            }

        }


        /* =====================================================
           ABRIR PRODUCTO
        ====================================================== */

        function abrirProducto(
            producto
        ) {

            if (
                !producto
            ) {

                return;

            }


            productoActual =
                producto;


            const codigo =
                producto.dataset.codigo ||
                "SIN CÓDIGO";


            const nombre =
                producto.dataset.nombre ||
                "Producto";


            const proveedor =
                producto.dataset.proveedor ||
                "Proveedor no especificado";


            const precio =
                producto.dataset.precio ||
                "0";


            const descripcion =
                producto.dataset.descripcion ||
                "Información del producto no disponible.";


            const caracteristicas =
                producto.dataset.caracteristicas ||
                "";


            const contraindicaciones =
                producto.dataset.contraindicaciones ||
                "No se especificaron contraindicaciones.";


            if (
                modalCodigo
            ) {

                modalCodigo.textContent =
                    codigo;

            }


            if (
                modalNombre
            ) {

                modalNombre.textContent =
                    nombre;

            }


            if (
                modalProveedorTexto
            ) {

                modalProveedorTexto.textContent =
                    proveedor;

            } else if (
                modalProveedor
            ) {

                modalProveedor.textContent =
                    proveedor;

            }


            if (
                modalPrecio
            ) {

                if (
                    precio === "0" ||
                    precio === "" ||
                    precio === "null"
                ) {

                    modalPrecio.textContent =
                        "Consultar";

                } else {

                    modalPrecio.textContent =
                        formatearPrecio(
                            precio
                        );

                }

            }


            /* =================================================
               DESCRIPCIÓN COMPLETA
            ================================================== */

            if (
                modalDescripcion
            ) {

                modalDescripcion.textContent =
                    descripcion;

            }


            /* =================================================
               CONTRAINDICACIONES
            ================================================== */

            if (
                modalContraindicaciones
            ) {

                modalContraindicaciones.textContent =
                    contraindicaciones;

            }


            /* =================================================
               CARACTERÍSTICAS
            ================================================== */

            cargarCaracteristicas(
                caracteristicas
            );


            /* =================================================
               IMÁGENES
            ================================================== */

            imagenesProducto = [

                producto.dataset.imagen1,
                producto.dataset.imagen2,
                producto.dataset.imagen3,
                producto.dataset.imagen4,
                producto.dataset.imagen5,
                producto.dataset.imagen6

            ].filter(
                imagen =>
                    imagen &&
                    imagen.trim() !== ""
            );


            if (
                imagenesProducto.length === 0
            ) {

                imagenesProducto = [
                    obtenerImagenPlaceholder()
                ];

            }


            imagenActual =
                0;


            mostrarImagen(
                0
            );


            /* =================================================
               ABRIR MODAL
            ================================================== */

            if (
                modal
            ) {

                modal.classList.add(
                    "activo"
                );

                modal.setAttribute(
                    "aria-hidden",
                    "false"
                );

                document.body.style.overflow =
                    "hidden";

            }

        }


        /* =====================================================
           CARACTERÍSTICAS
        ====================================================== */

        function cargarCaracteristicas(
            texto
        ) {

            if (
                !modalCaracteristicas
            ) {

                return;

            }


            modalCaracteristicas.innerHTML =
                "";


            if (
                !texto ||
                String(
                    texto
                ).trim() === ""
            ) {

                const li =
                    document.createElement(
                        "li"
                    );

                li.textContent =
                    "Consultar información con el vendedor.";


                modalCaracteristicas.appendChild(
                    li
                );

                return;

            }


            const lista =
                String(
                    texto
                )
                    .trim()
                    .split(
                        /\r?\n|\||;|,/
                    )
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(
                        item =>
                            item !== ""
                    );


            if (
                lista.length === 0
            ) {

                const li =
                    document.createElement(
                        "li"
                    );

                li.textContent =
                    "Consultar información con el vendedor.";


                modalCaracteristicas.appendChild(
                    li
                );

                return;

            }


            lista.forEach(
                (caracteristica) => {

                    const li =
                        document.createElement(
                            "li"
                        );

                    li.textContent =
                        caracteristica;


                    modalCaracteristicas.appendChild(
                        li
                    );

                }
            );

        }


        /* =====================================================
           MOSTRAR IMAGEN
        ====================================================== */

        function mostrarImagen(
            indice
        ) {

            if (
                !modalImagenPrincipal ||
                imagenesProducto.length === 0
            ) {

                return;

            }


            if (
                indice < 0
            ) {

                indice =
                    imagenesProducto.length -
                    1;

            }


            if (
                indice >=
                imagenesProducto.length
            ) {

                indice =
                    0;

            }


            imagenActual =
                indice;


            restablecerZoom();


            const imagen =
                imagenesProducto[
                    imagenActual
                ];


            modalImagenPrincipal.src =
                imagen;


            if (
                productoActual
            ) {

                modalImagenPrincipal.alt =
                    productoActual.dataset.nombre ||
                    "Producto";

            }


            miniaturas.forEach(
                (
                    miniatura,
                    indiceMiniatura
                ) => {

                    if (
                        !miniatura
                    ) {

                        return;

                    }


                    const imagenMiniatura =
                        miniatura.querySelector(
                            "img"
                        );


                    if (
                        indiceMiniatura <
                        imagenesProducto.length
                    ) {

                        miniatura.style.display =
                            "";

                        if (
                            imagenMiniatura
                        ) {

                            imagenMiniatura.src =
                                imagenesProducto[
                                    indiceMiniatura
                                ];

                            imagenMiniatura.alt =
                                productoActual
                                    ? `${productoActual.dataset.nombre || "Producto"} - Vista ${indiceMiniatura + 1}`
                                    : `Vista ${indiceMiniatura + 1}`;

                        }


                        if (
                            indiceMiniatura ===
                            imagenActual
                        ) {

                            miniatura.classList.add(
                                "activa"
                            );

                        } else {

                            miniatura.classList.remove(
                                "activa"
                            );

                        }

                    } else {

                        miniatura.style.display =
                            "none";

                        miniatura.classList.remove(
                            "activa"
                        );


                        if (
                            imagenMiniatura
                        ) {

                            imagenMiniatura.removeAttribute(
                                "src"
                            );

                        }

                    }

                }
            );


            if (
                imagenAnterior
            ) {

                imagenAnterior.style.display =
                    imagenesProducto.length > 1
                        ? ""
                        : "none";

            }


            if (
                imagenSiguiente
            ) {

                imagenSiguiente.style.display =
                    imagenesProducto.length > 1
                        ? ""
                        : "none";

            }

        }


        /* =====================================================
           ZOOM
        ====================================================== */

        function aplicarZoom() {

            if (
                !modalImagenPrincipal
            ) {

                return;

            }


            modalImagenPrincipal.style.transform =
                `scale(${nivelZoom})`;

            modalImagenPrincipal.style.transformOrigin =
                "center center";

            modalImagenPrincipal.style.transition =
                "transform 0.2s ease";

            modalImagenPrincipal.style.cursor =
                nivelZoom > 1
                    ? "zoom-out"
                    : "zoom-in";

        }


        function cambiarZoom(
            cantidad
        ) {

            nivelZoom =
                Math.min(
                    zoomMaximo,
                    Math.max(
                        zoomMinimo,
                        nivelZoom +
                            cantidad
                    )
                );


            aplicarZoom();

        }


        function restablecerZoom() {

            nivelZoom =
                1;

            aplicarZoom();

        }


        /* =====================================================
           BOTÓN ZOOM +
        ====================================================== */

        if (
            btnZoomMas
        ) {

            btnZoomMas.addEventListener(
                "click",
                (evento) => {

                    evento.stopPropagation();

                    cambiarZoom(
                        pasoZoom
                    );

                }
            );

        }


        /* =====================================================
           BOTÓN ZOOM -
        ====================================================== */

        if (
            btnZoomMenos
        ) {

            btnZoomMenos.addEventListener(
                "click",
                (evento) => {

                    evento.stopPropagation();

                    cambiarZoom(
                        -pasoZoom
                    );

                }
            );

        }


        /* =====================================================
           BOTÓN ZOOM RESET
        ====================================================== */

        if (
            btnZoomReset
        ) {

            btnZoomReset.addEventListener(
                "click",
                (evento) => {

                    evento.stopPropagation();

                    restablecerZoom();

                }
            );

        }


        /* =====================================================
           ZOOM CON RUEDA
        ====================================================== */

        if (
            modalImagenPrincipal
        ) {

            modalImagenPrincipal.addEventListener(
                "wheel",
                (evento) => {

                    evento.preventDefault();

                    evento.stopPropagation();


                    if (
                        evento.deltaY < 0
                    ) {

                        cambiarZoom(
                            pasoZoom
                        );

                    } else {

                        cambiarZoom(
                            -pasoZoom
                        );

                    }

                },
                {
                    passive:
                        false
                }
            );

        }


        /* =====================================================
           DOBLE CLICK
        ====================================================== */

        if (
            modalImagenPrincipal
        ) {

            modalImagenPrincipal.addEventListener(
                "dblclick",
                (evento) => {

                    evento.preventDefault();

                    evento.stopPropagation();


                    nivelZoom =
                        nivelZoom === 1
                            ? 2
                            : 1;


                    aplicarZoom();

                }
            );

        }


        /* =====================================================
           IMAGEN ANTERIOR
        ====================================================== */

        if (
            imagenAnterior
        ) {

            imagenAnterior.addEventListener(
                "click",
                (evento) => {

                    evento.stopPropagation();


                    if (
                        imagenesProducto.length <= 1
                    ) {

                        return;

                    }


                    mostrarImagen(
                        imagenActual -
                            1
                    );

                }
            );

        }


        /* =====================================================
           IMAGEN SIGUIENTE
        ====================================================== */

        if (
            imagenSiguiente
        ) {

            imagenSiguiente.addEventListener(
                "click",
                (evento) => {

                    evento.stopPropagation();


                    if (
                        imagenesProducto.length <= 1
                    ) {

                        return;

                    }


                    mostrarImagen(
                        imagenActual +
                            1
                    );

                }
            );

        }


        /* =====================================================
           MINIATURAS
        ====================================================== */

        miniaturas.forEach(
            (
                miniatura,
                indice
            ) => {

                if (
                    !miniatura
                ) {

                    return;

                }


                miniatura.addEventListener(
                    "click",
                    (evento) => {

                        evento.stopPropagation();


                        if (
                            indice >=
                            imagenesProducto.length
                        ) {

                            return;

                        }


                        mostrarImagen(
                            indice
                        );

                    }
                );

            }
        );


        /* =====================================================
           CERRAR MODAL
        ====================================================== */

        function cerrarVentanaProducto() {

            if (
                !modal
            ) {

                return;

            }


            modal.classList.remove(
                "activo"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );

            document.body.style.overflow =
                "";

            productoActual =
                null;

            restablecerZoom();

        }


        if (
            cerrarModal
        ) {

            cerrarModal.addEventListener(
                "click",
                cerrarVentanaProducto
            );

        }


        /* =====================================================
           CERRAR HACIENDO CLICK FUERA
        ====================================================== */

        if (
            modal
        ) {

            modal.addEventListener(
                "click",
                (evento) => {

                    if (
                        evento.target ===
                        modal
                    ) {

                        cerrarVentanaProducto();

                    }

                }
            );

        }


        /* =====================================================
           ESCAPE
        ====================================================== */

        document.addEventListener(
            "keydown",
            (evento) => {

                if (
                    evento.key === "Escape" &&
                    modal &&
                    modal.classList.contains(
                        "activo"
                    )
                ) {

                    cerrarVentanaProducto();

                }

            }
        );


        /* =====================================================
           TECLADO GALERÍA
        ====================================================== */

        document.addEventListener(
            "keydown",
            (evento) => {

                if (
                    !modal ||
                    !modal.classList.contains(
                        "activo"
                    )
                ) {

                    return;

                }


                if (
                    evento.key === "ArrowLeft"
                ) {

                    mostrarImagen(
                        imagenActual -
                            1
                    );

                }


                if (
                    evento.key === "ArrowRight"
                ) {

                    mostrarImagen(
                        imagenActual +
                            1
                    );

                }

            }
        );


        /* =====================================================
           SWIPE
        ====================================================== */

        let posicionInicioX =
            0;

        let posicionFinalX =
            0;


        if (
            modalImagenPrincipal
        ) {

            modalImagenPrincipal.addEventListener(
                "touchstart",
                (evento) => {

                    posicionInicioX =
                        evento.touches[0].clientX;

                },
                {
                    passive:
                        true
                }
            );


            modalImagenPrincipal.addEventListener(
                "touchend",
                (evento) => {

                    posicionFinalX =
                        evento.changedTouches[0].clientX;

                    manejarSwipe();

                },
                {
                    passive:
                        true
                }
            );

        }


        function manejarSwipe() {

            const diferencia =
                posicionFinalX -
                posicionInicioX;


            if (
                Math.abs(
                    diferencia
                ) < 50
            ) {

                return;

            }


            if (
                diferencia < 0
            ) {

                mostrarImagen(
                    imagenActual +
                        1
                );

            } else {

                mostrarImagen(
                    imagenActual -
                        1
                );

            }

        }


        /* =====================================================
           FORMATEAR PRECIO
        ====================================================== */

        function formatearPrecio(
            valor
        ) {

            const numero =
                Number(
                    valor
                );


            if (
                isNaN(
                    numero
                )
            ) {

                return "Consultar";

            }


            return new Intl.NumberFormat(
                "es-GT",
                {
                    style:
                        "currency",

                    currency:
                        "GTQ",

                    minimumFractionDigits:
                        2

                }
            ).format(
                numero
            );

        }

    }
);