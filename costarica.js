"use strict";

/* =========================================================
   MENSAJERÍA EXPRESS
   ÁREA DE COBERTURAS - COSTA RICA
   (7 provincias + cantones)

   FUNCIONES:
   - Provincias / Cantones
   - Pintar manual, Círculo, Rectángulo, Polígono
   - Borrador circular por partes
   - Editar / Eliminar
   - Guardar / cargar
   - Deshacer / rehacer
   - Buscador y lista de provincias

   MAPA: #mapaCostaRica (si no existe, usa #mapaNicaragua)

   NOTA: los IDs del HTML se mantienen iguales
   (buscarDepartamento, listaDepartamentos, totalDepartamentos,
   btnPintarMunicipios, etc.) para que no tengas que cambiar tu HTML.
========================================================= */


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CONFIG = {

    mapaId: "mapaCostaRica",
    mapaIdAlterno: "mapaNicaragua",

    centro: [9.7489, -83.7534],

    zoomInicial: 8,

    zoomMaximoBusqueda: 17,

    limiteBusqueda: 50,

    maxHistorial: 50,

    pasosCirculo: 64,
    pasosBuffer: 8,
    anchoPintadoMetros: 1500,

    totalProvinciasEsperado: 7,

    /* Incluye Isla del Coco */
    bbox: [-87.30, 5.30, -82.40, 11.30],

    urls: {

        provincias: [
            "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/CRI/ADM1/geoBoundaries-CRI-ADM1_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CRI/ADM1/geoBoundaries-CRI-ADM1_simplified.geojson"
        ],

        cantones: [
            "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/CRI/ADM2/geoBoundaries-CRI-ADM2_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CRI/ADM2/geoBoundaries-CRI-ADM2_simplified.geojson"
        ],

        nominatim: "https://nominatim.openstreetmap.org/search"
    }
};


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_ZONAS =
    "mensajeriaExpressZonasCoberturaCostaRica";

const STORAGE_CANTONES =
    "mensajeriaExpressCantonesCoberturaCostaRica";


/* =========================================================
   SISTEMA DE PERMISOS DE EDICIÓN
   Login Central: Supabase storageKey "mensajeria-intranet-auth"
   También utiliza sessionStorage "usuarioIntranet".
   Solo los correos indicados pueden modificar.
   (Agrega o cambia aquí los correos autorizados para Costa Rica.)
========================================================= */

const USUARIOS_AUTORIZADOS = [
    "supervisor.sac@webcorpbusiness.com",
    "coordinacion.operaciones.meg@webcorpbusiness.com",
    "andresquiroa@gmail.com",
    "dalessgarcia@gmail.com",
    "coordinacion.operaciones.gt@webcorpbusiness.com"
].map(correo => correo.toLowerCase());

let PUEDE_EDITAR_MAPA = false;
let CORREO_USUARIO_ACTUAL = "";
let PERMISOS_INICIALIZADOS = false;
let SUSCRIPCION_AUTH_PERMISOS = null;

function correoDesdeObjetoSesion(objeto) {
    if (!objeto || typeof objeto !== "object") return "";

    const candidatos = [
        objeto.email,
        objeto.user?.email,
        objeto.session?.user?.email,
        objeto.data?.session?.user?.email,
        objeto.currentSession?.user?.email,
        objeto.usuario?.email,
        objeto.usuario?.correo,
        objeto.correo
    ];

    for (const candidato of candidatos) {
        if (typeof candidato === "string" && candidato.includes("@")) {
            return candidato.trim().toLowerCase();
        }
    }

    return "";
}

function leerCorreoGuardado() {
    // Formato de usuario que guarda el Login Central.
    try {
        const usuarioIntranet = sessionStorage.getItem("usuarioIntranet");
        if (usuarioIntranet) {
            const correo = correoDesdeObjetoSesion(JSON.parse(usuarioIntranet));
            if (correo) return correo;
        }
    } catch (error) {
        console.warn("No se pudo leer usuarioIntranet:", error);
    }

    // Sesión persistida por Supabase con storageKey personalizado.
    try {
        const sesion = localStorage.getItem("mensajeria-intranet-auth");
        if (sesion) {
            const correo = correoDesdeObjetoSesion(JSON.parse(sesion));
            if (correo) return correo;
        }
    } catch (error) {
        console.warn("No se pudo leer la sesión guardada:", error);
    }

    return "";
}

function actualizarPermisoPorCorreo(correo) {
    CORREO_USUARIO_ACTUAL = String(correo || "").trim().toLowerCase();
    PUEDE_EDITAR_MAPA = USUARIOS_AUTORIZADOS.includes(CORREO_USUARIO_ACTUAL);

    if (!PUEDE_EDITAR_MAPA && mapa) {
        detenerTodasLasHerramientas();
        bloquearGeomanParaConsulta();
    }

    actualizarInterfazPermisos();

    console.log(
        "[COBERTURAS] Usuario:",
        CORREO_USUARIO_ACTUAL || "(sin sesión detectada)",
        "| Permiso:",
        PUEDE_EDITAR_MAPA ? "EDICIÓN" : "SOLO CONSULTA"
    );
}

async function inicializarPermisosMapa() {
    let correo = "";
    let clienteDetectado = false;

    // Preferir siempre la sesión viva del cliente Supabase del Login Central.
    try {
        let cliente = null;

        // El Login Central declara const supabaseClient en el ámbito global
        // de los scripts clásicos, aunque no lo publique en window.
        if (typeof supabaseClient !== "undefined") {
            cliente = supabaseClient;
        } else if (window.supabaseClient) {
            cliente = window.supabaseClient;
        }

        if (cliente?.auth?.getSession) {
            clienteDetectado = true;
            const respuesta = await cliente.auth.getSession();
            correo = respuesta?.data?.session?.user?.email || "";
            if (respuesta?.error) {
                console.warn("No se pudo consultar la sesión Supabase:", respuesta.error);
            }
        }

        if (cliente?.auth?.onAuthStateChange && !SUSCRIPCION_AUTH_PERMISOS) {
            const suscripcion = cliente.auth.onAuthStateChange((_evento, sesion) => {
                actualizarPermisoPorCorreo(sesion?.user?.email || "");

                if (!PUEDE_EDITAR_MAPA) {
                    bloquearGeomanParaConsulta();
                }
            });

            SUSCRIPCION_AUTH_PERMISOS =
                suscripcion?.data?.subscription || suscripcion?.subscription || true;
        }
    } catch (error) {
        console.error("Error consultando autenticación Supabase:", error);
    }

    // Si el cliente Supabase está disponible, una sesión nula significa
    // que no hay usuario autenticado: no aceptar datos de sesión antiguos.
    // Si el cliente no está expuesto por el Login Central, usar su usuarioIntranet.
    if (!clienteDetectado && !correo) correo = leerCorreoGuardado();

    actualizarPermisoPorCorreo(correo);
    PERMISOS_INICIALIZADOS = true;

    return PUEDE_EDITAR_MAPA;
}

function exigirPermisoEdicion() {
    // No confiar en el correo escrito en un campo ni en el área del usuario.
    if (!PERMISOS_INICIALIZADOS || !PUEDE_EDITAR_MAPA) {
        notificar(
            "Acceso de solo consulta",
            "Tu cuenta no tiene autorización para modificar las coberturas.",
            "warning"
        );
        return false;
    }

    return true;
}

const BOTONES_SOLO_EDICION = [
    "btnNuevaZona",
    "btnPintar",
    "btnBorradorCircular",
    "btnCirculo",
    "btnRectangulo",
    "btnPoligono",
    "btnBorrador",
    "btnEditarZonas",
    "btnEliminarZonas",
    "btnGuardarZona",
    "btnGuardarTodo",
    "btnLimpiarTodo",
    "btnDeshacer",
    "btnRehacer"
];

function actualizarInterfazPermisos() {
    BOTONES_SOLO_EDICION.forEach(id => {
        const boton = document.getElementById(id);
        if (!boton) return;

        boton.disabled = !PUEDE_EDITAR_MAPA;
        boton.setAttribute("aria-disabled", String(!PUEDE_EDITAR_MAPA));
        boton.style.opacity = PUEDE_EDITAR_MAPA ? "" : "0.45";
        boton.style.cursor = PUEDE_EDITAR_MAPA ? "" : "not-allowed";
        boton.title = PUEDE_EDITAR_MAPA
            ? "Edición autorizada"
            : "Disponible solo para los usuarios autorizados";
    });

    // Los controles de nivel se mantienen habilitados para CONSULTAR
    // departamentos y municipios; no conceden permiso de edición.
    [
        "btnPintarMunicipios",
        "btnPintarProvincias",
        "btnPintarDepartamentos"
    ].forEach(id => {
        const boton = document.getElementById(id);
        if (boton) {
            boton.disabled = false;
            boton.removeAttribute("aria-disabled");
            boton.style.opacity = "";
            boton.style.cursor = "";
            boton.title = "Cambiar nivel de visualización";
        }
    });

    const estado = document.getElementById("estadoPermisos");
    if (estado) {
        estado.textContent = PUEDE_EDITAR_MAPA
            ? "Usuario autorizado para editar"
            : "Modo consulta: solo lectura";
    }
}

