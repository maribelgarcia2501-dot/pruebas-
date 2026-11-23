
"use strict";

/* =========================================================
   SACAR DATA - MENSAJERÍA EXPRESS PANAMÁ
   =========================================================
   FUNCIONES:
   - Provincias de Panamá
   - Distritos
   - Ubicaciones marcadas
   - Cobertura
   - Dirección
   - Exportación Excel
   - Caché persistente
========================================================= */

(function () {

    "use strict";

    /* ================= CONFIGURACIÓN ================= */

    const BTN_DATA = "btnSacarData";

    const STORAGE_ZONAS =
        "mensajeriaExpressZonasCoberturaPanama";

    const STORAGE_CACHE_GEO =
        "mensajeriaExpressCacheGeoPanama_v1";

    const URL_REVERSE =
        "https://nominatim.openstreetmap.org/reverse";

    const TXT_NO_COBERTURA =
        "No tenemos cobertura";

    const TXT_SI_COBERTURA =
        "Sí tenemos cobertura";

    /* ================= PROVINCIAS ================= */

    const PROVINCIAS_PANAMA = [

        "Bocas del Toro",
        "Coclé",
        "Colón",
        "Chiriquí",
        "Darién",
        "Herrera",
        "Los Santos",
        "Panamá",
        "Panamá Oeste",
        "Veraguas"

    ];

    /* ================= COMARCAS ================= */

    const COMARCAS_PANAMA = [

        "Guna Yala",
        "Emberá-Wounaan",
        "Ngäbe-Buglé",
        "Naso Tjër Di",
        "Madugandí",
        "Wargandí"

    ];

    /* ================= CENTROS ================= */

    const CENTROS_PROVINCIAS = {

        "Bocas del Toro":
            [9.34, -82.24],

        "Coclé":
            [8.40, -80.42],

        "Colón":
            [9.35, -79.90],

        "Chiriquí":
            [8.43, -82.43],

        "Darién":
            [8.30, -77.90],

        "Herrera":
            [7.85, -80.65],

        "Los Santos":
            [7.88, -80.42],

        "Panamá":
            [9.00, -79.52],

        "Panamá Oeste":
            [8.85, -79.78],

        "Veraguas":
            [8.20, -81.10]

    };

    /* ================= CENTROS COMARCAS ================= */

    const CENTROS_COMARCAS = {

        "Guna Yala":
            [9.23, -78.05],

        "Emberá-Wounaan":
            [8.00, -77.60],

        "Ngäbe-Buglé":
            [8.67, -81.80],

        "Naso Tjër Di":
            [9.20, -82.65],

        "Madugandí":
            [9.25, -78.55],

        "Wargandí":
            [8.95, -78.20]

    };

    /* ================= CACHÉ ================= */

    function cargarCacheGeo() {

        try {

            const g =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_CACHE_GEO
                    ) || "null"
                );

            if (
                g &&
                g.reverse &&
                g.detalle
            ) {

                return g;

            }

        } catch (error) {
        }

        return {
            reverse: {},
            detalle: {}
        };
    }

    const cacheGeo =
        cargarCacheGeo();

    let guardarCacheTimer =
        null;

    function guardarCacheGeo() {

        clearTimeout(
            guardarCacheTimer
        );

        guardarCacheTimer =
            setTimeout(
                function () {

                    try {

                        localStorage.setItem(
                            STORAGE_CACHE_GEO,
                            JSON.stringify(
                                cacheGeo
                            )
                        );

                    } catch (error) {
                    }

                },
                500
            );
    }

    /* ================= VARIABLES ================= */

    let dataCoberturas = [];

    let seleccionadas =
        new Set();

    let cacheUbicaciones = {};

    let cacheDistritos = {};

    let cacheReverse =
        cacheGeo.reverse;

    const cacheDetalle =
        cacheGeo.detalle;

    let ultimaPeticionNominatim =
        0;

    let provinciaSeleccionada =
        "Panamá";

    /* ================= INICIAR ================= */

    function iniciarSacarData() {

        const boton =
            document.getElementById(
                BTN_DATA
            );

        if (!boton) {

            console.warn(
                "Sacar Data: no existe #btnSacarData"
            );

            return;
        }

        if (
            boton.dataset
                .sacarDataInicializado === "1"
        ) {

            return;
        }

        boton.dataset
            .sacarDataInicializado = "1";

        boton.addEventListener(
            "click",
            abrirSacarData
        );
    }

    /* ================= NORMALIZAR ================= */

    function normalizarTexto(texto) {

        return String(texto || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /[\s_-]+/g,
                " "
            );
    }

    function normalizarProvincia(texto) {

        return normalizarTexto(texto)
            .replace(
                /^provincia (de )?/,
                ""
            )
            .replace(
                /\s+province$/,
                ""
            )
            .trim();
    }

    function buscarProvinciaEnLista(valor) {

        const normalizado =
            normalizarProvincia(
                valor
            );

        if (!normalizado) {

            return "";
        }

        const todas =
            [
                ...PROVINCIAS_PANAMA,
                ...COMARCAS_PANAMA
            ];

        const exacto =
            todas.find(
                function (x) {

                    return (
                        normalizarTexto(x) ===
                        normalizado
                    );

                }
            );

        if (exacto) {

            return exacto;
        }

        const parcial =
            todas.find(
                function (x) {

                    return normalizado.includes(
                        normalizarTexto(x)
                    );

                }
            );

        return parcial || "";
    }

    function escaparHTML(texto) {

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

    function formatearNumero(numero) {

        const valor =
            Number(numero);

        if (
            !Number.isFinite(
                valor
            )
        ) {

            return "-";
        }

        return valor.toFixed(
            6
        );
    }

    function buscarPropiedad(
        feature,
        propiedades
    ) {

        if (
            !feature ||
            !feature.properties
        ) {

            return "";
        }

        const props =
            feature.properties;

        for (
            const nombre of propiedades
        ) {

            if (
                props[nombre] !== undefined &&
                props[nombre] !== null &&
                String(
                    props[nombre]
                ).trim() !== ""
            ) {

                return props[nombre];
            }
        }

        return "";
    }

    /* ================= COLORES ================= */

    function obtenerColorData(tipo) {

        const valor =
            normalizarTexto(
                tipo
            )
            .replace(
                /[\s_-]+/g,
                ""
            );

        if (
            valor === "sameday" ||
            valor === "mismodia"
        ) {

            return "#22c55e";
        }

        if (
            valor === "nextday" ||
            valor === "siguientedia" ||
            valor === "next"
        ) {

            return "#3b82f6";
        }

        if (
            valor === "72h" ||
            valor === "72horas"
        ) {

            return "#ef4444";
        }

        if (
            valor === "nocobertura" ||
            valor === "sincobertura"
        ) {

            return "#94a3b8";
        }

        if (
            valor === "alto" ||
            valor === "altoriesgo"
        ) {

            return "#f59e0b";
        }

        return "#22c55e";
    }

    function nombreColorData(tipo) {

        const valor =
            normalizarTexto(
                tipo
            );

        if (
            valor.includes("same") ||
            valor.includes("mismo")
        ) {

            return "Verde";
        }

        if (
            valor.includes("next") ||
            valor.includes("siguiente")
        ) {

            return "Azul";
        }

        if (
            valor.includes("72")
        ) {

            return "Rojo";
        }

        if (
            valor.includes("alto")
        ) {

            return "Naranja";
        }

        if (
            valor.includes("no cobertura") ||
            valor.includes("sin cobertura")
        ) {

            return "Gris";
        }

        return "Verde";
    }

    function nombreCoberturaData(tipo) {

        const valor =
            normalizarTexto(
                tipo
            );

        if (
            valor === "sameday" ||
            valor === "mismodia"
        ) {

            return "Same Day";
        }

        if (
            valor === "nextday" ||
            valor === "siguientedia"
        ) {

            return "Next Day";
        }

        if (
            valor === "72h" ||
            valor === "72horas"
        ) {

            return "48 horas";
        }

        if (
            valor === "nocobertura" ||
            valor === "sincobertura"
        ) {

            return "No hay cobertura";
        }

        if (
            valor === "alto" ||
            valor === "altoriesgo"
        ) {

            return "Zonas de alto riesgo";
        }

        return tipo ||
            "Sin definir";
    }

    function obtenerEstadoViaje(tipo) {

        const valor =
            normalizarTexto(
                tipo
            );

        if (
            valor.includes("alto") ||
            valor.includes("riesgo") ||
            valor.includes("no cobertura") ||
            valor.includes("sin cobertura")
        ) {

            return TXT_NO_COBERTURA;
        }

        return TXT_SI_COBERTURA;
    }

    /* ================= OBTENER COBERTURAS ================= */

    function obtenerCoberturas() {

        let datos = [];

        try {

            if (
                typeof grupoCoberturas !==
                    "undefined" &&
                grupoCoberturas
            ) {

                grupoCoberturas.eachLayer(
                    function (layer) {

                        if (!layer) {
                            return;
                        }

                        if (
                            layer.feature &&
                            layer.feature.geometry
                        ) {

                            datos.push(
                                JSON.parse(
                                    JSON.stringify(
                                        layer.feature
                                    )
                                )
                            );
                        }

                    }
                );
            }

        } catch (error) {

            console.warn(
                "Error leyendo coberturas del mapa:",
                error
            );
        }

        /* ================= LOCALSTORAGE ================= */

        if (!datos.length) {

            try {

                const guardado =
                    localStorage.getItem(
                        STORAGE_ZONAS
                    );

                if (guardado) {

                    const parsed =
                        JSON.parse(
                            guardado
                        );

                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        datos =
                            parsed;
                    }
                }

            } catch (error) {

                console.warn(
                    "Error leyendo coberturas guardadas:",
                    error
                );
            }
        }

        return datos;
    }

    /* ================= CENTRO ================= */

    function obtenerCentroFeature(feature) {

        try {

            if (
                typeof turf !==
                    "undefined" &&
                feature &&
                feature.geometry
            ) {

                const punto =
                    turf.pointOnFeature(
                        feature
                    );

                return {

                    lat:
                        Number(
                            punto.geometry
                                .coordinates[1]
                        ),

                    lon:
                        Number(
                            punto.geometry
                                .coordinates[0]
                        )

                };
            }

        } catch (error) {
        }

        try {

            const bounds =
                L.geoJSON(
                    feature
                ).getBounds();

            const centro =
                bounds.getCenter();

            return {

                lat:
                    centro.lat,

                lon:
                    centro.lng

            };

        } catch (error) {

            return null;
        }
    }

    /* ================= PROVINCIA ================= */

    function obtenerProvinciaFeature(feature) {

        const valor =
            buscarPropiedad(
                feature,
                [

                    "provincia",
                    "Provincia",
                    "PROVINCIA",

                    "province",
                    "Province",
                    "PROVINCE",

                    "nombre_provincia",
                    "nombreProvincia",

                    "NAME_1",
                    "name_1",

                    "shapeName",
                    "ShapeName",
                    "SHAPENAME",

                    "comarca",
                    "Comarca",
                    "COMARCA",

                    "nombre_comarca",
                    "nombreComarca",

                    "name",
                    "NAME",

                    "nombre",
                    "Nombre"

                ]
            );

        if (valor) {

            const encontrado =
                buscarProvinciaEnLista(
                    valor
                );

            if (encontrado) {

                return encontrado;
            }
        }

        return "";
    }

    /* ================= PUNTO EN ANILLO ================= */

    function puntoEnAnillo(
        lon,
        lat,
        anillo
    ) {

        let dentro = false;

        for (
            let i = 0,
                j = anillo.length - 1;

            i < anillo.length;

            j = i++
        ) {

            const xi =
                anillo[i][0];

            const yi =
                anillo[i][1];

            const xj =
                anillo[j][0];

            const yj =
                anillo[j][1];

            const cruza =
                ((yi > lat) !==
                    (yj > lat)) &&
                (
                    lon <
                    (
                        (xj - xi) *
                        (lat - yi)
                    ) /
                    (yj - yi) +
                    xi
                );

            if (cruza) {

                dentro =
                    !dentro;
            }
        }

        return dentro;
    }

    function puntoEnPoligono(
        lon,
        lat,
        coordenadas
    ) {

        if (
            !coordenadas ||
            !coordenadas.length ||
            !puntoEnAnillo(
                lon,
                lat,
                coordenadas[0]
            )
        ) {

            return false;
        }

        for (
            let k = 1;
            k < coordenadas.length;
            k++
        ) {

            if (
                puntoEnAnillo(
                    lon,
                    lat,
                    coordenadas[k]
                )
            ) {

                return false;
            }
        }

        return true;
    }

    function puntoEnGeometria(
        lon,
        lat,
        geometria
    ) {

        if (!geometria) {
            return false;
        }

        if (
            geometria.type ===
            "Polygon"
        ) {

            return puntoEnPoligono(
                lon,
                lat,
                geometria.coordinates
            );
        }

        if (
            geometria.type ===
            "MultiPolygon"
        ) {

            return geometria.coordinates.some(
                function (poligono) {

                    return puntoEnPoligono(
                        lon,
                        lat,
                        poligono
                    );

                }
            );
        }

        return false;
    }

    /* ================= PROVINCIA POR CAPA ================= */

    function obtenerProvinciaPorCapa(
        lat,
        lon
    ) {

        if (
            typeof capaDepartamentos ===
                "undefined" ||
            !capaDepartamentos ||
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return "";
        }

        let resultado = "";

        function revisar(layer) {

            if (
                resultado ||
                !layer
            ) {

                return;
            }

            if (
                layer.feature &&
                layer.feature.geometry
            ) {

                if (
                    puntoEnGeometria(
                        lon,
                        lat,
                        layer.feature.geometry
                    )
                ) {

                    const props =
                        layer.feature
                            .properties ||
                        {};

                    const posibles =
                        [

                            props.provincia,
                            props.Provincia,
                            props.PROVINCIA,

                            props.province,
                            props.Province,
                            props.PROVINCE,

                            props.comarca,
                            props.Comarca,
                            props.COMARCA,

                            props.nombre_provincia,
                            props.nombreProvincia,

                            props.nombre_comarca,
                            props.nombreComarca,

                            props.nombre,
                            props.Nombre,

                            props.name,
                            props.NAME,

                            props.NAME_1,
                            props.name_1,

                            props.shapeName,
                            props.ShapeName,
                            props.SHAPENAME

                        ];

                    for (
                        const valor
                            of posibles
                    ) {

                        const encontrado =
                            buscarProvinciaEnLista(
                                valor
                            );

                        if (
                            encontrado
                        ) {

                            resultado =
                                encontrado;

                            return;
                        }
                    }
                }

                return;
            }

            if (
                typeof layer.eachLayer ===
                "function"
            ) {

                layer.eachLayer(
                    revisar
                );
            }
        }

        try {

            capaDepartamentos.eachLayer(
                revisar
            );

        } catch (error) {
        }

        return resultado;
    }

    /* ================= CERCANÍA ================= */

    function obtenerProvinciaPorCercania(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return "";
        }

        let mejor = "";

        let mejorDistancia =
            Infinity;

        const centros = {

            ...CENTROS_PROVINCIAS,
            ...CENTROS_COMARCAS

        };

        for (
            const nombre
                of Object.keys(
                    centros
                )
        ) {

            const centro =
                centros[
                    nombre
                ];

            const distancia =
                Math.pow(
                    centro[0] -
                    lat,
                    2
                ) +
                Math.pow(
                    centro[1] -
                    lon,
                    2
                );

            if (
                distancia <
                mejorDistancia
            ) {

                mejorDistancia =
                    distancia;

                mejor =
                    nombre;
            }
        }

        return mejor;
    }

    /* ================= NOMINATIM ================= */

    async function esperarNominatim() {

        const ahora =
            Date.now();

        const espera =
            Math.max(
                0,
                ultimaPeticionNominatim +
                1100 -
                ahora
            );

        ultimaPeticionNominatim =
            ahora +
            espera;

        if (espera) {

            await new Promise(
                function (resolve) {

                    setTimeout(
                        resolve,
                        espera
                    );

                }
            );
        }
    }

    /* ================= DISTRITO ================= */

    function obtenerDistritoFeature(feature) {

        const valor =
            buscarPropiedad(
                feature,
                [

                    "distrito",
                    "Distrito",
                    "DISTRITO",

                    "district",
                    "District",
                    "DISTRICT",

                    "municipio",
                    "Municipio",
                    "MUNICIPIO",

                    "nombre_distrito",
                    "nombreDistrito",

                    "nombre_municipio",
                    "nombreMunicipio",

                    "NAME_2",
                    "name_2",

                    "NAME",
                    "name",

                    "nombre",
                    "Nombre"

                ]
            );

        if (valor) {

            return String(
                valor
            ).trim();
        }

        return "";
    }

    /* ================= DETALLE ================= */

    async function obtenerDetalle(
        lat,
        lon
    ) {

        const key =
            lat.toFixed(5) +
            "," +
            lon.toFixed(5);

        if (
            cacheDetalle[key]
        ) {

            return cacheDetalle[
                key
            ];
        }

        const url =
            URL_REVERSE +
            "?lat=" +
            encodeURIComponent(
                lat
            ) +
            "&lon=" +
            encodeURIComponent(
                lon
            ) +
            "&format=jsonv2" +
            "&zoom=18" +
            "&addressdetails=1" +
            "&accept-language=es" +
            "&countrycodes=pa";

        await esperarNominatim();

        const respuesta =
            await fetch(
                url,
                {
                    headers: {

                        "Accept":
                            "application/json"

                    }
                }
            );

        if (
            !respuesta.ok
        ) {

            return null;
        }

        const datos =
            await respuesta.json();

        cacheDetalle[key] = {

            name:
                datos.name ||
                "",

            display_name:
                datos.display_name ||
                "",

            address:
                datos.address ||
                {}

        };

        guardarCacheGeo();

        return cacheDetalle[
            key
        ];
    }

    /* ================= NOMBRE LUGAR ================= */

    async function buscarNombreLugar(
        lat,
        lon,
        feature
    ) {

        const nombreGuardado =
            buscarPropiedad(
                feature,
                [

                    "nombre_lugar",
                    "nombreLugar",

                    "nombre_ubicacion",
                    "nombreUbicacion",

                    "ubicacion",
                    "lugar",

                    "place_name",
                    "placeName",

                    "name",
                    "nombre"

                ]
            );

        if (
            nombreGuardado
        ) {

            return nombreGuardado;
        }

        const nombre =
            buscarPropiedad(
                feature,
                [
                    "name",
                    "nombre"
                ]
            );

        if (nombre) {

            return nombre;
        }

        if (
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return "Ubicación marcada";
        }

        const cacheKey =
            lat.toFixed(5) +
            "," +
            lon.toFixed(5);

        if (
            cacheUbicaciones[
                cacheKey
            ]
        ) {

            return cacheUbicaciones[
                cacheKey
            ];
        }

        try {

            const datos =
                await obtenerDetalle(
                    lat,
                    lon
                );

            if (!datos) {

                return "Ubicación marcada";
            }

            const a =
                datos.address ||
                {};

            const posibles = [

                datos.name,

                a.amenity,
                a.tourism,
                a.leisure,
                a.shop,
                a.building,
                a.office,
                a.school,
                a.college,
                a.university,
                a.hospital,
                a.restaurant,
                a.cafe

            ];

            let encontrado =
                "";

            for (
                const valor
                    of posibles
            ) {

                if (
                    valor &&
                    String(
                        valor
                    ).trim()
                ) {

                    encontrado =
                        String(
                            valor
                        ).trim();

                    break;
                }
            }

            if (
                !encontrado &&
                a.road
            ) {

                encontrado =
                    a.road;
            }

            if (!encontrado) {

                encontrado =
                    "Ubicación marcada";
            }

            cacheUbicaciones[
                cacheKey
            ] =
                encontrado;

            return encontrado;

        } catch (error) {

            console.warn(
                "Error reverse geocoding:",
                error
            );

            return "Ubicación marcada";
        }
    }

    /* ================= DISTRITO POR COORDENADAS ================= */

    async function buscarDistritoPorCoordenadas(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return "Sin distrito";
        }

        const key =
            lat.toFixed(4) +
            "," +
            lon.toFixed(4);

        if (
            cacheDistritos[
                key
            ]
        ) {

            return cacheDistritos[
                key
            ];
        }

        try {

            const datos =
                await obtenerReverse(
                    lat,
                    lon
                );

            if (!datos) {

                return "Sin distrito";
            }

            const address =
                datos.address ||
                {};

            const distrito =
                address.city_district ||
                address.municipality ||
                address.city ||
                address.town ||
                address.village ||
                address.county ||
                address.suburb ||
                "";

            const resultado =
                String(
                    distrito ||
                    "Sin distrito"
                ).trim();

            cacheDistritos[
                key
            ] =
                resultado;

            return resultado;

        } catch (error) {

            console.warn(
                "No se pudo obtener distrito:",
                error
            );

            return "Sin distrito";
        }
    }

    /* ================= DIRECCIÓN ================= */

    async function buscarDireccion(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return "";
        }

        try {

            const datos =
                await obtenerDetalle(
                    lat,
                    lon
                );

            return (
                datos &&
                datos.display_name
            ) || "";

        } catch (error) {

            return "";
        }
    }

    /* ================= MODAL ================= */

    function crearModal() {

        if (
            document.getElementById(
                "modalSacarData"
            )
        ) {

            return;
        }

        const modal =
            document.createElement(
                "div"
            );

        modal.id =
            "modalSacarData";

        modal.innerHTML = `

<style>

#modalSacarData {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: none;
    background: rgba(15,23,42,.72);
    backdrop-filter: blur(4px);
}

#modalSacarData.abierto {
    display: flex;
    align-items: center;
    justify-content: center;
}

.sacar-data-contenedor {
    width: min(1450px,95vw);
    height: min(850px,92vh);
    background: #ffffff;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,.30);
    display: flex;
    flex-direction: column;
}

.sacar-data-header {
    min-height: 76px;
    padding: 16px 22px;
    background: #0f172a;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
}

.sacar-data-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.sacar-data-icono {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(255,255,255,.10);
    display: flex;
    align-items: center;
    justify-content: center;
}

.sacar-data-header h2 {
    margin: 0;
    font-size: 18px;
}

.sacar-data-header p {
    margin: 4px 0 0;
    font-size: 12px;
    opacity: .72;
}

.sacar-data-cerrar {
    border: 0;
    background: rgba(255,255,255,.10);
    color: white;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    cursor: pointer;
}

.sacar-data-toolbar {
    padding: 12px 18px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.sacar-data-buscador {
    flex: 1;
    min-width: 250px;
    position: relative;
}

.sacar-data-buscador i {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
}

.sacar-data-buscador input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px 10px 36px;
    border: 1px solid #dbe1e8;
    border-radius: 10px;
    outline: none;
}

.sacar-data-acciones {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.sacar-data-acciones button {
    border: 0;
    border-radius: 9px;
    padding: 10px 13px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
}

.btn-sacar-excel {
    background: #16a34a;
    color: white;
}

.btn-sacar-secundario {
    background: #f1f5f9;
    color: #334155;
}

.sacar-data-cuerpo {
    flex: 1;
    min-height: 0;
    display: flex;
}

.sacar-data-departamentos {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid #e5e7eb;
    background: #f8fafc;
    overflow-y: auto;
    padding: 12px;
}

.sacar-data-departamento {
    width: 100%;
    border: 1px solid transparent;
    background: white;
    padding: 12px;
    margin-bottom: 8px;
    border-radius: 11px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.sacar-data-departamento.activo {
    border-color: #2563eb;
    background: #eff6ff;
}

.sacar-data-departamento-nombre {
    font-weight: 700;
    color: #0f172a;
    font-size: 13px;
}

.sacar-data-departamento-sub {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
}

.sacar-data-contador {
    min-width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
}

.sacar-data-departamento.activo .sacar-data-contador {
    background: #2563eb;
    color: white;
}

.sacar-data-resultados {
    flex: 1;
    overflow: auto;
    padding: 18px;
    background: white;
}

.sacar-data-resumen {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.sacar-data-resumen-card {
    border: 1px solid #e5e7eb;
    border-radius: 11px;
    padding: 11px 14px;
    min-width: 130px;
}

.sacar-data-resumen-card span {
    display: block;
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 700;
}

.sacar-data-resumen-card strong {
    display: block;
    margin-top: 3px;
    font-size: 18px;
    color: #0f172a;
}

.sacar-data-municipio {
    margin-bottom: 18px;
}

.sacar-data-municipio-titulo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.sacar-data-municipio-titulo i {
    color: #2563eb;
}

.sacar-data-municipio-titulo strong {
    font-size: 15px;
    color: #0f172a;
}

.sacar-data-ubicacion {
    border: 1px solid #e2e8f0;
    border-left: 4px solid #2563eb;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    background: white;
    transition: .15s;
}

.sacar-data-ubicacion:hover {
    box-shadow: 0 7px 22px rgba(15,23,42,.08);
    transform: translateY(-1px);
}

.sacar-data-ubicacion-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
}

.sacar-data-ubicacion-nombre {
    font-weight: 800;
    color: #0f172a;
    font-size: 14px;
}

.sacar-data-ubicacion-direccion {
    color: #64748b;
    font-size: 11px;
    margin-top: 4px;
}

.sacar-data-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 999px;
    padding: 5px 9px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
}

.sacar-data-badge-punto {
    width: 7px;
    height: 7px;
    border-radius: 50%;
}

.sacar-data-detalles {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 10px;
    color: #475569;
    font-size: 10px;
}

.sacar-data-no-viaje {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fed7aa;
    padding: 5px 8px;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 800;
}

.sacar-data-si-viaje {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
    padding: 5px 8px;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 800;
}

.sacar-data-vacio {
    padding: 60px 20px;
    text-align: center;
    color: #64748b;
}

.sacar-data-loading {
    padding: 50px;
    text-align: center;
    color: #64748b;
}

@media(max-width:800px) {

    .sacar-data-contenedor {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
    }

    .sacar-data-departamentos {
        width: 210px;
        min-width: 210px;
    }

}

</style>

<div class="sacar-data-contenedor">

    <div class="sacar-data-header">

        <div class="sacar-data-header-left">

            <div class="sacar-data-icono">
                <i class="fa-solid fa-database"></i>
            </div>

            <div>

                <h2>
                    Datos de Cobertura - Panamá
                </h2>

                <p>
                    Provincias, distritos y ubicaciones marcadas
                </p>

            </div>

        </div>

        <button
            type="button"
            class="sacar-data-cerrar"
            id="cerrarSacarData">

            <i class="fa-solid fa-xmark"></i>

        </button>

    </div>

    <div class="sacar-data-toolbar">

        <div class="sacar-data-buscador">

            <i class="fa-solid fa-magnifying-glass"></i>

            <input
                type="search"
                id="buscarSacarData"
                placeholder="Buscar provincia, distrito o ubicación...">

        </div>

        <div class="sacar-data-acciones">

            <button
                type="button"
                class="btn-sacar-secundario"
                id="seleccionarTodoData">

                <i class="fa-solid fa-check-double"></i>
                Seleccionar todo

            </button>

            <button
                type="button"
                class="btn-sacar-secundario"
                id="limpiarSeleccionData">

                <i class="fa-solid fa-xmark"></i>
                Limpiar

            </button>

            <button
                type="button"
                class="btn-sacar-excel"
                id="descargarExcelData">

                <i class="fa-solid fa-file-excel"></i>
                Descargar Excel

            </button>

        </div>

    </div>

    <div class="sacar-data-cuerpo">

        <aside
            class="sacar-data-departamentos"
            id="listaDepartamentosData">
        </aside>

        <main
            class="sacar-data-resultados"
            id="resultadosData">
        </main>

    </div>

</div>

`;

        document.body.appendChild(
            modal
        );

        document
            .getElementById(
                "cerrarSacarData"
            )
            .addEventListener(
                "click",
                cerrarSacarData
            );

        modal.addEventListener(
            "click",
            function (e) {

                if (
                    e.target ===
                    modal
                ) {

                    cerrarSacarData();
                }

            }
        );

        document
            .getElementById(
                "seleccionarTodoData"
            )
            .addEventListener(
                "click",
                seleccionarTodo
            );

        document
            .getElementById(
                "limpiarSeleccionData"
            )
            .addEventListener(
                "click",
                limpiarSeleccion
            );

        document
            .getElementById(
                "descargarExcelData"
            )
            .addEventListener(
                "click",
                descargarExcel
            );

        document
            .getElementById(
                "buscarSacarData"
            )
            .addEventListener(
                "input",
                function () {

                    renderizarResultados(
                        this.value,
                        provinciaSeleccionada
                    );

                }
            );
    }

    /* ================= ABRIR ================= */

    async function abrirSacarData() {

        crearModal();

        const modal =
            document.getElementById(
                "modalSacarData"
            );

        modal.classList.add(
            "abierto"
        );

        document.body.style.overflow =
            "hidden";

        seleccionadas.clear();

        const resultados =
            document.getElementById(
                "resultadosData"
            );

        resultados.innerHTML = `

            <div class="sacar-data-loading">

                <i class="fa-solid fa-spinner fa-spin"></i>

                <div>
                    Preparando datos de cobertura...
                </div>

                <div id="progresoSacarData">
                </div>

            </div>

        `;

        dataCoberturas =
            obtenerCoberturas();

        await prepararDatos();

        renderizarProvincias();

        provinciaSeleccionada =
            "Panamá";

        renderizarResultados(
            "",
            provinciaSeleccionada
        );
    }

    /* ================= CERRAR ================= */

    function cerrarSacarData() {

        const modal =
            document.getElementById(
                "modalSacarData"
            );

        if (modal) {

            modal.classList.remove(
                "abierto"
            );
        }

        document.body.style.overflow =
            "";
    }

    /* ================= PREPARAR ================= */

    async function prepararDatos() {

        const lista = [];

        for (
            let i = 0;
            i < dataCoberturas.length;
            i++
        ) {

            const progreso =
                document.getElementById(
                    "progresoSacarData"
                );

            if (progreso) {

                progreso.textContent =
                    "Procesando " +
                    (i + 1) +
                    " de " +
                    dataCoberturas.length +
                    "...";
            }

            const feature =
                dataCoberturas[i];

            const centro =
                obtenerCentroFeature(
                    feature
                );

            let lat =
                centro
                    ? centro.lat
                    : "";

            let lon =
                centro
                    ? centro.lon
                    : "";

            let provincia =
                obtenerProvinciaFeature(
                    feature
                );

            let distrito =
                obtenerDistritoFeature(
                    feature
                );

            /* ================= CAPA ================= */

            if (
                !provincia &&
                centro
            ) {

                provincia =
                    obtenerProvinciaPorCapa(
                        lat,
                        lon
                    );
            }

            /* ================= REVERSE ================= */

            if (
                (
                    !provincia ||
                    !distrito
                ) &&
                centro
            ) {

                try {

                    const reverse =
                        await obtenerReverse(
                            lat,
                            lon
                        );

                    if (!provincia) {

                        provincia =
                            obtenerProvinciaReverse(
                                reverse
                            );
                    }

                    if (!distrito) {

                        distrito =
                            obtenerDistritoReverse(
                                reverse
                            );
                    }

                } catch (error) {
                }
            }

            /* ================= CERCANÍA ================= */

            if (
                !provincia &&
                centro
            ) {

                provincia =
                    obtenerProvinciaPorCercania(
                        lat,
                        lon
                    );
            }

            /* ================= DISTRITO ================= */

            if (
                !distrito &&
                centro
            ) {

                distrito =
                    await buscarDistritoPorCoordenadas(
                        lat,
                        lon
                    );
            }

            /* ================= COBERTURA ================= */

            const tipo =
                buscarPropiedad(
                    feature,
                    [
                        "tipo",
                        "tipoCobertura",
                        "cobertura"
                    ]
                );

            const estado =
                buscarPropiedad(
                    feature,
                    [
                        "estado",
                        "status"
                    ]
                ) ||
                "activa";

            /* ================= UBICACIÓN ================= */

            let ubicacion =
                buscarPropiedad(
                    feature,
                    [

                        "nombre_lugar",
                        "nombreLugar",

                        "nombre_ubicacion",
                        "nombreUbicacion",

                        "ubicacion",
                        "lugar",

                        "place_name",
                        "placeName",

                        "name",
                        "nombre"

                    ]
                );

            if (
                !ubicacion &&
                centro
            ) {

                ubicacion =
                    await buscarNombreLugar(
                        lat,
                        lon,
                        feature
                    );
            }

            if (!ubicacion) {

                ubicacion =
                    "Ubicación marcada";
            }

            /* ================= DIRECCIÓN ================= */

            let direccion =
                buscarPropiedad(
                    feature,
                    [
                        "direccion",
                        "display_name",
                        "address"
                    ]
                );

            if (
                !direccion &&
                centro
            ) {

                direccion =
                    await buscarDireccion(
                        lat,
                        lon
                    );
            }

            const id =
                buscarPropiedad(
                    feature,
                    ["id"]
                ) ||
                "cobertura_" +
                i;

            lista.push({

                id:
                    id,

                feature:
                    feature,

                provincia:
                    provincia ||
                    "Panamá",

                distrito:
                    distrito ||
                    "Sin distrito",

                ubicacion:
                    ubicacion,

                direccion:
                    direccion ||
                    "",

                cobertura:
                    nombreCoberturaData(
                        tipo
                    ),

                tipoOriginal:
                    tipo,

                color:
                    nombreColorData(
                        tipo
                    ),

                colorHex:
                    obtenerColorData(
                        tipo
                    ),

                estado:
                    normalizarTexto(
                        estado
                    ) ===
                    "inactiva"
                        ? "Inactiva"
                        : "Activa",

                viajes:
                    obtenerEstadoViaje(
                        tipo
                    ),

                latitud:
                    lat,

                longitud:
                    lon

            });
        }

        dataCoberturas =
            lista;
    }

    /* ================= REVERSE ================= */

    async function obtenerReverse(
        lat,
        lon
    ) {

        const key =
            Number(lat).toFixed(4) +
            "," +
            Number(lon).toFixed(4);

        if (
            cacheReverse[key]
        ) {

            return cacheReverse[
                key
            ];
        }

        const url =
            URL_REVERSE +
            "?lat=" +
            encodeURIComponent(
                lat
            ) +
            "&lon=" +
            encodeURIComponent(
                lon
            ) +
            "&format=jsonv2" +
            "&zoom=10" +
            "&addressdetails=1" +
            "&accept-language=es" +
            "&countrycodes=pa";

        await esperarNominatim();

        const respuesta =
            await fetch(
                url
            );

        if (
            !respuesta.ok
        ) {

            return null;
        }

        const datos =
            await respuesta.json();

        cacheReverse[key] = {

            address:
                datos.address ||
                {}

        };

        guardarCacheGeo();

        return cacheReverse[
            key
        ];
    }

    function obtenerProvinciaReverse(
        datos
    ) {

        if (!datos) {
            return "";
        }

        const address =
            datos.address ||
            {};

        const posibles = [

            address.state,
            address.region,
            address.province,

            address["ISO3166-2-lvl4"]

        ];

        for (
            const valor
                of posibles
        ) {

            const encontrado =
                buscarProvinciaEnLista(
                    valor
                );

            if (
                encontrado
            ) {

                return encontrado;
            }
        }

        return "";
    }

    function obtenerDistritoReverse(
        datos
    ) {

        if (!datos) {
            return "";
        }

        const address =
            datos.address ||
            {};

        return String(

            address.city_district ||
            address.municipality ||
            address.city ||
            address.town ||
            address.village ||
            address.county ||
            address.suburb ||
            ""

        ).trim();
    }

    /* ================= AGRUPAR ================= */

    function agruparPorProvincia() {

        const grupos = {};

        [
            ...PROVINCIAS_PANAMA,
            ...COMARCAS_PANAMA
        ].forEach(
            function (provincia) {

                grupos[
                    provincia
                ] = [];

            }
        );

        for (
            const item
                of dataCoberturas
        ) {

            let provincia =
                item.provincia ||
                "Panamá";

            const encontrado =
                buscarProvinciaEnLista(
                    provincia
                );

            if (
                encontrado
            ) {

                provincia =
                    encontrado;
            }

            if (
                !grupos[
                    provincia
                ]
            ) {

                grupos[
                    provincia
                ] = [];
            }

            grupos[
                provincia
            ].push(
                item
            );
        }

        return grupos;
    }

    /* ================= CENTRAR ================= */

    function centrarEnProvincia(
        nombreProvincia
    ) {

        if (
            typeof mapa ===
                "undefined" ||
            !mapa
        ) {

            return;
        }

        let encontrado =
            false;

        try {

            if (
                typeof capaDepartamentos !==
                    "undefined" &&
                capaDepartamentos
            ) {

                capaDepartamentos.eachLayer(
                    function (layer) {

                        if (
                            encontrado
                        ) {

                            return;
                        }

                        const props =
                            layer.feature &&
                            layer.feature.properties
                                ? layer.feature.properties
                                : {};

                        const posibles = [

                            props.provincia,
                            props.Provincia,
                            props.PROVINCIA,

                            props.province,
                            props.Province,
                            props.PROVINCE,

                            props.comarca,
                            props.Comarca,
                            props.COMARCA,

                            props.nombre_provincia,
                            props.nombreProvincia,

                            props.nombre_comarca,
                            props.nombreComarca,

                            props.nombre,
                            props.Nombre,

                            props.name,
                            props.NAME,

                            props.NAME_1,
                            props.name_1,

                            props.shapeName,
                            props.ShapeName,
                            props.SHAPENAME

                        ];

                        const nombre =
                            posibles.find(
                                function (x) {

                                    return (
                                        x !==
                                            undefined &&
                                        x !==
                                            null &&
                                        String(
                                            x
                                        ).trim()
                                    );

                                }
                            );

                        if (
                            normalizarProvincia(
                                nombre
                            ) ===
                            normalizarProvincia(
                                nombreProvincia
                            )
                        ) {

                            try {

                                const bounds =
                                    layer.getBounds();

                                if (
                                    bounds &&
                                    bounds.isValid()
                                ) {

                                    mapa.fitBounds(
                                        bounds,
                                        {

                                            padding:
                                                [
                                                    25,
                                                    25
                                                ],

                                            maxZoom:
                                                10,

                                            animate:
                                                true,

                                            duration:
                                                .7

                                        }
                                    );

                                    encontrado =
                                        true;
                                }

                            } catch (error) {
                            }
                        }

                    }
                );
            }

        } catch (error) {

            console.warn(
                "Error centrando provincia:",
                error
            );
        }

        /* ================= FALLBACK ================= */

        if (
            !encontrado
        ) {

            const centro =
                {
                    ...CENTROS_PROVINCIAS,
                    ...CENTROS_COMARCAS
                }[
                    nombreProvincia
                ];

            if (centro) {

                mapa.setView(
                    centro,
                    10,
                    {

                        animate:
                            true,

                        duration:
                            .7

                    }
                );
            }
        }
    }

    /* ================= RENDER PROVINCIAS ================= */

    function renderizarProvincias() {

        const contenedor =
            document.getElementById(
                "listaDepartamentosData"
            );

        if (!contenedor) {
            return;
        }

        const grupos =
            agruparPorProvincia();

        contenedor.innerHTML =
            "";

        [
            ...PROVINCIAS_PANAMA,
            ...COMARCAS_PANAMA
        ].forEach(
            function (provincia) {

                const cantidad =
                    grupos[
                        provincia
                    ]
                        ? grupos[
                            provincia
                        ].length
                        : 0;

                const boton =
                    document.createElement(
                        "button"
                    );

                boton.type =
                    "button";

                boton.className =
                    "sacar-data-departamento";

                boton.dataset.provincia =
                    provincia;

                boton.innerHTML = `

                    <div>

                        <div class="sacar-data-departamento-nombre">

                            ${escaparHTML(
                                provincia
                            )}

                        </div>

                        <span class="sacar-data-departamento-sub">

                            ${cantidad}

                            ubicación${
                                cantidad === 1
                                    ? ""
                                    : "es"
                            }

                        </span>

                    </div>

                    <div class="sacar-data-contador">

                        ${cantidad}

                    </div>

                `;

                boton.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                ".sacar-data-departamento"
                            )
                            .forEach(
                                function (
                                    x
                                ) {

                                    x.classList.remove(
                                        "activo"
                                    );

                                }
                            );

                        this.classList.add(
                            "activo"
                        );

                        provinciaSeleccionada =
                            provincia;

                        centrarEnProvincia(
                            provincia
                        );

                        renderizarResultados(
                            "",
                            provincia
                        );
                    }
                );

                contenedor.appendChild(
                    boton
                );

            }
        );

        const botonInicial =
            Array.from(
                contenedor.children
            ).find(
                function (
                    boton
                ) {

                    return (
                        normalizarTexto(
                            boton.dataset
                                .provincia
                        ) ===
                        normalizarTexto(
                            provinciaSeleccionada
                        )
                    );

                }
            );

        if (
            botonInicial
        ) {

            botonInicial.classList.add(
                "activo"
            );
        }
    }

    /* ================= RESULTADOS ================= */

    function renderizarResultados(
        textoBusqueda = "",
        provinciaForzada = null
    ) {

        const contenedor =
            document.getElementById(
                "resultadosData"
            );

        if (!contenedor) {
            return;
        }

        if (
            provinciaForzada
        ) {

            provinciaSeleccionada =
                provinciaForzada;
        }

        const grupos =
            agruparPorProvincia();

        const provincia =
            provinciaSeleccionada;

        let datos =
            grupos[
                provincia
            ] || [];

        const busqueda =
            normalizarTexto(
                textoBusqueda
            );

        if (busqueda) {

            datos =
                datos.filter(
                    function (
                        item
                    ) {

                        const texto = [

                            item.provincia,
                            item.distrito,
                            item.ubicacion,
                            item.direccion,
                            item.cobertura,
                            item.estado,
                            item.viajes

                        ].join(
                            " "
                        );

                        return normalizarTexto(
                            texto
                        ).includes(
                            busqueda
                        );
                    }
                );
        }

        const activas =
            datos.filter(
                x =>
                    x.estado ===
                    "Activa"
            ).length;

        const noViajes =
            datos.filter(
                x =>
                    x.viajes ===
                    TXT_NO_COBERTURA
            ).length;

        contenedor.innerHTML = `

            <div class="sacar-data-resumen">

                <div class="sacar-data-resumen-card">

                    <span>
                        Provincia
                    </span>

                    <strong>

                        ${escaparHTML(
                            provincia
                        )}

                    </strong>

                </div>

                <div class="sacar-data-resumen-card">

                    <span>
                        Ubicaciones
                    </span>

                    <strong>
                        ${datos.length}
                    </strong>

                </div>

                <div class="sacar-data-resumen-card">

                    <span>
                        Activas
                    </span>

                    <strong>
                        ${activas}
                    </strong>

                </div>

                <div class="sacar-data-resumen-card">

                    <span>
                        Sin cobertura
                    </span>

                    <strong>
                        ${noViajes}
                    </strong>

                </div>

            </div>

        `;

        if (
            !datos.length
        ) {

            contenedor.innerHTML += `

                <div class="sacar-data-vacio">

                    <i class="fa-solid fa-location-dot"></i>

                    <strong>
                        No hay ubicaciones marcadas
                    </strong>

                    <span>

                        Esta provincia todavía no tiene
                        coberturas registradas.

                    </span>

                </div>

            `;

            return;
        }

        /* ================= DISTRITOS ================= */

        const distritos = {};

        datos.forEach(
            function (
                item
            ) {

                const distrito =
                    item.distrito ||
                    "Sin distrito";

                if (
                    !distritos[
                        distrito
                    ]
                ) {

                    distritos[
                        distrito
                    ] = [];
                }

                distritos[
                    distrito
                ].push(
                    item
                );

            }
        );

        Object.keys(
            distritos
        )
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.localeCompare(
                        b,
                        "es"
                    );

                }
            )
            .forEach(
                function (
                    distrito
                ) {

                    const items =
                        distritos[
                            distrito
                        ];

                    const bloque =
                        document.createElement(
                            "div"
                        );

                    bloque.className =
                        "sacar-data-municipio";

                    bloque.innerHTML = `

                        <div class="sacar-data-municipio-titulo">

                            <i class="fa-solid fa-city"></i>

                            <strong>

                                ${escaparHTML(
                                    distrito
                                )}

                            </strong>

                            <span>
                                (${items.length})
                            </span>

                        </div>

                    `;

                    items.forEach(
                        function (
                            item
                        ) {

                            const fila =
                                document.createElement(
                                    "div"
                                );

                            fila.className =
                                "sacar-data-ubicacion";

                            fila.style.borderLeftColor =
                                item.colorHex;

                            const seleccionada =
                                seleccionadas.has(
                                    String(
                                        item.id
                                    )
                                );

                            if (
                                seleccionada
                            ) {

                                fila.style.background =
                                    "#eff6ff";
                            }

                            let viajeHTML =
                                "";

                            if (
                                item.viajes ===
                                TXT_NO_COBERTURA
                            ) {

                                viajeHTML = `

                                    <div class="sacar-data-no-viaje">

                                        <i class="fa-solid fa-ban"></i>

                                        ${TXT_NO_COBERTURA}

                                    </div>

                                `;

                            } else {

                                viajeHTML = `

                                    <div class="sacar-data-si-viaje">

                                        <i class="fa-solid fa-truck"></i>

                                        ${TXT_SI_COBERTURA}

                                    </div>

                                `;
                            }

                            fila.innerHTML = `

                                <div class="sacar-data-ubicacion-top">

                                    <div>

                                        <div class="sacar-data-ubicacion-nombre">

                                            ${escaparHTML(
                                                item.ubicacion
                                            )}

                                        </div>

                                        ${
                                            item.direccion
                                                ? `

                                            <div class="sacar-data-ubicacion-direccion">

                                                <i class="fa-solid fa-location-dot"></i>

                                                ${escaparHTML(
                                                    item.direccion
                                                )}

                                            </div>

                                            `
                                                : ""
                                        }

                                    </div>

                                    <div
                                        class="sacar-data-badge"
                                        style="
                                            color:${item.colorHex};
                                            background:${item.colorHex}18;
                                        ">

                                        <span
                                            class="sacar-data-badge-punto"
                                            style="
                                                background:${item.colorHex};
                                            ">
                                        </span>

                                        ${escaparHTML(
                                            item.cobertura
                                        )}

                                    </div>

                                </div>

                                <div class="sacar-data-detalles">

                                    <span>

                                        <i class="fa-solid fa-palette"></i>

                                        Color:

                                        <strong>

                                            ${escaparHTML(
                                                item.color
                                            )}

                                        </strong>

                                    </span>

                                    <span>

                                        <i class="fa-solid fa-toggle-on"></i>

                                        Estado:

                                        <strong>

                                            ${escaparHTML(
                                                item.estado
                                            )}

                                        </strong>

                                    </span>

                                    <span>

                                        <i class="fa-solid fa-crosshairs"></i>

                                        ${formatearNumero(
                                            item.latitud
                                        )}

                                        ,

                                        ${formatearNumero(
                                            item.longitud
                                        )}

                                    </span>

                                </div>

                                ${viajeHTML}

                            `;

                            fila.addEventListener(
                                "click",
                                function () {

                                    const id =
                                        String(
                                            item.id
                                        );

                                    if (
                                        seleccionadas.has(
                                            id
                                        )
                                    ) {

                                        seleccionadas.delete(
                                            id
                                        );

                                        fila.style.background =
                                            "";

                                    } else {

                                        seleccionadas.add(
                                            id
                                        );

                                        fila.style.background =
                                            "#eff6ff";
                                    }
                                }
                            );

                            fila.addEventListener(
                                "dblclick",
                                function (
                                    e
                                ) {

                                    e.stopPropagation();

                                    irALaUbicacion(
                                        item
                                    );
                                }
                            );

                            bloque.appendChild(
                                fila
                            );

                        }
                    );

                    contenedor.appendChild(
                        bloque
                    );

                }
            );
    }

    /* ================= IR A UBICACIÓN ================= */

    function irALaUbicacion(
        item
    ) {

        if (
            typeof mapa ===
                "undefined" ||
            !mapa
        ) {

            return;
        }

        const lat =
            Number(
                item.latitud
            );

        const lon =
            Number(
                item.longitud
            );

        if (
            !Number.isFinite(
                lat
            ) ||
            !Number.isFinite(
                lon
            )
        ) {

            return;
        }

        cerrarSacarData();

        mapa.setView(
            [
                lat,
                lon
            ],
            16,
            {

                animate:
                    true,

                duration:
                    .6

            }
        );

        try {

            if (
                typeof grupoCoberturas !==
                    "undefined" &&
                grupoCoberturas
            ) {

                grupoCoberturas.eachLayer(
                    function (
                        layer
                    ) {

                        if (
                            !layer.feature ||
                            !layer.feature.properties
                        ) {

                            return;
                        }

                        const id =
                            String(
                                layer.feature
                                    .properties
                                    .id ||
                                ""
                            );

                        if (
                            id ===
                            String(
                                item.id
                            )
                        ) {

                            if (
                                layer.bringToFront
                            ) {

                                layer.bringToFront();
                            }

                            if (
                                layer.openPopup
                            ) {

                                layer.openPopup();
                            }
                        }
                    }
                );
            }

        } catch (error) {
        }
    }

    /* ================= SELECCIÓN ================= */

    function seleccionarTodo() {

        seleccionadas.clear();

        dataCoberturas.forEach(
            function (
                item
            ) {

                seleccionadas.add(
                    String(
                        item.id
                    )
                );

            }
        );

        renderizarResultados(
            "",
            provinciaSeleccionada
        );
    }

    function limpiarSeleccion() {

        seleccionadas.clear();

        renderizarResultados(
            "",
            provinciaSeleccionada
        );
    }

    /* ================= XLSX ================= */

    function cargarExcelJS() {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (
                    window.XLSX
                ) {

                    resolve();

                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

                script.onload =
                    function () {

                        resolve();

                    };

                script.onerror =
                    function () {

                        reject(
                            new Error(
                                "No se pudo cargar SheetJS"
                            )
                        );

                    };

                document.head.appendChild(
                    script
                );
            }
        );
    }

    /* ================= DESCARGAR EXCEL ================= */

    async function descargarExcel() {

        if (
            !dataCoberturas.length
        ) {

            alert(
                "No hay coberturas para exportar."
            );

            return;
        }

        try {

            await cargarExcelJS();

        } catch (error) {

            alert(
                "No se pudo cargar el generador de Excel."
            );

            return;
        }

        let datosExportar =
            dataCoberturas;

        if (
            seleccionadas.size
        ) {

            datosExportar =
                dataCoberturas.filter(
                    function (
                        item
                    ) {

                        return seleccionadas.has(
                            String(
                                item.id
                            )
                        );

                    }
                );
        }

        const filas =
            datosExportar.map(
                function (
                    item
                ) {

                    return {

                        "Provincia / Comarca":
                            item.provincia,

                        "Distrito":
                            item.distrito,

                        "Ubicación":
                            item.ubicacion,

                        "Dirección":
                            item.direccion,

                        "Cobertura":
                            item.cobertura,

                        "Color":
                            item.color,

                        "Estado":
                            item.estado,

                        "Disponibilidad":
                            item.viajes,

                        "Latitud":
                            item.latitud,

                        "Longitud":
                            item.longitud

                    };

                }
            );

        const hoja =
            XLSX.utils.json_to_sheet(
                filas
            );

        hoja["!cols"] = [

            {
                wch: 28
            },

            {
                wch: 28
            },

            {
                wch: 42
            },

            {
                wch: 55
            },

            {
                wch: 22
            },

            {
                wch: 12
            },

            {
                wch: 13
            },

            {
                wch: 22
            },

            {
                wch: 14
            },

            {
                wch: 14
            }

        ];

        const contar =
            function (
                campo,
                valor
            ) {

                return datosExportar.filter(
                    x =>
                        x[campo] ===
                        valor
                ).length;
            };

        const resumen = [

            [
                "MENSAJERÍA EXPRESS"
            ],

            [
                "Reporte de coberturas - Panamá"
            ],

            [],

            [
                "Total de ubicaciones",
                datosExportar.length
            ],

            [
                TXT_SI_COBERTURA,
                contar(
                    "viajes",
                    TXT_SI_COBERTURA
                )
            ],

            [
                TXT_NO_COBERTURA,
                contar(
                    "viajes",
                    TXT_NO_COBERTURA
                )
            ],

            [],

            [
                "Same Day",
                contar(
                    "cobertura",
                    "Same Day"
                )
            ],

            [
                "Next Day",
                contar(
                    "cobertura",
                    "Next Day"
                )
            ],

            [
                "72 horas",
                contar(
                    "cobertura",
                    "72 horas"
                )
            ],

            [
                "No hay cobertura",
                contar(
                    "cobertura",
                    "No hay cobertura"
                )
            ],

            [
                "Zonas de alto riesgo",
                contar(
                    "cobertura",
                    "Zonas de alto riesgo"
                )
            ]

        ];

        const hojaResumen =
            XLSX.utils.aoa_to_sheet(
                resumen
            );

        hojaResumen["!cols"] = [

            {
                wch: 35
            },

            {
                wch: 20
            }

        ];

        const libro =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            libro,
            hoja,
            "Ubicaciones"
        );

        XLSX.utils.book_append_sheet(
            libro,
            hojaResumen,
            "Resumen"
        );

        const fecha =
            new Date();

        const yyyy =
            fecha.getFullYear();

        const mm =
            String(
                fecha.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const dd =
            String(
                fecha.getDate()
            ).padStart(
                2,
                "0"
            );

        XLSX.writeFile(
            libro,
            `Coberturas_Panama_${yyyy}-${mm}-${dd}.xlsx`
        );
    }

    /* ================= ESCAPE ================= */

    document.addEventListener(
        "keydown",
        function (
            e
        ) {

            if (
                e.key ===
                "Escape"
            ) {

                const modal =
                    document.getElementById(
                        "modalSacarData"
                    );

                if (
                    modal &&
                    modal.classList.contains(
                        "abierto"
                    )
                ) {

                    cerrarSacarData();
                }

            }

        }
    );

    /* ================= INICIAR ================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            iniciarSacarData
        );

    } else {

        iniciarSacarData();
    }

})();
