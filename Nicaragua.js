"use strict";

/* =========================================================
   MENSAJERÍA EXPRESS
   ÁREA DE COBERTURAS - NICARAGUA
   (15 departamentos + 2 regiones autónomas + municipios)

   FUNCIONES:
   - Departamentos / Municipios
   - Pintar manual, Círculo, Rectángulo, Polígono
   - Borrador circular por partes
   - Editar / Eliminar
   - Guardar / cargar
   - Deshacer / rehacer
   - Buscador (datos locales + Nominatim + Photon) y lista de departamentos

   MAPA: #mapaNicaragua (si no existe, usa #mapaHonduras,
   #mapaElSalvador, #mapaGuatemala, #mapaPanama, #mapaCostaRica
   o #mapaUruguay)

   NOTA: los IDs del HTML se mantienen iguales
   (buscarDepartamento, listaDepartamentos, totalDepartamentos,
   btnPintarMunicipios, etc.) para que no tengas que cambiar tu HTML.

   NOTA GEOGRÁFICA: Nicaragua tiene 15 departamentos y 2 regiones
   autónomas del Caribe (Costa Caribe Norte y Costa Caribe Sur).
   La fuente de datos trae las 17 divisiones; las 2 regiones se
   incluyen para que la costa caribeña pueda pintarse.
========================================================= */


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CONFIG = {

    mapaId: "mapaNicaragua",
    mapaIdAlterno: [
        "mapaHonduras",
        "mapaElSalvador",
        "mapaGuatemala",
        "mapaPanama",
        "mapaCostaRica",
        "mapaUruguay"
    ],

    centro: [12.87, -85.2],

    zoomInicial: 7,

    zoomMaximoBusqueda: 17,

    /* Nominatim limita a 40 resultados por consulta */
    limiteBusqueda: 40,

    /* Resultados máximos que se piden a Photon */
    limiteBusquedaPhoton: 20,

    /* Resultados máximos que se toman de departamentos/municipios locales */
    limiteBusquedaLocal: 15,

    maxHistorial: 50,

    pasosCirculo: 64,
    pasosBuffer: 8,
    anchoPintadoMetros: 1500,

    /* 15 departamentos + 2 regiones autónomas en la fuente de datos */
    totalDivisionesEsperado: 17,

    /* [oeste, sur, este, norte] (incluye Corn Islands y cayos) */
    bbox: [-87.80, 10.65, -82.50, 15.10],

    urls: {

        departamentos: [
            "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NIC/ADM1/geoBoundaries-NIC-ADM1_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NIC/ADM1/geoBoundaries-NIC-ADM1_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/NIC/ADM1/geoBoundaries-NIC-ADM1_simplified.geojson"
        ],

        municipios: [
            "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/NIC/ADM2/geoBoundaries-NIC-ADM2_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NIC/ADM2/geoBoundaries-NIC-ADM2_simplified.geojson",
            "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/NIC/ADM2/geoBoundaries-NIC-ADM2_simplified.geojson"
        ],

        nominatim: "https://nominatim.openstreetmap.org/search",

        photon: "https://photon.komoot.io/api/"
    }
};


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_ZONAS =
    "mensajeriaExpressZonasCoberturaNicaragua";

const STORAGE_MUNICIPIOS =
    "mensajeriaExpressMunicipiosCoberturaNicaragua";


/* =========================================================
   SISTEMA DE PERMISOS DE EDICIÓN
   Login Central: Supabase storageKey "mensajeria-intranet-auth"
   También utiliza sessionStorage "usuarioIntranet".
   Solo los correos indicados pueden modificar.
   (Agrega o cambia aquí los correos autorizados para Nicaragua.)
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
   LOS 15 DEPARTAMENTOS DE NICARAGUA + 2 REGIONES AUTÓNOMAS
========================================================= */

const DEPARTAMENTOS_15 = [
    "Boaco",
    "Carazo",
    "Chinandega",
    "Chontales",
    "Estelí",
    "Granada",
    "Jinotega",
    "León",
    "Madriz",
    "Managua",
    "Masaya",
    "Matagalpa",
    "Nueva Segovia",
    "Río San Juan",
    "Rivas"
];