function bloquearGeomanParaConsulta() {
    if (!mapa) return;

    try {
        mapa.pm?.disableDraw?.();
        mapa.pm?.disableGlobalEditMode?.();
        mapa.pm?.disableGlobalRemovalMode?.();
        mapa.pm?.disableGlobalDragMode?.();
        mapa.pm?.disableGlobalRotateMode?.();
    } catch (error) {
        console.warn("No se pudieron desactivar herramientas Geoman:", error);
    }

    try {
        if (grupoCoberturas) {
            grupoCoberturas.eachLayer(layer => {
                try {
                    layer.pm?.disable?.();
                    layer.pm?.disableLayerDrag?.();
                } catch (_) {}
            });
        }
    } catch (_) {}
}




/* =========================================================
   PROVINCIAS OFICIALES DE COSTA RICA
========================================================= */

const PROVINCIAS_OFICIALES = [
    "Alajuela",
    "Cartago",
    "Guanacaste",
    "Heredia",
    "Limón",
    "Puntarenas",
    "San José"
];

/* Nombre sin tildes -> nombre oficial con tildes */
const NOMBRES_VISIBLES = {};

PROVINCIAS_OFICIALES.forEach(nombre => {
    NOMBRES_VISIBLES[normalizarTextoClave(nombre)] = nombre;
});


/* =========================================================
   VARIABLES
========================================================= */

let mapa = null;
let capaProvincias = null;
let capaCantones = null;
let grupoCoberturas = null;
let grupoMarcadoresBusqueda = null;

let provinciasData = null;
let cantonesData = null;

let zonaSeleccionada = null;
let herramientaActiva = "ninguna";

/* "provincias" | "cantones" */
let nivelActivo = "provincias";

let historial = [];
let indiceHistorial = -1;
let guardandoHistorial = false;
let cargandoEstado = false;

let debounceBusqueda = null;

let dibujandoLinea = false;
let puntosLinea = [];
let mouseMoveLineaHandler = null;
let mouseUpLineaHandler = null;

let mascaraCostaRica = null;
let ultimaEdicion = 0;

let controladorBusqueda = null;
let numeroSolicitudBusqueda = 0;
let ultimaBusqueda = "";
let marcadorSeleccionado = null;


/* =========================================================
   UTILIDADES DE TEXTO
========================================================= */

function normalizarTextoClave(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function nombreVisibleProvincia(nombre) {

    const clave = normalizarTextoClave(nombre);

    return NOMBRES_VISIBLES[clave] || nombre;
}

function esProvinciaOficial(nombre) {
    return Boolean(
        NOMBRES_VISIBLES[normalizarTextoClave(nombre)]
    );
}


/* =========================================================
   INICIO
========================================================= */

document.addEventListener("DOMContentLoaded", iniciarSistema);

async function iniciarSistema() {

    try {

        verificarDependencias();
        verificarMapaHTML();
        crearMapa();
        await inicializarPermisosMapa();
        configurarEventosInterfaz();
        configurarEventosMapa();
        configurarTeclado();
        cargarEstadoGuardado();

        await cargarGeografia();

        actualizarListaDepartamentos();
        actualizarInterfazHerramienta();
        actualizarEstadoMapa();
        guardarEstadoInicialHistorial();

        notificar(
            "Sistema listo",
            "El mapa de Costa Rica está preparado.",
            "success"
        );

    } catch (error) {

        console.error("Error al iniciar:", error);

        notificar(
            "Error de inicio",
            error.message || "No se pudo iniciar el mapa.",
            "error"
        );
    }
}


/* =========================================================
   DEPENDENCIAS
========================================================= */

function verificarDependencias() {

    if (typeof L === "undefined") {
        throw new Error("Leaflet no está cargado.");
    }

    if (typeof turf === "undefined") {
        throw new Error("Turf.js no está cargado.");
    }

    if (!L.PM && !L.pm) {
        throw new Error("Leaflet-Geoman no está cargado.");
    }
}

function verificarMapaHTML() {

    if (document.getElementById(CONFIG.mapaId)) {
        return;
    }

    if (document.getElementById(CONFIG.mapaIdAlterno)) {
        CONFIG.mapaId = CONFIG.mapaIdAlterno;
        return;
    }

    throw new Error(
        "No existe #mapaCostaRica (ni #mapaNicaragua) en el HTML."
    );
}


/* =========================================================
   CREAR MAPA
========================================================= */

function crearMapa() {

    mapa = L.map(CONFIG.mapaId, {
        center: CONFIG.centro,
        zoom: CONFIG.zoomInicial,
        zoomControl: true,
        preferCanvas: true
    });

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(mapa);

    grupoCoberturas = L.geoJSON(null, {
        style: estiloCobertura,
        onEachFeature: configurarFeatureCobertura
    }).addTo(mapa);

    grupoMarcadoresBusqueda = L.featureGroup().addTo(mapa);

    configurarGeoman();
    actualizarInteraccionCapas();
}


/* =========================================================
   GEOMAN
========================================================= */

function configurarGeoman() {

    const pm = mapa.pm || mapa.PM;

    if (!pm) {
        return;
    }

    try {
        pm.setGlobalOptions({
            snappable: false,
            allowSelfIntersection: false
        });
    } catch (error) {
        console.warn("No se pudieron establecer opciones Geoman.", error);
    }

    mapa.on("pm:create", manejarCreacionGeoman);
    mapa.on("pm:edit", manejarEdicionGeoman);
}


function manejarCreacionGeoman(evento) {

    if (!exigirPermisoEdicion()) { try { evento?.layer?.remove(); } catch (_) {} return; }


    if (!evento || !evento.layer) {
        return;
    }

    const layer = evento.layer;
    const herramienta = herramientaActiva;

    if (herramienta === "borrador") {
        manejarBorradorGeoman(layer);
        return;
    }

    if (
        herramienta !== "circulo" &&
        herramienta !== "rectangulo" &&
        herramienta !== "poligono"
    ) {
        try { layer.remove(); } catch (_) {}
        return;
    }

    const geojson = convertirLayerAGeoJSON(layer);

    try { layer.remove(); } catch (_) {}

    if (!geojson) {
        notificar("Error", "No se pudo obtener la geometría.", "error");
        return;
    }

    procesarNuevaGeometria(geojson, herramienta);
}


function manejarEdicionGeoman() {

    if (!exigirPermisoEdicion()) { bloquearGeomanParaConsulta(); return; }


    if (herramientaActiva !== "editar") {
        return;
    }

    const ahora = Date.now();

    if (ahora - ultimaEdicion < 250) {
        return;
    }

    ultimaEdicion = ahora;

    guardarGeometriasEditadas();
}


function guardarGeometriasEditadas() {

    if (!exigirPermisoEdicion()) return;


    if (!grupoCoberturas) {
        return;
    }

    const features = grupoCoberturas.toGeoJSON().features;

    if (!features.length) {
        guardarEstado();
        guardarHistorial();
        return;
    }

    const actuales = obtenerCoberturas();

    const resultado = actuales.map(cobertura => {

        const encontrada = features.find(
            f =>
                f.properties &&
                cobertura.properties &&
                f.properties.id === cobertura.properties.id
        );

        if (!encontrada) {
            return cobertura;
        }

        return {
            type: "Feature",
            properties: Object.assign({}, cobertura.properties),
            geometry: encontrada.geometry
        };
    });

    reemplazarCoberturas(resultado);

    guardarEstado();
    guardarHistorial();

    }


/* =========================================================
   CONVERTIR LAYER
========================================================= */

function convertirLayerAGeoJSON(layer) {

    if (!layer) {
        return null;
    }

    if (
        typeof L.Circle !== "undefined" &&
        layer instanceof L.Circle
    ) {

        const centro = layer.getLatLng();
        const radio = layer.getRadius();

        return turf.circle(
            [centro.lng, centro.lat],
            radio / 1000,
            {
                steps: CONFIG.pasosCirculo,
                units: "kilometers"
            }
        );
    }

    if (typeof layer.toGeoJSON === "function") {
        return layer.toGeoJSON();
    }

    return null;
}


function geometriaValida(feature) {

    if (!feature || !feature.geometry) {
        return false;
    }

    return [
        "Polygon",
        "MultiPolygon",
        "LineString",
        "MultiLineString",
        "Point"
    ].includes(feature.geometry.type);
}


/* =========================================================
   INTERSECCIÓN / RECORTE CON COSTA RICA
========================================================= */

function geometriaIntersecaCostaRica(feature) {

    if (!feature) {
        return false;
    }

    const b = CONFIG.bbox;

    try {

        const bbox = turf.bbox(feature);

        const fuera =
            bbox[2] < b[0] ||
            bbox[0] > b[2] ||
            bbox[3] < b[1] ||
            bbox[1] > b[3];

        if (fuera) {
            return false;
        }

    } catch (_) {}

    if (
        !provinciasData ||
        !Array.isArray(provinciasData.features) ||
        provinciasData.features.length === 0
    ) {
        return true;
    }

    for (const provincia of provinciasData.features) {

        try {
            if (turf.booleanIntersects(feature, provincia)) {
                return true;
            }
        } catch (_) {}
    }

    return false;
}


function recortarACostaRica(feature) {

    if (!feature) {
        return null;
    }

    if (
        !provinciasData ||
        !Array.isArray(provinciasData.features) ||
        provinciasData.features.length === 0
    ) {
        return feature;
    }

    const partes = [];

    for (const provincia of provinciasData.features) {

        try {

            if (!turf.booleanIntersects(feature, provincia)) {
                continue;
            }

            const interseccion = intersectarTurf(feature, provincia);

            if (interseccion) {
                partes.push(interseccion);
            }

        } catch (_) {}
    }

    if (!partes.length) {
        return null;
    }

    if (partes.length === 1) {
        return partes[0];
    }

    return unirFeatures(partes);
}


function intersectarTurf(a, b) {

    if (!a || !b || typeof turf.intersect !== "function") {
        return null;
    }

    try {
        const resultado = turf.intersect(turf.featureCollection([a, b]));
        if (resultado) {
            return resultado;
        }
    } catch (_) {}

    try {
        const resultado = turf.intersect(a, b);
        if (resultado) {
            return resultado;
        }
    } catch (_) {}

    return null;
}


function unirFeatures(features) {

    if (!features || !features.length) {
        return null;
    }

    if (features.length === 1) {
        return features[0];
    }

    try {

        const geometries = features
            .map(f => f.geometry)
            .filter(Boolean);

        if (!geometries.length) {
            return null;
        }

        const poligonos = [];

        geometries.forEach(g => {

            if (g.type === "Polygon") {
                poligonos.push(g.coordinates);
            } else if (g.type === "MultiPolygon") {
                g.coordinates.forEach(p => poligonos.push(p));
            }
        });

        if (!poligonos.length) {
            return null;
        }

        return {
            type: "Feature",
            properties: {},
            geometry: {
                type: "MultiPolygon",
                coordinates: poligonos
            }
        };

    } catch (error) {

        console.error("Error uniendo geometrías:", error);

        return features[0];
    }
}


/* =========================================================
   PROCESAR NUEVA GEOMETRÍA
========================================================= */

function procesarNuevaGeometria(geojson, herramienta) {

    if (!exigirPermisoEdicion()) return;


    if (!geometriaValida(geojson)) {
        notificar("Geometría inválida", "La zona dibujada no es válida.", "error");
        return;
    }

    if (!geometriaIntersecaCostaRica(geojson)) {
        notificar("Fuera de Costa Rica", "La zona debe estar dentro de Costa Rica.", "warning");
        return;
    }

    const geometriaFinal = recortarACostaRica(geojson);

    if (!geometriaFinal) {
        notificar("Zona inválida", "No hay área dentro de Costa Rica.", "warning");
        return;
    }

    crearCobertura(geometriaFinal, herramienta);
}


/* =========================================================
   COLOR Y ESTILO
========================================================= */

function obtenerColorCobertura(tipo) {

    const valor = String(tipo || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_-]+/g, "");

    if (valor === "mismodia" || valor === "sameday") {
        return "#22c55e";
    }

    if (
        valor === "siguientedia" ||
        valor === "diasiguiente" ||
        valor === "nextday" ||
        valor === "next"
    ) {
        return "#3b82f6";
    }

    if (valor === "72horas" || valor === "72h") {
        return "#ef4444";
    }

    if (valor === "nocobertura" || valor === "sincobertura") {
        return "#94a3b8";
    }

    if (valor === "alto") {
        return "#f59e0b";
    }

    return "#22c55e";
}


function estiloCobertura(feature) {

    const props =
        feature && feature.properties ? feature.properties : {};

    const color = obtenerColorCobertura(props.tipo);

    const estado = String(props.estado || "activa").toLowerCase();

    return {
        color: color,
        weight: estado === "inactiva" ? 2 : 3,
        opacity: estado === "inactiva" ? 0.45 : 0.95,
        fillColor: color,
        fillOpacity: estado === "inactiva" ? 0.08 : 0.35
    };
}


/* =========================================================
   CREAR COBERTURA (dibujo manual / figuras)
========================================================= */

function crearCobertura(geometria, herramienta) {

    if (!exigirPermisoEdicion()) return;


    if (!geometria) {
        return null;
    }

    const feature = {
        type: "Feature",
        properties: {
            id: generarId(),
            nombre: obtenerNombreFormulario(herramienta),
            tipo: obtenerTipoFormulario(),
            estado: obtenerEstadoFormulario(),
            herramienta: herramienta,

            /* Las figuras dibujadas NO son ni provincia ni cantón */
            nivel: "manual",

            fecha: new Date().toISOString()
        },
        geometry: geometria.geometry
    };

    reemplazarCoberturas(obtenerCoberturas().concat(feature));

    zonaSeleccionada = feature.properties.id;

    cargarDatosZonaFormulario(feature);

    guardarEstado();
    guardarHistorial();

    notificar("Cobertura creada", "La zona se pintó correctamente.", "success");

    return feature;
}


function obtenerCoberturas() {

    if (!grupoCoberturas) {
        return [];
    }

    try {
        return grupoCoberturas.toGeoJSON().features || [];
    } catch (_) {
        return [];
    }
}


function reemplazarCoberturas(features) {

    if (!grupoCoberturas) {
        return;
    }

    grupoCoberturas.clearLayers();

    if (features && features.length) {
        grupoCoberturas.addData({
            type: "FeatureCollection",
            features: features
        });
    }

    actualizarInteraccionCapas();
}


function configurarFeatureCobertura(feature, layer) {

    if (!layer) {
        return;
    }

    layer.feature = feature;

    layer.on("click", function (evento) {

        L.DomEvent.stopPropagation(evento);

        if (herramientaActiva === "eliminar") {
            eliminarCobertura(feature);
            return;
        }

        if (herramientaActiva === "borrador") {
            return;
        }

        seleccionarCobertura(feature, layer);
    });

    layer.on("mouseover", function () {

        if (herramientaActiva === "eliminar") {
            layer.setStyle({ weight: 5 });
        }
    });

    layer.on("mouseout", function () {
        layer.setStyle(estiloCobertura(feature));
    });
}


function seleccionarCobertura(feature, layer) {

    if (!feature) {
        return;
    }

    zonaSeleccionada =
        feature.properties && feature.properties.id
            ? feature.properties.id
            : null;

    cargarDatosZonaFormulario(feature);

    if (layer && layer.setStyle) {
        layer.setStyle({ weight: 5 });
    }

    notificar("Cobertura seleccionada", "Puedes editar sus datos.", "info");
}


/* =========================================================
   FORMULARIO
========================================================= */

function cargarDatosZonaFormulario(feature) {

    const props =
        feature && feature.properties ? feature.properties : {};

    establecerValor("nombreZona", props.nombre || "");
    establecerValor("tipoCobertura", props.tipo || "mismoDia");
    establecerValor("estadoCobertura", props.estado || "activa");
}

function establecerValor(id, valor) {

    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.value = valor;
    }
}

function obtenerValor(id, defecto) {

    const elemento = document.getElementById(id);

    if (!elemento) {
        return defecto;
    }

    return elemento.value || defecto;
}

function obtenerNombreFormulario() {

    const nombre = obtenerValor("nombreZona", "").trim();

    return nombre || "Nueva cobertura";
}

function obtenerTipoFormulario() {
    return obtenerValor("tipoCobertura", "mismoDia");
}

function obtenerEstadoFormulario() {
    return obtenerValor("estadoCobertura", "activa");
}


/* =========================================================
   GUARDAR ZONA SELECCIONADA
========================================================= */

function guardarZonaSeleccionada() {

    if (!exigirPermisoEdicion()) return;


    if (!zonaSeleccionada) {
        notificar("Sin selección", "Selecciona primero una cobertura.", "warning");
        return;
    }

    const features = obtenerCoberturas();

    const indice = features.findIndex(
        f =>
            f.properties &&
            f.properties.id === zonaSeleccionada
    );

    if (indice === -1) {
        return;
    }

    features[indice].properties.nombre =
        obtenerValor("nombreZona", "Nueva cobertura");

    features[indice].properties.tipo = obtenerTipoFormulario();
    features[indice].properties.estado = obtenerEstadoFormulario();

    reemplazarCoberturas(features);

    guardarEstado();
    guardarHistorial();

    notificar("Guardado", "La cobertura fue actualizada.", "success");
}