const REGIONES_AUTONOMAS = [
    "Costa Caribe Norte",
    "Costa Caribe Sur"
];

/* Nombre sin tildes -> nombre oficial con tildes */
const NOMBRES_VISIBLES = {};

DEPARTAMENTOS_15.concat(REGIONES_AUTONOMAS).forEach(nombre => {
    NOMBRES_VISIBLES[normalizarTextoClave(nombre)] = nombre;
});

/* Variantes de escritura que suelen venir en las fuentes de datos.
   El prefijo "departamento de " se elimina automáticamente. */
const ALIAS_NOMBRES = {
    "esteli": "Estelí",
    "leon": "León",
    "rio san juan": "Río San Juan",
    "rio-san-juan": "Río San Juan",
    "nueva-segovia": "Nueva Segovia",

    /* Regiones autónomas (nombres antiguos y variantes) */
    "atlantico norte": "Costa Caribe Norte",
    "region autonoma atlantico norte": "Costa Caribe Norte",
    "region autonoma del atlantico norte": "Costa Caribe Norte",
    "region autonoma de la costa caribe norte": "Costa Caribe Norte",
    "regiao autonoma atlantico norte": "Costa Caribe Norte",
    "raan": "Costa Caribe Norte",
    "raccn": "Costa Caribe Norte",
    "north caribbean coast": "Costa Caribe Norte",
    "north caribbean coast autonomous region": "Costa Caribe Norte",
    "costa caribe norte": "Costa Caribe Norte",

    "atlantico sur": "Costa Caribe Sur",
    "region autonoma atlantico sur": "Costa Caribe Sur",
    "region autonoma del atlantico sur": "Costa Caribe Sur",
    "region autonoma de la costa caribe sur": "Costa Caribe Sur",
    "regiao autonoma atlantico sur": "Costa Caribe Sur",
    "raas": "Costa Caribe Sur",
    "raccs": "Costa Caribe Sur",
    "south caribbean coast": "Costa Caribe Sur",
    "south caribbean coast autonomous region": "Costa Caribe Sur",
    "costa caribe sur": "Costa Caribe Sur"
};

Object.keys(ALIAS_NOMBRES).forEach(clave => {
    NOMBRES_VISIBLES[normalizarTextoClave(clave)] = ALIAS_NOMBRES[clave];
});


/* =========================================================
   VARIABLES
========================================================= */

let mapa = null;
let capaDepartamentos = null;
let capaMunicipios = null;
let grupoCoberturas = null;
let grupoMarcadoresBusqueda = null;

let departamentosData = null;
let municipiosData = null;

let zonaSeleccionada = null;
let herramientaActiva = "ninguna";

/* "departamentos" | "municipios" */
let nivelActivo = "departamentos";

let historial = [];
let indiceHistorial = -1;
let guardandoHistorial = false;
let cargandoEstado = false;

let debounceBusqueda = null;

let dibujandoLinea = false;
let puntosLinea = [];
let mouseMoveLineaHandler = null;
let mouseUpLineaHandler = null;

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

function nombreVisibleDepartamento(nombre) {

    let clave = normalizarTextoClave(nombre);

    if (NOMBRES_VISIBLES[clave]) {
        return NOMBRES_VISIBLES[clave];
    }

    /* "Departamento de X" -> "X" */
    clave = clave.replace(/^departamento de /, "");

    return NOMBRES_VISIBLES[clave] || nombre;
}