/* =========================================================
   ELIMINAR COBERTURA COMPLETA
========================================================= */

function eliminarCobertura(feature) {

    if (!exigirPermisoEdicion()) return;


    if (!feature) {
        return;
    }

    const id = feature.properties && feature.properties.id;

    if (!id) {
        return;
    }

    const nuevas = obtenerCoberturas().filter(
        f => !(f.properties && f.properties.id === id)
    );

    reemplazarCoberturas(nuevas);

    if (zonaSeleccionada === id) {
        zonaSeleccionada = null;
    }

    guardarEstado();
    guardarHistorial();
    actualizarInterfazHerramienta();

    notificar("Cobertura eliminada", "La cobertura completa fue eliminada.", "success");
}


/* =========================================================
   BORRADOR CIRCULAR
========================================================= */

function manejarBorradorGeoman(layer) {

    if (!exigirPermisoEdicion()) { try { layer?.remove(); } catch (_) {} return; }


    const geometria = convertirLayerAGeoJSON(layer);

    try { layer.remove(); } catch (_) {}

    if (!geometria) {
        notificar("Error", "No se pudo crear el borrador.", "error");
        return;
    }

    borrarParcialConGeometria(geometria);
}


function borrarParcialConGeometria(geometriaBorrador) {

    if (!exigirPermisoEdicion()) return;


    if (!geometriaBorrador) {
        return;
    }

    const coberturas = obtenerCoberturas();

    if (!coberturas.length) {
        notificar("Sin coberturas", "No hay coberturas para borrar.", "warning");
        return;
    }

    const nuevasCoberturas = [];

    let modificadas = 0;
    let eliminadas = 0;

    for (const feature of coberturas) {

        if (!feature || !feature.geometry) {
            continue;
        }

        let intersecta = false;

        try {
            intersecta = turf.booleanIntersects(feature, geometriaBorrador);
        } catch (_) {
            intersecta = false;
        }

        if (!intersecta) {
            nuevasCoberturas.push(feature);
            continue;
        }

        const diferencia = diferenciaTurf(feature, geometriaBorrador);

        if (
            !diferencia ||
            !diferencia.geometry ||
            geometriaVacia(diferencia)
        ) {

                        eliminadas++;
            continue;
        }

        nuevasCoberturas.push({
            type: "Feature",
            properties: Object.assign({}, feature.properties),
            geometry: diferencia.geometry
        });

        modificadas++;
    }

    if (modificadas === 0 && eliminadas === 0) {
        notificar("Sin cambios", "El círculo no tocó ninguna cobertura.", "info");
        return;
    }

    reemplazarCoberturas(nuevasCoberturas);

    if (zonaSeleccionada) {

        const sigue = nuevasCoberturas.some(
            f =>
                f.properties &&
                f.properties.id === zonaSeleccionada
        );

        if (!sigue) {
            zonaSeleccionada = null;
        }
    }

    guardarEstado();
    guardarHistorial();

    notificar(
        "Borrado parcial",
        `${modificadas} cobertura(s) modificada(s)${eliminadas ? ` y ${eliminadas} eliminada(s)` : ""}.`,
        "success"
    );
}


function diferenciaTurf(featureA, featureB) {

    if (!featureA || !featureB || typeof turf.difference !== "function") {
        return null;
    }

    try {
        const resultado = turf.difference(
            turf.featureCollection([featureA, featureB])
        );

        if (resultado !== undefined) {
            return resultado;
        }
    } catch (_) {}

    try {
        const resultado = turf.difference(featureA, featureB);

        if (resultado !== undefined) {
            return resultado;
        }
    } catch (_) {}

    return null;
}


function geometriaVacia(feature) {

    if (!feature || !feature.geometry) {
        return true;
    }

    const geometry = feature.geometry;

    if (geometry.type === "GeometryCollection") {
        return !geometry.geometries || geometry.geometries.length === 0;
    }

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        return !geometry.coordinates || geometry.coordinates.length === 0;
    }

    return false;
}


function iniciarModoBorrador() {

    if (!exigirPermisoEdicion()) return;


    detenerTodasLasHerramientas();

    herramientaActiva = "borrador";

    actualizarInterfazHerramienta();
    actualizarInteraccionCapas();

    try {
        mapa.pm.enableDraw("Circle", { snappable: false });
    } catch (error) {
        console.error(error);
        notificar("Error", "No se pudo activar el borrador circular.", "error");
    }
}


/* =========================================================
   PINTAR MANUAL
========================================================= */

function iniciarModoPintar() {

    if (!exigirPermisoEdicion()) return;


    detenerTodasLasHerramientas();

    herramientaActiva = "pintar";

    actualizarInterfazHerramienta();
    actualizarInteraccionCapas();

    dibujandoLinea = false;
    puntosLinea = [];

    mouseMoveLineaHandler = function (evento) {

        if (!dibujandoLinea) {
            return;
        }

        agregarPuntoLinea(evento.latlng);
    };

    mouseUpLineaHandler = function () {
        finalizarLineaPintada();
    };

    mapa.on("mousemove", mouseMoveLineaHandler);
    mapa.on("mouseup", mouseUpLineaHandler);
    mapa.on("mousedown", iniciarLineaPintada);
}


function iniciarLineaPintada(evento) {

    if (herramientaActiva !== "pintar") {
        return;
    }

    if (evento && evento.originalEvent) {
        L.DomEvent.preventDefault(evento.originalEvent);
    }

    dibujandoLinea = true;
    puntosLinea = [];

    agregarPuntoLinea(evento.latlng);

    if (mapa.dragging) {
        mapa.dragging.disable();
    }
}


function agregarPuntoLinea(latlng) {

    if (!latlng) {
        return;
    }

    if (puntosLinea.length === 0) {
        puntosLinea.push(latlng);
        return;
    }

    const ultimo = puntosLinea[puntosLinea.length - 1];

    if (mapa.distance(ultimo, latlng) >= 5) {
        puntosLinea.push(latlng);
    }
}


function finalizarLineaPintada() {

    if (!exigirPermisoEdicion()) return;


    if (!dibujandoLinea) {
        return;
    }

    dibujandoLinea = false;

    if (mapa.dragging) {
        mapa.dragging.enable();
    }

    if (puntosLinea.length < 2) {
        puntosLinea = [];
        return;
    }

    const coordenadas = puntosLinea.map(p => [p.lng, p.lat]);

    puntosLinea = [];

    try {

        const linea = turf.lineString(coordenadas);

        let cobertura = turf.buffer(
            linea,
            CONFIG.anchoPintadoMetros / 1000,
            {
                units: "kilometers",
                steps: CONFIG.pasosBuffer
            }
        );

        if (!cobertura) {
            return;
        }

        if (!geometriaIntersecaCostaRica(cobertura)) {
            notificar("Fuera de Costa Rica", "La zona pintada está fuera de Costa Rica.", "warning");
            return;
        }

        cobertura = recortarACostaRica(cobertura);

        if (!cobertura) {
            return;
        }

        crearCobertura(cobertura, "pintar");

    } catch (error) {

        console.error("Error pintando:", error);

        notificar("Error", "No se pudo crear la cobertura.", "error");
    }
}


/* =========================================================
   CÍRCULO / RECTÁNGULO / POLÍGONO
========================================================= */

function iniciarModoCirculo() {
    iniciarModoGeoman("circulo");
}

function iniciarModoRectangulo() {
    iniciarModoGeoman("rectangulo");
}

function iniciarModoPoligono() {
    iniciarModoGeoman("poligono");
}

function iniciarModoGeoman(herramienta) {

    if (!exigirPermisoEdicion()) return;


    detenerTodasLasHerramientas();

    herramientaActiva = herramienta;

    actualizarInterfazHerramienta();
    actualizarInteraccionCapas();

    let tipo = null;

    if (herramienta === "circulo") {
        tipo = "Circle";
    } else if (herramienta === "rectangulo") {
        tipo = "Rectangle";
    } else if (herramienta === "poligono") {
        tipo = "Polygon";
    }

    if (!tipo) {
        return;
    }

    try {
        mapa.pm.enableDraw(tipo, {
            snappable: false,
            allowSelfIntersection: false
        });
    } catch (error) {
        console.error(error);
        notificar("Error", "No se pudo activar la herramienta.", "error");
    }
}


/* =========================================================
   DETENER HERRAMIENTAS
========================================================= */

function detenerTodasLasHerramientas() {

    if (!mapa) {
        return;
    }

    try {
        if (mapa.pm) {
            mapa.pm.disableDraw();
        }
    } catch (_) {}

    /* Desactivar edición en las coberturas */
    try {
        if (grupoCoberturas) {
            grupoCoberturas.eachLayer(layer => {
                if (layer.pm && layer.pm.enabled && layer.pm.enabled()) {
                    layer.pm.disable();
                }
            });
        }
    } catch (_) {}

    if (mouseMoveLineaHandler) {
        mapa.off("mousemove", mouseMoveLineaHandler);
        mouseMoveLineaHandler = null;
    }

    if (mouseUpLineaHandler) {
        mapa.off("mouseup", mouseUpLineaHandler);
        mouseUpLineaHandler = null;
    }

    mapa.off("mousedown", iniciarLineaPintada);

    if (mapa.dragging && !mapa.dragging.enabled()) {
        mapa.dragging.enable();
    }

    dibujandoLinea = false;
    puntosLinea = [];

    herramientaActiva = "ninguna";

    actualizarInteraccionCapas();
    actualizarInterfazHerramienta();
}


/* =========================================================
   EDITAR / ELIMINAR
========================================================= */

function iniciarModoEditar() {

    if (!exigirPermisoEdicion()) return;


    detenerTodasLasHerramientas();

    herramientaActiva = "editar";

    actualizarInterfazHerramienta();
    actualizarInteraccionCapas();

    try {
        grupoCoberturas.eachLayer(layer => {
            if (layer.pm) {
                layer.pm.enable({ allowSelfIntersection: false });
            }
        });
    } catch (error) {
        console.error("Error activando edición:", error);
    }

    notificar("Editar", "Selecciona una cobertura y modifica su forma.", "info");
}


function iniciarModoEliminar() {

    if (!exigirPermisoEdicion()) return;


    detenerTodasLasHerramientas();

    herramientaActiva = "eliminar";

    actualizarInterfazHerramienta();
    actualizarInteraccionCapas();

    notificar("Eliminar", "Haz clic sobre una cobertura para eliminarla completa.", "info");
}


/* =========================================================
   NIVELES: PROVINCIAS / CANTONES
========================================================= */

function iniciarProvincias() {

    nivelActivo = "provincias";

    detenerTodasLasHerramientas();
    actualizarInteraccionCapas();

    notificar("Provincias", "Haz clic en una provincia para pintarla.", "info");
}

/* Alias por compatibilidad con el código anterior */
const iniciarDepartamentos = iniciarProvincias;

function iniciarPintarMunicipios() {

    if (!cantonesData || !cantonesData.features.length) {
        notificar(
            "Cantones no disponibles",
            "No se pudieron cargar los cantones.",
            "warning"
        );
        return;
    }

    nivelActivo = "cantones";

    detenerTodasLasHerramientas();
    actualizarInteraccionCapas();

    notificar("Cantones", "Haz clic en un cantón para pintarlo.", "info");
}

function seleccionarProvincia(feature) {

    if (!feature) {
        return;
    }

    const geometria = convertirFeatureAPoligono(feature);

    if (!geometria) {
        return;
    }

    crearCoberturaNivel(
        geometria,
        "provincia",
        obtenerNombreFeature(feature),
        obtenerIdFeature(feature)
    );
}

function seleccionarCanton(feature) {

    if (!feature) {
        return;
    }

    const geometria = convertirFeatureAPoligono(feature);

    if (!geometria) {
        return;
    }

    crearCoberturaNivel(
        geometria,
        "canton",
        obtenerNombreFeature(feature),
        obtenerIdFeature(feature)
    );
}


const ETIQUETAS_NIVEL = {
    provincia: "Provincia agregada",
    canton: "Cantón agregado"
};


function crearCoberturaNivel(geometria, nivel, nombre, idOrigen) {

    if (!exigirPermisoEdicion()) return;


    const existentes = obtenerCoberturas();

    const repetida = existentes.find(f => {

        const p = f.properties || {};

        return (
            p.nivel === nivel &&
            String(p.origenId) === String(idOrigen)
        );
    });

    if (repetida) {

        zonaSeleccionada = repetida.properties.id;

        cargarDatosZonaFormulario(repetida);

        notificar("Ya existe", `${nombre} ya está pintado.`, "info");

        return;
    }

    const feature = {
        type: "Feature",
        properties: {
            id: generarId(),
            nombre: nombre || `Cobertura ${nivel}`,
            tipo: obtenerTipoFormulario(),
            estado: obtenerEstadoFormulario(),
            nivel: nivel,
            origenId: idOrigen,
            origenNombre: nombre,
            fecha: new Date().toISOString()
        },
        geometry: geometria.geometry
    };

    reemplazarCoberturas(existentes.concat(feature));

    zonaSeleccionada = feature.properties.id;

    cargarDatosZonaFormulario(feature);

    guardarEstado();
    guardarHistorial();

    notificar(
        ETIQUETAS_NIVEL[nivel] || "Zona agregada",
        `${nombre || "La zona"} fue agregada a la cobertura.`,
        "success"
    );
}


function convertirFeatureAPoligono(feature) {

    if (!feature) {
        return null;
    }

    if (feature.type === "Feature") {
        return feature;
    }

    if (feature.type === "Polygon" || feature.type === "MultiPolygon") {
        return {
            type: "Feature",
            properties: {},
            geometry: feature
        };
    }

    return null;
}


/* =========================================================
   NOMBRE E ID DE FEATURE
========================================================= */

function obtenerNombreFeature(feature) {

    if (!feature || !feature.properties) {
        return "Zona sin nombre";
    }

    const p = feature.properties;

    const campos = [
        "shapeName", "SHAPENAME", "shape_name", "SHAPE_NAME",
        "nombre", "NOMBRE", "Nombre",
        "provincia", "PROVINCIA", "Provincia",
        "canton", "CANTON", "Canton", "cantón", "Cantón",
        "name", "NAME", "Name",
        "NOM_PROV", "NOM_CANT"
    ];

    for (const campo of campos) {

        if (
            p[campo] !== undefined &&
            p[campo] !== null &&
            String(p[campo]).trim() !== ""
        ) {
            return nombreVisibleProvincia(String(p[campo]).trim());
        }
    }

    for (const clave of Object.keys(p)) {

        const valor = p[clave];

        if (
            typeof valor === "string" &&
            valor.trim() !== "" &&
            (
                clave.toLowerCase().includes("nom") ||
                clave.toLowerCase().includes("name") ||
                clave.toLowerCase().includes("prov") ||
                clave.toLowerCase().includes("cant")
            )
        ) {
            return nombreVisibleProvincia(valor.trim());
        }
    }

    return "Zona sin nombre";
}


function obtenerIdFeature(feature) {

    const props = (feature && feature.properties) || {};

    const candidatos = [
        "shapeID", "shapeid",
        "id", "ID",
        "objectid", "OBJECTID",
        "codigo", "CODIGO",
        "code", "CODE"
    ];

    for (const campo of candidatos) {

        if (props[campo] !== undefined && props[campo] !== null) {
            return String(props[campo]);
        }
    }

    return generarId();
}
/* =========================================================
   CARGAR GEOGRAFÍA
========================================================= */

async function cargarGeografia() {

    notificar(
        "Cargando mapa",
        "Cargando provincias y cantones de Costa Rica...",
        "info"
    );

    try {

        provinciasData = await cargarGeoJSON(CONFIG.urls.provincias);

        const nombres = provinciasData.features.map(
            f => obtenerNombreFeature(f)
        );

        console.log("PROVINCIAS CARGADAS:", nombres.length);
        console.log("Nombres de provincias:", nombres);

        const noReconocidas = nombres.filter(n => !esProvinciaOficial(n));

        if (
            nombres.length !== CONFIG.totalProvinciasEsperado ||
            noReconocidas.length
        ) {
            console.warn(
                `Se esperaban ${CONFIG.totalProvinciasEsperado} provincias. ` +
                `Cargadas: ${nombres.length}. ` +
                `Nombres no reconocidos:`,
                noReconocidas
            );
        }

        crearCapaProvincias();

    } catch (errorProvincias) {

        console.error(
            "No se pudieron cargar las provincias:",
            errorProvincias
        );

        provinciasData = {
            type: "FeatureCollection",
            features: []
        };

        notificar(
            "Error de provincias",
            "No se pudieron cargar las provincias de Costa Rica.",
            "error"
        );
    }

    try {

        cantonesData = await cargarGeoJSON(CONFIG.urls.cantones);

        console.log("CANTONES CARGADOS:", cantonesData.features.length);

        crearCapaCantones();

    } catch (errorCantones) {

        console.error(
            "No se pudieron cargar los cantones:",
            errorCantones
        );

        cantonesData = {
            type: "FeatureCollection",
            features: []
        };

        notificar(
            "Cantones no disponibles",
            "Las provincias sí pueden utilizarse, pero no se pudieron cargar los cantones.",
            "warning"
        );
    }

    construirMascaraCostaRica();
    actualizarInteraccionCapas();
}