function esDepartamentoOficial(nombre) {
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

        // Resolver permisos ANTES de habilitar cualquier herramienta.
        await inicializarPermisosMapa();

        verificarDependencias();
        verificarMapaHTML();
        crearMapa();

        // Geoman debe quedar bloqueado desde el primer instante para consulta.
        if (!PUEDE_EDITAR_MAPA) {
            bloquearGeomanParaConsulta();
        }

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
            "El mapa de Nicaragua está preparado.",
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

    for (const id of CONFIG.mapaIdAlterno) {
        if (document.getElementById(id)) {
            CONFIG.mapaId = id;
            return;
        }
    }

    throw new Error(
        "No existe #mapaNicaragua (ni ningún mapa alterno) en el HTML."
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

    if (!evento || !evento.layer) return;

    if (!PUEDE_EDITAR_MAPA) {
        try { evento.layer.remove(); } catch (_) {}
        bloquearGeomanParaConsulta();
        exigirPermisoEdicion();
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

    if (!exigirPermisoEdicion()) return;

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
   INTERSECCIÓN / RECORTE CON NICARAGUA
========================================================= */

function geometriaIntersecaNicaragua(feature) {

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
        !departamentosData ||
        !Array.isArray(departamentosData.features) ||
        departamentosData.features.length === 0
    ) {
        return true;
    }

    for (const departamento of departamentosData.features) {

        try {
            if (turf.booleanIntersects(feature, departamento)) {
                return true;
            }
        } catch (_) {}
    }

    return false;
}


function recortarANicaragua(feature) {

    if (!feature) {
        return null;
    }

    if (
        !departamentosData ||
        !Array.isArray(departamentosData.features) ||
        departamentosData.features.length === 0
    ) {
        return feature;
    }

    const partes = [];

    for (const departamento of departamentosData.features) {

        try {

            if (!turf.booleanIntersects(feature, departamento)) {
                continue;
            }

            const interseccion = intersectarTurf(feature, departamento);

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

    if (!geometriaIntersecaNicaragua(geojson)) {
        notificar("Fuera de Nicaragua", "La zona debe estar dentro de Nicaragua.", "warning");
        return;
    }

    const geometriaFinal = recortarANicaragua(geojson);

    if (!geometriaFinal) {
        notificar("Zona inválida", "No hay área dentro de Nicaragua.", "warning");
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

            /* Las figuras dibujadas NO son ni departamento ni municipio */
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

    // La carga inicial/consulta está permitida; cualquier cambio normal exige permiso.
    if (!cargandoEstado && !exigirPermisoEdicion()) {
        return;
    }

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

    if (!exigirPermisoEdicion()) return;

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

    if (!exigirPermisoEdicion()) return;

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

    if (!PUEDE_EDITAR_MAPA) {
        dibujandoLinea = false;
        puntosLinea = [];
        if (mapa?.dragging && !mapa.dragging.enabled()) mapa.dragging.enable();
        return;
    }

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

        if (!geometriaIntersecaNicaragua(cobertura)) {
            notificar("Fuera de Nicaragua", "La zona pintada está fuera de Nicaragua.", "warning");
            return;
        }

        cobertura = recortarANicaragua(cobertura);

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
   NIVELES: DEPARTAMENTOS / MUNICIPIOS
========================================================= */

function iniciarDepartamentos() {

    nivelActivo = "departamentos";

    detenerTodasLasHerramientas();
    actualizarInteraccionCapas();

    notificar(
        "Departamentos",
        PUEDE_EDITAR_MAPA
            ? "Haz clic en un departamento para agregarlo a la cobertura."
            : "Modo consulta: puedes explorar los departamentos, pero no pintarlos.",
        "info"
    );
}

function iniciarPintarMunicipios() {

    if (!municipiosData || !municipiosData.features.length) {
        notificar(
            "Municipios no disponibles",
            "No se pudieron cargar los municipios.",
            "warning"
        );
        return;
    }

    nivelActivo = "municipios";

    detenerTodasLasHerramientas();
    actualizarInteraccionCapas();

    notificar(
        "Municipios",
        PUEDE_EDITAR_MAPA
            ? "Haz clic en un municipio para agregarlo a la cobertura."
            : "Modo consulta: puedes explorar los municipios, pero no pintarlos.",
        "info"
    );
}

function seleccionarDepartamento(feature) {

    if (!feature) {
        return;
    }

    const geometria = convertirFeatureAPoligono(feature);

    if (!geometria) {
        return;
    }

    crearCoberturaNivel(
        geometria,
        "departamento",
        obtenerNombreFeature(feature),
        obtenerIdFeature(feature)
    );
}

function seleccionarMunicipio(feature) {

    if (!feature) {
        return;
    }

    const geometria = convertirFeatureAPoligono(feature);

    if (!geometria) {
        return;
    }

    crearCoberturaNivel(
        geometria,
        "municipio",
        obtenerNombreFeature(feature),
        obtenerIdFeature(feature)
    );
}


const ETIQUETAS_NIVEL = {
    departamento: "Departamento agregado",
    municipio: "Municipio agregado"
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
        "departamento", "DEPARTAMENTO", "Departamento",
        "municipio", "MUNICIPIO", "Municipio",
        "name", "NAME", "Name",
        "NOM_DEPTO", "NOM_MUNI"
    ];

    for (const campo of campos) {

        if (
            p[campo] !== undefined &&
            p[campo] !== null &&
            String(p[campo]).trim() !== ""
        ) {
            return nombreVisibleDepartamento(String(p[campo]).trim());
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
                clave.toLowerCase().includes("depto") ||
                clave.toLowerCase().includes("muni")
            )
        ) {
            return nombreVisibleDepartamento(valor.trim());
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


/* Departamento al que pertenece un municipio (para el tooltip,
   porque hay nombres repetidos: San José, San Juan, etc.) */
function departamentoDeMunicipio(feature) {

    if (
        !departamentosData ||
        !Array.isArray(departamentosData.features)
    ) {
        return "";
    }

    try {

        const punto = turf.pointOnFeature(feature);

        for (const depto of departamentosData.features) {

            if (turf.booleanPointInPolygon(punto, depto)) {
                return obtenerNombreFeature(depto);
            }
        }

    } catch (_) {}

    return "";
}


/* =========================================================
   CARGAR GEOGRAFÍA
========================================================= */

async function cargarGeografia() {

    notificar(
        "Cargando mapa",
        "Cargando departamentos y municipios de Nicaragua...",
        "info"
    );

    try {

        departamentosData = await cargarGeoJSON(CONFIG.urls.departamentos);

        const nombres = departamentosData.features.map(
            f => obtenerNombreFeature(f)
        );

        console.log("DEPARTAMENTOS/REGIONES CARGADOS:", nombres.length);
        console.log("Nombres:", nombres);

        const noReconocidos = nombres.filter(n => !esDepartamentoOficial(n));

        if (
            nombres.length !== CONFIG.totalDivisionesEsperado ||
            noReconocidos.length
        ) {
            console.warn(
                `Se esperaban ${CONFIG.totalDivisionesEsperado} divisiones ` +
                `(15 departamentos + 2 regiones autónomas). ` +
                `Cargadas: ${nombres.length}. ` +
                `Nombres no reconocidos:`,
                noReconocidos
            );
        }

        crearCapaDepartamentos();

    } catch (errorDepartamentos) {

        console.error(
            "No se pudieron cargar los departamentos:",
            errorDepartamentos
        );

        departamentosData = {
            type: "FeatureCollection",
            features: []
        };

        notificar(
            "Error de departamentos",
            "No se pudieron cargar los departamentos de Nicaragua.",
            "error"
        );
    }

    try {

        municipiosData = await cargarGeoJSON(CONFIG.urls.municipios);

        console.log("MUNICIPIOS CARGADOS:", municipiosData.features.length);

        crearCapaMunicipios();

    } catch (errorMunicipios) {

        console.error(
            "No se pudieron cargar los municipios:",
            errorMunicipios
        );

        municipiosData = {
            type: "FeatureCollection",
            features: []
        };

        notificar(
            "Municipios no disponibles",
            "Los departamentos sí pueden utilizarse, pero no se pudieron cargar los municipios.",
            "warning"
        );
    }

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
        "No fue posible cargar la geografía de Nicaragua. Verifica la conexión y la URL GeoJSON."
    );
}


/* =========================================================
   CAPAS DEPARTAMENTOS / MUNICIPIOS
========================================================= */

function crearCapaDepartamentos() {

    if (capaDepartamentos) {
        mapa.removeLayer(capaDepartamentos);
    }

    capaDepartamentos = L.geoJSON(departamentosData, {

        style: estiloDepartamento,

        onEachFeature: function (feature, layer) {

            layer.on("click", function (evento) {

                L.DomEvent.stopPropagation(evento);

                seleccionarDepartamento(feature);
            });

            layer.bindTooltip(
                obtenerNombreFeature(feature),
                { sticky: true }
            );
        }

    });
}

function estiloDepartamento() {
    return {
        color: "#64748b",
        weight: 1.5,
        fillColor: "#e5e7eb",
        fillOpacity: 0.28
    };
}

function crearCapaMunicipios() {

    if (capaMunicipios) {
        mapa.removeLayer(capaMunicipios);
    }

    capaMunicipios = L.geoJSON(municipiosData, {

        style: estiloMunicipio,

        onEachFeature: function (feature, layer) {

            layer.on("click", function (evento) {

                L.DomEvent.stopPropagation(evento);

                seleccionarMunicipio(feature);
            });

            const nombre = obtenerNombreFeature(feature);
            const depto = departamentoDeMunicipio(feature);

            layer.bindTooltip(
                depto ? `${nombre} (${depto})` : nombre,
                { sticky: true }
            );
        }

    });
}

function estiloMunicipio() {
    return {
        color: "#94a3b8",
        weight: 1,
        fillColor: "#ffffff",
        fillOpacity: 0.08
    };
}


/* =========================================================
   INTERACCIÓN DE CAPAS
   Solo la capa del nivel activo está en el mapa, para que los
   clics no los capture la capa equivocada.
========================================================= */

function actualizarInteraccionCapas() {

    if (!mapa) {
        return;
    }

    const mostrarDepartamentos = nivelActivo === "departamentos";

    if (capaDepartamentos) {

        if (mostrarDepartamentos && !mapa.hasLayer(capaDepartamentos)) {
            capaDepartamentos.addTo(mapa);
        }

        if (!mostrarDepartamentos && mapa.hasLayer(capaDepartamentos)) {
            mapa.removeLayer(capaDepartamentos);
        }
    }

    if (capaMunicipios) {

        if (!mostrarDepartamentos && !mapa.hasLayer(capaMunicipios)) {
            capaMunicipios.addTo(mapa);
        }

        if (mostrarDepartamentos && mapa.hasLayer(capaMunicipios)) {
            mapa.removeLayer(capaMunicipios);
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
        "Busca calles, barrios, zonas, municipios, departamentos..."
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


/* ---------------------------------------------------------
   Fuente 1: departamentos y municipios ya cargados (instantáneo)
--------------------------------------------------------- */
function buscarEnDatosLocales(texto) {

    const clave = normalizarTextoClave(texto);

    if (!clave) {
        return [];
    }

    const salida = [];

    const fuentes = [
        { data: departamentosData, esMunicipio: false },
        { data: municipiosData, esMunicipio: true }
    ];

    fuentes.forEach(function (fuente) {

        const features =
            fuente.data && Array.isArray(fuente.data.features)
                ? fuente.data.features
                : [];

        features.forEach(function (feature) {

            if (salida.length >= CONFIG.limiteBusquedaLocal) {
                return;
            }

            const nombre = obtenerNombreFeature(feature);

            if (!normalizarTextoClave(nombre).includes(clave)) {
                return;
            }

            try {

                const coordenadas =
                    turf.pointOnFeature(feature).geometry.coordinates;

                const depto = fuente.esMunicipio
                    ? departamentoDeMunicipio(feature)
                    : "";

                salida.push({
                    lat: String(coordenadas[1]),
                    lon: String(coordenadas[0]),
                    name: nombre,
                    display_name: [nombre, depto, "Nicaragua"]
                        .filter(Boolean)
                        .join(", "),
                    type: fuente.esMunicipio ? "county" : "administrative",
                    class: "boundary",
                    address: fuente.esMunicipio
                        ? { county: nombre }
                        : { state: nombre },
                    fuente: "local"
                });

            } catch (_) {}
        });
    });

    return salida;
}


/* ---------------------------------------------------------
   Fuente 2: Nominatim (OpenStreetMap)
--------------------------------------------------------- */
async function buscarNominatim(texto, signal) {

    const b = CONFIG.bbox;

    const parametros = new URLSearchParams({
        q: texto,
        format: "jsonv2",
        addressdetails: "1",
        namedetails: "1",
        extratags: "1",
        limit: String(CONFIG.limiteBusqueda),
        countrycodes: "ni",
        "accept-language": "es",
        dedupe: "0",
        viewbox: `${b[0]},${b[3]},${b[2]},${b[1]}`
    });

    const respuesta = await fetch(
        `${CONFIG.urls.nominatim}?${parametros.toString()}`,
        {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: signal
        }
    );

    if (!respuesta.ok) {
        throw new Error(`Nominatim HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    return Array.isArray(datos) ? datos : [];
}


/* ---------------------------------------------------------
   Fuente 3: Photon (OpenStreetMap, tolera errores de escritura
   y nombres parciales)
--------------------------------------------------------- */
async function buscarPhoton(texto, signal) {

    const b = CONFIG.bbox;

    const parametros = new URLSearchParams({
        q: texto,
        limit: String(CONFIG.limiteBusquedaPhoton),
        lat: String(CONFIG.centro[0]),
        lon: String(CONFIG.centro[1]),
        bbox: `${b[0]},${b[1]},${b[2]},${b[3]}`
    });

    const respuesta = await fetch(
        `${CONFIG.urls.photon}?${parametros.toString()}`,
        {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: signal
        }
    );

    if (!respuesta.ok) {
        throw new Error(`Photon HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    const features = Array.isArray(datos.features) ? datos.features : [];

    return features
        .filter(function (f) {
            const pais = f.properties && f.properties.countrycode;
            return !pais || String(pais).toUpperCase() === "NI";
        })
        .map(function (f) {

            const p = f.properties || {};
            const coordenadas = f.geometry.coordinates;

            const calle = p.street
                ? (p.housenumber ? `${p.street} ${p.housenumber}` : p.street)
                : "";

            const partes = [
                p.name, calle, p.district, p.city,
                p.county, p.state, p.country
            ].filter(Boolean);

            const unicas = partes.filter(
                (x, i) => partes.indexOf(x) === i
            );

            return {
                lat: String(coordenadas[1]),
                lon: String(coordenadas[0]),
                name: p.name || calle || unicas[0] || "Ubicación",
                display_name: unicas.join(", ") || "Ubicación",
                type: p.osm_value,
                class: p.osm_key,
                address: p.osm_key === "highway"
                    ? { road: p.name || calle }
                    : {},
                fuente: "photon"
            };
        });
}


/* ---------------------------------------------------------
   Unir resultados sin repetir lugares
--------------------------------------------------------- */
function combinarResultados() {

    const listas = Array.prototype.slice.call(arguments);

    const vistos = new Set();
    const salida = [];

    listas.forEach(function (lista) {

        (lista || []).forEach(function (r) {

            if (!r || !r.lat || !r.lon) {
                return;
            }

            const nombre = r.name || r.display_name || "";

            const clave =
                normalizarTextoClave(nombre) + "|" +
                Number(r.lat).toFixed(3) + "|" +
                Number(r.lon).toFixed(3);

            if (vistos.has(clave)) {
                return;
            }

            vistos.add(clave);
            salida.push(r);
        });
    });

    return salida;
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

    const senal = controladorBusqueda.signal;

    mostrarEstadoBusqueda("Buscando ubicaciones...");

    try {

        /* Lo local aparece de inmediato mientras responden los servicios */
        const locales = buscarEnDatosLocales(texto);

        if (locales.length) {
            mostrarResultadosDirecciones(locales);
        }

        const respuestas = await Promise.allSettled([
            buscarNominatim(texto, senal),
            buscarPhoton(texto, senal)
        ]);

        if (solicitud !== numeroSolicitudBusqueda) {
            return;
        }

        const nominatim = respuestas[0];
        const photon = respuestas[1];

        if (
            nominatim.status === "rejected" &&
            photon.status === "rejected"
        ) {

            if (
                (nominatim.reason && nominatim.reason.name === "AbortError") ||
                (photon.reason && photon.reason.name === "AbortError")
            ) {
                return;
            }

            if (locales.length) {
                return;
            }

            throw nominatim.reason;
        }

        const deNominatim =
            nominatim.status === "fulfilled" ? nominatim.value : [];

        const dePhoton =
            photon.status === "fulfilled" ? photon.value : [];

        mostrarResultadosDirecciones(
            combinarResultados(locales, deNominatim, dePhoton)
        );

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
            "living_street", "primary", "secondary", "tertiary",
            "trunk", "unclassified"
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
        return "Barrio o zona";
    }

    if (address.hamlet || tipo === "hamlet") {
        return "Caserío o comarca";
    }

    if (address.village || tipo === "village") {
        return "Comarca o pueblo";
    }

    if (address.town || tipo === "town") {
        return "Población o municipio";
    }

    if (address.city || tipo === "city") {
        return "Ciudad";
    }

    if (address.county || tipo === "county") {
        return "Municipio o división administrativa";
    }

    if (address.state || tipo === "administrative") {
        return "Departamento o división administrativa";
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
            resultado.name || String(resultado.display_name || "Ubicación").split(",")[0];

        Object.assign(nombre.style, {
            display: "block",
            fontSize: "14px",
            color: "#0f172a"
        });

        const descripcion = document.createElement("span");

        descripcion.textContent = resultado.display_name || "";

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
        resultado.name || String(resultado.display_name || "Ubicación").split(",")[0];

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

    if (tipo.includes("Departamento")) {
        zoom = 9;
    } else if (
        tipo.includes("Municipio") ||
        tipo.includes("municipio") ||
        tipo.includes("Ciudad")
    ) {
        zoom = 12;
    } else if (
        tipo.includes("Comarca") ||
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
   LISTA DE DEPARTAMENTOS (usa #listaDepartamentos)
   Incluye las 2 regiones autónomas para poder pintarlas.
========================================================= */

function actualizarListaDepartamentos() {

    const lista = document.getElementById("listaDepartamentos");

    if (!lista) {
        return;
    }

    lista.innerHTML = "";

    if (!departamentosData || !departamentosData.features) {
        return;
    }

    const input = document.getElementById("buscarLista");
    const filtro = input ? normalizarTextoClave(input.value) : "";

    const departamentos = departamentosData.features
        .slice()
        .sort((a, b) =>
            obtenerNombreFeature(a)
                .localeCompare(obtenerNombreFeature(b), "es")
        );

    departamentos.forEach(feature => {

        const nombre = obtenerNombreFeature(feature);

        if (filtro && !normalizarTextoClave(nombre).includes(filtro)) {
            return;
        }

        const elemento = document.createElement("button");
        elemento.type = "button";
        elemento.className = "item-departamento";
        elemento.textContent = nombre;

        elemento.addEventListener("click", function () {
            seleccionarDepartamento(feature);
        });

        lista.appendChild(elemento);
    });

    /* --- Total: 15 departamentos --- */
    const totalElemento = document.getElementById("totalDepartamentos");

    if (totalElemento) {
        totalElemento.textContent = String(DEPARTAMENTOS_15.length);
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
    vincularBoton("btnPintarProvincias", iniciarDepartamentos);
    vincularBoton("btnPintarDepartamentos", iniciarDepartamentos);
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

    actualizarInterfazPermisos();

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

    if (!exigirPermisoEdicion()) return;

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
            STORAGE_MUNICIPIOS,
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

    if (!exigirPermisoEdicion()) return;

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

        if (nivelActivo === "municipios") {
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
window.iniciarProvincias = iniciarDepartamentos;
window.iniciarDepartamentos = iniciarDepartamentos;
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

/* Diagnóstico de permisos para soporte */
window.verificarPermisosCoberturas = inicializarPermisosMapa;
window.obtenerEstadoPermisosCoberturas = function () {
    return {
        correo: CORREO_USUARIO_ACTUAL,
        puedeEditar: PUEDE_EDITAR_MAPA,
        inicializado: PERMISOS_INICIALIZADOS
    };
};