async function cargarGeoJSON(urls) {

    const lista = Array.isArray(urls) ? urls : [urls];

    let ultimoError = null;

    for (const url of lista) {

        try {

            console.log("Cargando geografía:", url);

            const respuesta = await fetch(url, {
                method: "GET",
                mode: "cors",
                cache: "no-store",
                credentials: "omit"
            });

            if (!respuesta.ok) {
                throw new Error(`HTTP ${respuesta.status} ${respuesta.statusText}`);
            }

            const texto = await respuesta.text();

            if (texto.startsWith("version https://git-lfs")) {
                throw new Error("La URL devolvió un puntero Git LFS, no el GeoJSON.");
            }

            const datos = JSON.parse(texto);

            if (
                datos &&
                datos.type === "FeatureCollection" &&
                Array.isArray(datos.features)
            ) {
                console.log(`Geografía cargada: ${datos.features.length} elementos`);
                return datos;
            }

            throw new Error("La respuesta no es un FeatureCollection válido.");

        } catch (error) {

            console.warn("Falló la URL:", url, error);

            ultimoError = error;
        }
    }

    console.error("Error cargando geografía:", ultimoError);

    throw new Error(
        "No fue posible cargar la geografía de Costa Rica. Verifica la conexión y la URL GeoJSON."
    );
}


/* =========================================================
   CAPAS PROVINCIAS / CANTONES
========================================================= */

function crearCapaProvincias() {

    if (capaProvincias) {
        mapa.removeLayer(capaProvincias);
    }

    capaProvincias = L.geoJSON(provinciasData, {

        style: estiloProvincia,

        onEachFeature: function (feature, layer) {

            layer.on("click", function (evento) {

                L.DomEvent.stopPropagation(evento);

                seleccionarProvincia(feature);
            });

            layer.bindTooltip(
                obtenerNombreFeature(feature),
                { sticky: true }
            );
        }

    });
}

function estiloProvincia() {
    return {
        color: "#64748b",
        weight: 1.5,
        fillColor: "#e5e7eb",
        fillOpacity: 0.28
    };
}

function crearCapaCantones() {

    if (capaCantones) {
        mapa.removeLayer(capaCantones);
    }

    capaCantones = L.geoJSON(cantonesData, {

        style: estiloCanton,

        onEachFeature: function (feature, layer) {

            layer.on("click", function (evento) {

                L.DomEvent.stopPropagation(evento);

                seleccionarCanton(feature);
            });

            layer.bindTooltip(
                obtenerNombreFeature(feature),
                { sticky: true }
            );
        }

    });
}

function estiloCanton() {
    return {
        color: "#94a3b8",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 0.08
    };
}

function construirMascaraCostaRica() {

    mascaraCostaRica = null;

    if (!provinciasData || !provinciasData.features) {
        return;
    }

    mascaraCostaRica = unirFeatures(provinciasData.features);
}


/* =========================================================
   INTERACCIÓN DE CAPAS
   --------------------------------------------------------
   CORRECCIÓN IMPORTANTE:
   Antes las dos capas (departamentos y municipios) estaban
   siempre en el mapa. La de municipios quedaba ENCIMA y
   recibía todos los clics, por eso al pintar un departamento
   el sistema lo tomaba como municipio. Cambiar
   options.interactive después de crear la capa no tiene
   efecto. Ahora solo la capa del nivel activo está en el mapa.
========================================================= */

function actualizarInteraccionCapas() {

    if (!mapa) {
        return;
    }

    const mostrarProvincias = nivelActivo === "provincias";

    if (capaProvincias) {

        if (mostrarProvincias && !mapa.hasLayer(capaProvincias)) {
            capaProvincias.addTo(mapa);
        }

        if (!mostrarProvincias && mapa.hasLayer(capaProvincias)) {
            mapa.removeLayer(capaProvincias);
        }
    }

    if (capaCantones) {

        if (!mostrarProvincias && !mapa.hasLayer(capaCantones)) {
            capaCantones.addTo(mapa);
        }

        if (mostrarProvincias && mapa.hasLayer(capaCantones)) {
            mapa.removeLayer(capaCantones);
        }
    }

    /* Las coberturas siempre quedan por encima de las capas base */
    if (grupoCoberturas && mapa.hasLayer(grupoCoberturas)) {
        try {
            grupoCoberturas.bringToFront();
        } catch (_) {}
    }
}


/* =========================================================
   BUSCADOR
========================================================= */

function configurarBuscador() {

    const input = document.getElementById("buscarDepartamento");

    if (!input) {
        console.warn("No existe #buscarDepartamento");
        return;
    }

    const contenedor = document.getElementById("resultadosDirecciones");

    if (contenedor) {
        contenedor.style.display = "block";
        contenedor.style.maxHeight = "320px";
        contenedor.style.overflowY = "auto";
        contenedor.style.position = "relative";
        contenedor.style.zIndex = "9999";
    }

    input.setAttribute("autocomplete", "off");

    input.setAttribute(
        "placeholder",
        "Busca calles, barrios, distritos, cantones..."
    );

    input.addEventListener("input", function () {
        buscarDireccionConDebounce(input.value.trim());
    });

    input.addEventListener("keydown", function (evento) {

        if (evento.key === "Enter") {
            evento.preventDefault();
            clearTimeout(debounceBusqueda);
            buscarDireccion(input.value.trim());
        }

        if (evento.key === "Escape") {
            limpiarResultadosBusqueda();
        }
    });

    const limpiar = document.getElementById("limpiarBusqueda");

    if (limpiar) {

        limpiar.addEventListener("click", function () {

            input.value = "";
            ultimaBusqueda = "";

            clearTimeout(debounceBusqueda);

            if (controladorBusqueda) {
                controladorBusqueda.abort();
            }

            limpiarMarcadoresBusqueda();
            limpiarResultadosBusqueda();
            actualizarListaDepartamentos();

            input.focus();
        });
    }
}


function buscarDireccionConDebounce(texto) {

    clearTimeout(debounceBusqueda);

    if (texto.length < 3) {

        limpiarResultadosBusqueda();

        if (controladorBusqueda) {
            controladorBusqueda.abort();
        }

        return;
    }

    debounceBusqueda = setTimeout(function () {
        buscarDireccion(texto);
    }, 1000);
}


async function buscarDireccion(texto) {

    texto = String(texto || "").trim();

    if (texto.length < 3) {
        return;
    }

    if (texto === ultimaBusqueda) {
        return;
    }

    ultimaBusqueda = texto;

    const solicitud = ++numeroSolicitudBusqueda;

    if (controladorBusqueda) {
        controladorBusqueda.abort();
    }

    controladorBusqueda = new AbortController();

    mostrarEstadoBusqueda("Buscando ubicaciones...");

    try {

        const b = CONFIG.bbox;

        const parametros = new URLSearchParams({
            q: texto,
            format: "jsonv2",
            addressdetails: "1",
            namedetails: "1",
            extratags: "1",
            limit: String(CONFIG.limiteBusqueda),
            countrycodes: "cr",
            "accept-language": "es",
            dedupe: "1",
            viewbox: `${b[0]},${b[3]},${b[2]},${b[1]}`
        });

        const respuesta = await fetch(
            `${CONFIG.urls.nominatim}?${parametros.toString()}`,
            {
                method: "GET",
                headers: { Accept: "application/json" },
                signal: controladorBusqueda.signal
            }
        );

        if (!respuesta.ok) {
            throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const resultados = await respuesta.json();

        if (solicitud !== numeroSolicitudBusqueda) {
            return;
        }

        mostrarResultadosDirecciones(resultados);

    } catch (error) {

        if (error.name === "AbortError") {
            return;
        }

        console.error("Error buscando ubicaciones:", error);

        if (solicitud === numeroSolicitudBusqueda) {
            mostrarEstadoBusqueda(
                "No se pudieron cargar las ubicaciones. Intenta nuevamente."
            );
        }
    }
}


function mostrarEstadoBusqueda(texto) {

    const contenedor = document.getElementById("resultadosDirecciones");

    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = "";

    const elemento = document.createElement("div");

    elemento.className = "sin-resultados";
    elemento.textContent = texto;
    elemento.style.padding = "12px";
    elemento.style.fontSize = "13px";
    elemento.style.color = "#64748b";

    contenedor.appendChild(elemento);
}


function obtenerTipoUbicacion(resultado) {

    const address = resultado.address || {};

    const tipo = String(resultado.type || "").toLowerCase();

    const categoria = String(resultado.class || "").toLowerCase();

    if (
        address.road ||
        [
            "road", "residential", "service", "street", "pedestrian",
            "living_street", "primary", "secondary", "tertiary"
        ].includes(tipo)
    ) {
        return "Calle o avenida";
    }

    if (
        address.neighbourhood ||
        address.suburb ||
        address.quarter ||
        ["neighbourhood", "suburb", "quarter"].includes(tipo)
    ) {
        return "Barrio o urbanización";
    }

    if (address.hamlet || tipo === "hamlet") {
        return "Caserío";
    }

    if (address.village || tipo === "village") {
        return "Pueblo o distrito";
    }

    if (address.town || tipo === "town") {
        return "Población o cantón";
    }

    if (address.city || tipo === "city") {
        return "Ciudad";
    }

    if (address.county || tipo === "county") {
        return "Cantón o división administrativa";
    }

    if (address.state || tipo === "administrative") {
        return "Provincia o división administrativa";
    }

    if (
        categoria === "shop" ||
        categoria === "amenity" ||
        categoria === "tourism" ||
        categoria === "office"
    ) {
        return "Comercio o lugar de interés";
    }

    return "Ubicación";
}


function mostrarResultadosDirecciones(resultados) {

    const contenedor = document.getElementById("resultadosDirecciones");

    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = "";

    if (!Array.isArray(resultados) || !resultados.length) {
        mostrarEstadoBusqueda("No se encontraron ubicaciones. Prueba con otro nombre.");
        return;
    }

    resultados.forEach(resultado => {

        if (!resultado.lat || !resultado.lon) {
            return;
        }

        const elemento = document.createElement("button");

        elemento.type = "button";
        elemento.className = "resultado-direccion";

        Object.assign(elemento.style, {
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "11px 13px",
            border: "0",
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
            cursor: "pointer",
            color: "#1e293b",
            fontSize: "13px",
            lineHeight: "1.5"
        });

        const tipo = obtenerTipoUbicacion(resultado);

        const nombre = document.createElement("strong");

        nombre.textContent =
            resultado.name || resultado.display_name.split(",")[0];

        Object.assign(nombre.style, {
            display: "block",
            fontSize: "14px",
            color: "#0f172a"
        });

        const descripcion = document.createElement("span");

        descripcion.textContent = resultado.display_name;

        Object.assign(descripcion.style, {
            display: "block",
            color: "#64748b",
            marginTop: "3px"
        });

        const etiqueta = document.createElement("span");

        etiqueta.textContent = tipo;

        Object.assign(etiqueta.style, {
            display: "inline-block",
            marginTop: "5px",
            padding: "2px 7px",
            borderRadius: "5px",
            background: "#eff6ff",
            color: "#2563eb",
            fontSize: "11px"
        });

        elemento.appendChild(nombre);
        elemento.appendChild(descripcion);
        elemento.appendChild(etiqueta);

        elemento.addEventListener("mouseenter", function () {
            elemento.style.background = "#f1f5f9";
        });

        elemento.addEventListener("mouseleave", function () {
            elemento.style.background = "#ffffff";
        });

        elemento.addEventListener("click", function () {
            seleccionarResultadoBusqueda(resultado);
        });

        contenedor.appendChild(elemento);
    });

    if (!contenedor.children.length) {
        mostrarEstadoBusqueda("No se encontraron ubicaciones válidas.");
    }
}


function escaparTextoHTML(texto) {

        return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function seleccionarResultadoBusqueda(resultado) {

    if (!resultado || !mapa) {
        return;
    }

    const lat = Number(resultado.lat);
    const lon = Number(resultado.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
    }

    limpiarMarcadoresBusqueda();

    const tipo = obtenerTipoUbicacion(resultado);

    const nombre =
        resultado.name || resultado.display_name.split(",")[0];

    const direccion = resultado.display_name || nombre;

    marcadorSeleccionado = L.marker([lat, lon], {
        title: nombre,
        riseOnHover: true,
        keyboard: true
    });

    marcadorSeleccionado.addTo(grupoMarcadoresBusqueda);

    L.circle([lat, lon], {
        radius: 45,
        color: "#ef4444",
        weight: 2,
        opacity: 1,
        fillColor: "#ef4444",
        fillOpacity: 0.18,
        interactive: false
    }).addTo(grupoMarcadoresBusqueda);

    marcadorSeleccionado.bindPopup(`
        <div style="min-width:180px;max-width:260px;">
            <strong style="font-size:14px;color:#0f172a;">
                ${escaparTextoHTML(nombre)}
            </strong>
            <div style="margin-top:5px;color:#64748b;font-size:12px;">
                ${escaparTextoHTML(tipo)}
            </div>
            <div style="margin-top:7px;font-size:12px;color:#334155;">
                ${escaparTextoHTML(direccion)}
            </div>
            <div style="margin-top:8px;color:#16a34a;font-size:11px;font-weight:600;">
                Ubicación marcada en el mapa
            </div>
        </div>
    `);

    let zoom = 16;

    if (tipo.includes("Provincia")) {
        zoom = 9;
    } else if (
        tipo.includes("Cantón") ||
        tipo.includes("cantón") ||
        tipo.includes("Ciudad")
    ) {
        zoom = 13;
    } else if (
        tipo.includes("Pueblo") ||
        tipo.includes("Caserío")
    ) {
        zoom = 15;
    } else if (
        tipo.includes("Calle") ||
        tipo.includes("Barrio")
    ) {
        zoom = 17;
    }

    mapa.setView([lat, lon], zoom, { animate: true, duration: 0.8 });

    marcadorSeleccionado.openPopup();

    const input = document.getElementById("buscarDepartamento");

    if (input) {
        input.value = nombre;
    }

    ultimaBusqueda = "";

    limpiarResultadosBusqueda();

    notificar(
        "Ubicación encontrada",
        `${nombre} fue marcada en el mapa.`,
        "success"
    );
}


function limpiarResultadosBusqueda() {

    const contenedor = document.getElementById("resultadosDirecciones");

    if (contenedor) {
        contenedor.innerHTML = "";
    }
}

function limpiarMarcadoresBusqueda() {

    if (grupoMarcadoresBusqueda) {
        grupoMarcadoresBusqueda.clearLayers();
    }

    marcadorSeleccionado = null;
}


/* =========================================================
   LISTA DE PROVINCIAS (usa #listaDepartamentos)
========================================================= */

function actualizarListaDepartamentos() {

    const lista = document.getElementById("listaDepartamentos");

    if (!lista) {
        return;
    }

    lista.innerHTML = "";

    if (!provinciasData || !provinciasData.features) {
        return;
    }

    const input = document.getElementById("buscarLista");

    const filtro = input ? normalizarTextoClave(input.value) : "";

    const ordenadas = provinciasData.features
        .slice()
        .sort((a, b) =>
            obtenerNombreFeature(a)
                .localeCompare(obtenerNombreFeature(b), "es")
        );

    ordenadas.forEach(feature => {

        const nombre = obtenerNombreFeature(feature);

        if (filtro && !normalizarTextoClave(nombre).includes(filtro)) {
            return;
        }

        const elemento = document.createElement("button");

        elemento.type = "button";
        elemento.className = "item-departamento";
        elemento.textContent = nombre;

        elemento.addEventListener("click", function () {

            /* Pintar una provincia desde la lista siempre es nivel provincia */
            seleccionarProvincia(feature);
        });

        lista.appendChild(elemento);
    });

    const totalElemento = document.getElementById("totalDepartamentos");

    if (totalElemento) {
        totalElemento.textContent = String(provinciasData.features.length); /* 7 */
    }
}


/* =========================================================
   EVENTOS INTERFAZ
========================================================= */

function configurarEventosInterfaz() {

    configurarBuscador();

    vincularBoton("btnNuevaZona", iniciarModoPintar);
    vincularBoton("btnPintar", iniciarModoPintar);
    vincularBoton("btnPintarMunicipios", iniciarPintarMunicipios);
    vincularBoton("btnPintarProvincias", iniciarProvincias);
    vincularBoton("btnPintarDepartamentos", iniciarProvincias);
    vincularBoton("btnCirculo", iniciarModoCirculo);
    vincularBoton("btnRectangulo", iniciarModoRectangulo);
    vincularBoton("btnPoligono", iniciarModoPoligono);
    vincularBoton("btnBorrador", iniciarModoBorrador);
    vincularBoton("btnEditarZonas", iniciarModoEditar);
    vincularBoton("btnEliminarZonas", iniciarModoEliminar);
    vincularBoton("btnGuardarZona", guardarZonaSeleccionada);
    vincularBoton("btnGuardarTodo", guardarEstadoManual);
    vincularBoton("btnCargarTodo", cargarEstadoManual);
    vincularBoton("btnLimpiarTodo", limpiarTodo);
    vincularBoton("btnDeshacer", deshacer);
    vincularBoton("btnRehacer", rehacer);
    vincularBoton("cerrarModal", cerrarModal);
    vincularBoton("cerrarModalBoton", cerrarModal);

    const fondo = document.getElementById("modalFondo");

    if (fondo) {
        fondo.addEventListener("click", function (evento) {
            if (evento.target === fondo) {
                cerrarModal();
            }
        });
    }

    const buscarLista = document.getElementById("buscarLista");

    if (buscarLista) {
        buscarLista.addEventListener("input", actualizarListaDepartamentos);
    }

    const limpiarLista = document.getElementById("limpiarLista");

    if (limpiarLista) {
        limpiarLista.addEventListener("click", function () {

            if (buscarLista) {
                buscarLista.value = "";
            }

            actualizarListaDepartamentos();
        });
    }

    const btnPincel = document.getElementById("btnPincel");

    if (btnPincel) {
        btnPincel.style.display = "none";
    }
}


function vincularBoton(id, funcion) {

    const elemento = document.getElementById(id);

    if (!elemento) {
        return;
    }

    elemento.addEventListener("click", function (evento) {
        evento.preventDefault();
        funcion();
    });
}


function configurarEventosMapa() {

    if (!mapa) {
        return;
    }

    mapa.on("click", function () {
        if (herramientaActiva === "ninguna") {
            return;
        }
    });
}


function configurarTeclado() {

    document.addEventListener("keydown", function (evento) {

        const ctrl = evento.ctrlKey || evento.metaKey;

        const tecla = String(evento.key || "").toLowerCase();

        if (ctrl && tecla === "z") {

            evento.preventDefault();

            if (evento.shiftKey) {
                rehacer();
            } else {
                deshacer();
            }

            return;
        }

        if (ctrl && tecla === "y") {
            evento.preventDefault();
            rehacer();
        }

        if (evento.key === "Escape") {
            detenerTodasLasHerramientas();
        }
    });
}


/* =========================================================
   STORAGE
========================================================= */

function guardarEstado() {

    if (!cargandoEstado && !exigirPermisoEdicion()) return;


    if (cargandoEstado) {
        return;
    }

    try {

        const fecha = new Date().toISOString();

        localStorage.setItem(
            STORAGE_ZONAS,
            JSON.stringify({
                version: 1,
                fecha: fecha,
                zonas: obtenerCoberturas()
            })
        );

        localStorage.setItem(
            STORAGE_CANTONES,
            JSON.stringify({
                version: 1,
                fecha: fecha,
                zonas: []
            })
        );

    } catch (error) {
        console.error("Error guardando:", error);
    }
}


function cargarEstadoGuardado() {

    cargandoEstado = true;

    try {

        const texto = localStorage.getItem(STORAGE_ZONAS);

        if (!texto) {
            return;
        }

        const datos = JSON.parse(texto);

        let zonas = [];

        if (Array.isArray(datos)) {
            zonas = datos;
        } else if (datos && Array.isArray(datos.zonas)) {
            zonas = datos.zonas;
        }

        if (zonas.length) {
            reemplazarCoberturas(zonas);
        }

    } catch (error) {

        console.error("Error cargando estado:", error);

    } finally {

        cargandoEstado = false;
    }
}


function guardarEstadoManual() {

    if (!exigirPermisoEdicion()) return;


    guardarEstado();

    notificar("Guardado", "Todas las coberturas fueron guardadas.", "success");
}

function cargarEstadoManual() {

    cargarEstadoGuardado();

    notificar("Cargado", "Las coberturas guardadas fueron cargadas.", "success");
}


function limpiarTodo() {

    if (!exigirPermisoEdicion()) return;


    const confirmar = window.confirm(
        "¿Seguro que deseas eliminar todas las coberturas?"
    );

    if (!confirmar) {
        return;
    }

    reemplazarCoberturas([]);

    zonaSeleccionada = null;

    guardarEstado();
    guardarHistorial();

    notificar("Coberturas eliminadas", "Se eliminaron todas las coberturas.", "success");
}


/* =========================================================
   HISTORIAL
========================================================= */

function obtenerSnapshot() {
    return JSON.stringify(obtenerCoberturas());
}

function guardarEstadoInicialHistorial() {

    historial = [obtenerSnapshot()];

    indiceHistorial = 0;
}

function guardarHistorial() {

    if (!exigirPermisoEdicion()) return;


    if (guardandoHistorial || cargandoEstado) {
        return;
    }

    const snapshot = obtenerSnapshot();

    if (historial[indiceHistorial] === snapshot) {
        return;
    }

    historial = historial.slice(0, indiceHistorial + 1);

    historial.push(snapshot);

    if (historial.length > CONFIG.maxHistorial) {
        historial.shift();
    }

    indiceHistorial = historial.length - 1;
}

function deshacer() {

    if (!exigirPermisoEdicion()) return;


    if (indiceHistorial <= 0) {
        notificar("Deshacer", "No hay acciones para deshacer.", "info");
        return;
    }

    indiceHistorial--;

    aplicarSnapshot(historial[indiceHistorial]);
}

function rehacer() {

    if (!exigirPermisoEdicion()) return;


    if (indiceHistorial >= historial.length - 1) {
        notificar("Rehacer", "No hay acciones para rehacer.", "info");
        return;
    }

    indiceHistorial++;

    aplicarSnapshot(historial[indiceHistorial]);
}

function aplicarSnapshot(snapshot) {

    try {

        const zonas = JSON.parse(snapshot);

        guardandoHistorial = true;

        reemplazarCoberturas(zonas);

        guardarEstado();

    } catch (error) {

        console.error("Error aplicando historial:", error);

    } finally {

        guardandoHistorial = false;
    }
}


/* =========================================================
   INTERFAZ DE HERRAMIENTAS
========================================================= */

function actualizarInterfazHerramienta() {

    const botones = [
        "btnNuevaZona",
        "btnPintar",
        "btnPintarMunicipios",
        "btnPintarProvincias",
        "btnPintarDepartamentos",
        "btnCirculo",
        "btnRectangulo",
        "btnPoligono",
        "btnBorrador",
        "btnEditarZonas",
        "btnEliminarZonas"
    ];

    botones.forEach(id => {

        const elemento = document.getElementById(id);

        if (!elemento) {
            return;
        }

        elemento.classList.remove("activo", "active", "seleccionado");
    });

    const mapaBotones = {
        pintar: ["btnNuevaZona", "btnPintar"],
        circulo: ["btnCirculo"],
        rectangulo: ["btnRectangulo"],
        poligono: ["btnPoligono"],
        borrador: ["btnBorrador"],
        editar: ["btnEditarZonas"],
        eliminar: ["btnEliminarZonas"]
    };

    const activos = (mapaBotones[herramientaActiva] || []).slice();

    /* Los botones de nivel se marcan según el nivel activo */
    if (herramientaActiva === "ninguna") {

        if (nivelActivo === "cantones") {
            activos.push("btnPintarMunicipios");
        } else {
            activos.push("btnPintarProvincias", "btnPintarDepartamentos");
        }
    }

    activos.forEach(id => {

        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.classList.add("activo");
        }
    });
}

function actualizarEstadoMapa() {

    document
        .querySelectorAll("[data-estado-herramienta]")
        .forEach(elemento => {
            elemento.textContent = herramientaActiva;
        });
}


/* =========================================================
   MODAL
========================================================= */

function cerrarModal() {

    const modal = document.getElementById("modalDepartamento");
    const fondo = document.getElementById("modalFondo");

    if (modal) {
        modal.classList.remove("mostrar", "activo", "open");
        modal.style.display = "none";
    }

    if (fondo) {
        fondo.classList.remove("mostrar", "activo", "open");
        fondo.style.display = "none";
    }
}


/* =========================================================
   NOTIFICACIONES
========================================================= */

function notificar(titulo, mensaje, tipo) {

    const contenedor = document.getElementById("notificacion");

    if (!contenedor) {
        console.log(`[${tipo || "info"}] ${titulo}: ${mensaje}`);
        return;
    }

    const tituloElemento = document.getElementById("notificacionTitulo");
    const mensajeElemento = document.getElementById("notificacionMensaje");

    if (tituloElemento) {
        tituloElemento.textContent = titulo || "";
    }

    if (mensajeElemento) {
        mensajeElemento.textContent = mensaje || "";
    }

    contenedor.classList.remove("success", "error", "warning", "info");
    contenedor.classList.add(tipo || "info");
    contenedor.classList.add("mostrar");

    clearTimeout(contenedor._timeout);

    contenedor._timeout = setTimeout(function () {
        contenedor.classList.remove("mostrar");
    }, 3000);
}


/* =========================================================
   UTILIDADES
========================================================= */

function generarId() {

    return (
        "zona_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 9)
    );
}


/* =========================================================
   EXPONER FUNCIONES
========================================================= */

window.iniciarModoPintar = iniciarModoPintar;
window.iniciarPintarMunicipios = iniciarPintarMunicipios;
window.iniciarProvincias = iniciarProvincias;
window.iniciarDepartamentos = iniciarProvincias;
window.iniciarModoCirculo = iniciarModoCirculo;
window.iniciarModoRectangulo = iniciarModoRectangulo;
window.iniciarModoPoligono = iniciarModoPoligono;
window.iniciarModoBorrador = iniciarModoBorrador;
window.iniciarModoEditar = iniciarModoEditar;
window.iniciarModoEliminar = iniciarModoEliminar;
window.guardarZonaSeleccionada = guardarZonaSeleccionada;
window.guardarEstadoManual = guardarEstadoManual;
window.cargarEstadoManual = cargarEstadoManual;
window.limpiarTodo = limpiarTodo;
window.deshacer = deshacer;
window.rehacer = rehacer;
window.cerrarModal = cerrarModal;