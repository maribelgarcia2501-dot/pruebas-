
/* =========================================================
   SACAR DATA - MENSAJERÍA EXPRESS EL SALVADOR
   =========================================================
   FUNCIONES:
   - Departamentos
   - Municipios
   - Ubicaciones
   - Coberturas
   - Dirección
   - Coordenadas
   - Selección de registros
   - Exportación a Excel
   - Caché persistente
   - Una consulta Nominatim para nombre + dirección
   - Centrado automático por departamento
========================================================= */

(function () {

    "use strict";

    /* ================= CONFIGURACIÓN ================= */

    const BTN_DATA = "btnSacarData";

    const STORAGE_ZONAS =
        "mensajeriaExpressZonasCoberturaElSalvador";

    const STORAGE_CACHE_GEO =
        "mensajeriaExpressCacheGeoElSalvador_v1";

    const URL_REVERSE =
        "https://nominatim.openstreetmap.org/reverse";

    const TXT_NO_COBERTURA =
        "No tenemos cobertura";

    const TXT_SI_COBERTURA =
        "Sí tenemos cobertura";

    /* ================= DEPARTAMENTOS ================= */

    const DEPARTAMENTOS_EL_SALVADOR = [
        "Ahuachapán",
        "Santa Ana",
        "Sonsonate",
        "Chalatenango",
        "La Libertad",
        "San Salvador",
        "Cuscatlán",
        "La Paz",
        "Cabañas",
        "San Vicente",
        "Usulután",
        "San Miguel",
        "Morazán",
        "La Unión"
    ];

    /* ================= CENTROS ================= */

    const CENTROS_DEPARTAMENTOS = {

        "Ahuachapán": [13.9214, -89.8450],

        "Santa Ana": [14.0000, -89.5597],

        "Sonsonate": [13.7189, -89.7240],

        "Chalatenango": [14.0333, -88.9333],

        "La Libertad": [13.6817, -89.2922],

        "San Salvador": [13.6929, -89.2182],

        "Cuscatlán": [13.8667, -89.0500],

        "La Paz": [13.5094, -88.8686],

        "Cabañas": [13.9500, -88.9833],

        "San Vicente": [13.6333, -88.8000],

        "Usulután": [13.3500, -88.4500],

        "San Miguel": [13.4833, -88.1833],

        "Morazán": [13.7667, -88.1000],

        "La Unión": [13.3369, -87.8439]
    };

    /* ================= CACHÉ PERSISTENTE ================= */

    function cargarCacheGeo() {

        try {

            const g = JSON.parse(
                localStorage.getItem(STORAGE_CACHE_GEO) || "null"
            );

            if (g && g.reverse && g.detalle) {
                return g;
            }

        } catch (error) {
        }

        return {
            reverse: {},
            detalle: {}
        };
    }

    const cacheGeo = cargarCacheGeo();

    let guardarCacheTimer = null;

    function guardarCacheGeo() {

        clearTimeout(guardarCacheTimer);

        guardarCacheTimer = setTimeout(function () {

            try {

                localStorage.setItem(
                    STORAGE_CACHE_GEO,
                    JSON.stringify(cacheGeo)
                );

            } catch (error) {
            }

        }, 500);
    }

    /* ================= VARIABLES ================= */

    let dataCoberturas = [];

    let seleccionadas = new Set();

    let cacheUbicaciones = {};

    let cacheMunicipios = {};

    let cacheReverse = cacheGeo.reverse;

    const cacheDetalle = cacheGeo.detalle;

    let ultimaPeticionNominatim = 0;

    let departamentoSeleccionado = "San Salvador";

    /* ================= INICIAR ================= */

    function iniciarSacarData() {

        const boton =
            document.getElementById(BTN_DATA);

        if (!boton) {

            console.warn(
                "Sacar Data: no existe #btnSacarData"
            );

            return;
        }

        if (
            boton.dataset.sacarDataInicializado === "1"
        ) {
            return;
        }

        boton.dataset.sacarDataInicializado = "1";

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
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\s_-]+/g, " ");
    }

    function normalizarDepartamento(texto) {

        return normalizarTexto(texto)
            .replace(/^departamento (de )?/, "")
            .replace(/\s+department$/, "")
            .trim();
    }

    function buscarDepartamentoEnLista(valor) {

        const normalizado =
            normalizarDepartamento(valor);

        if (!normalizado) {
            return "";
        }

        const exacto =
            DEPARTAMENTOS_EL_SALVADOR.find(function (x) {

                return (
                    normalizarDepartamento(x) ===
                    normalizado
                );

            });

        if (exacto) {
            return exacto;
        }

        const parcial =
            DEPARTAMENTOS_EL_SALVADOR.find(function (x) {

                return (
                    normalizado.includes(
                        normalizarDepartamento(x)
                    )
                );

            });

        return parcial || "";
    }

    function escaparHTML(texto) {

        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatearNumero(numero) {

        const valor = Number(numero);

        if (!Number.isFinite(valor)) {
            return "-";
        }

        return valor.toFixed(6);
    }

    function buscarPropiedad(feature, propiedades) {

        if (!feature || !feature.properties) {
            return "";
        }

        const props =
            feature.properties;

        for (const nombre of propiedades) {

            if (
                props[nombre] !== undefined &&
                props[nombre] !== null &&
                String(props[nombre]).trim() !== ""
            ) {

                return props[nombre];

            }

        }

        return "";
    }

    /* ================= COLORES ================= */

    function obtenerColorData(tipo) {

        const valor =
            normalizarTexto(tipo)
                .replace(/[\s_-]+/g, "");

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
            normalizarTexto(tipo);

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

        if (valor.includes("72")) {
            return "Rojo";
        }

        if (valor.includes("alto")) {
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
            normalizarTexto(tipo);

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

        return tipo || "Sin definir";
    }

    function obtenerEstadoViaje(tipo) {

        const valor =
            normalizarTexto(tipo);

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

        /*
         * PRIMERO:
         * Lo que actualmente está dibujado en el mapa.
         */

        try {

            if (
                typeof grupoCoberturas !== "undefined" &&
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

        /*
         * SEGUNDO:
         * localStorage
         */

        if (!datos.length) {

            try {

                const guardado =
                    localStorage.getItem(
                        STORAGE_ZONAS
                    );

                if (guardado) {

                    const parsed =
                        JSON.parse(guardado);

                    if (Array.isArray(parsed)) {
                        datos = parsed;
                    }

                    /*
                     * Por si el almacenamiento tiene
                     * una estructura tipo:
                     *
                     * { zonas: [...] }
                     */

                    else if (
                        parsed &&
                        Array.isArray(parsed.zonas)
                    ) {

                        datos = parsed.zonas;

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
                typeof turf !== "undefined" &&
                feature &&
                feature.geometry
            ) {

                const punto =
                    turf.pointOnFeature(feature);

                return {

                    lat: Number(
                        punto.geometry.coordinates[1]
                    ),

                    lon: Number(
                        punto.geometry.coordinates[0]
                    )

                };

            }

        } catch (error) {
        }

        try {

            const bounds =
                L.geoJSON(feature)
                    .getBounds();

            const centro =
                bounds.getCenter();

            return {

                lat: centro.lat,
                lon: centro.lng

            };

        } catch (error) {

            return null;
        }
    }

    /* ================= DEPARTAMENTO ================= */

    function obtenerDepartamentoFeature(feature) {

        const valor =
            buscarPropiedad(feature, [

                "departamento",
                "Departamento",
                "DEPARTAMENTO",

                "depto",
                "Depto",
                "DPTO",

                "nombre_departamento",
                "nombreDepartamento",
                "NOMBRE_DEPARTAMENTO",

                "NAME_1",
                "name_1",

                "departament",

                "department",
                "name_0",
                "NAME_0"

            ]);

        if (valor) {

            const encontrado =
                buscarDepartamentoEnLista(
                    valor
                );

            if (encontrado) {
                return encontrado;
            }

        }

        /*
         * Buscar en cualquier propiedad cuyo nombre
         * tenga relación con departamento.
         */

        if (
            feature &&
            feature.properties
        ) {

            const props =
                feature.properties;

            for (
                const clave of Object.keys(props)
            ) {

                const claveNormalizada =
                    normalizarTexto(clave);

                if (
                    claveNormalizada.includes(
                        "depart"
                    )
                ) {

                    const encontrado =
                        buscarDepartamentoEnLista(
                            props[clave]
                        );

                    if (encontrado) {
                        return encontrado;
                    }

                }

            }

        }

        return "";
    }

    /* ================= MUNICIPIO ================= */

    function obtenerMunicipioFeature(feature) {

        const valor =
            buscarPropiedad(feature, [

                "municipio",
                "Municipio",
                "MUNICIPIO",

                "municip",
                "MUNIC",

                "nombre_municipio",
                "nombreMunicipio",
                "NOMBRE_MUNICIPIO",

                "NAME_2",
                "name_2",

                "muni"

            ]);

        if (valor) {
            return String(valor).trim();
        }

        return "";
    }

    /* ================= PUNTO EN POLÍGONO ================= */

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
                (
                    (yi > lat) !==
                    (yj > lat)
                ) &&
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
                dentro = !dentro;
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

        /*
         * Verificar agujeros.
         */

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
            geometria.type === "Polygon"
        ) {

            return puntoEnPoligono(
                lon,
                lat,
                geometria.coordinates
            );
        }

        if (
            geometria.type === "MultiPolygon"
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

    /* ================= DEPARTAMENTO POR CAPA ================= */

    function obtenerDepartamentoPorCapa(
        lat,
        lon
    ) {

        if (
            typeof capaDepartamentos === "undefined" ||
            !capaDepartamentos ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
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
                        layer.feature.properties ||
                        {};

                    const posibles = [

                        props.departamento,
                        props.Departamento,
                        props.DEPARTAMENTO,

                        props.nombre,
                        props.Nombre,

                        props.name,
                        props.NAME,

                        props.NAME_1,

                        props.nombre_departamento,
                        props.NOMBRE_DEPARTAMENTO

                    ];

                    for (
                        const valor of posibles
                    ) {

                        const encontrado =
                            buscarDepartamentoEnLista(
                                valor
                            );

                        if (encontrado) {

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

    function obtenerDepartamentoPorCercania(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            return "";
        }

        let mejor = "";

        let mejorDistancia =
            Infinity;

        for (
            const nombre of
            Object.keys(
                CENTROS_DEPARTAMENTOS
            )
        ) {

            const centro =
                CENTROS_DEPARTAMENTOS[
                    nombre
                ];

            const distancia =
                Math.pow(
                    centro[0] - lat,
                    2
                ) +
                Math.pow(
                    centro[1] - lon,
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
            ahora + espera;

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

            return cacheDetalle[key];
        }

        const url =
            URL_REVERSE +
            "?lat=" +
            encodeURIComponent(lat) +
            "&lon=" +
            encodeURIComponent(lon) +
            "&format=jsonv2" +
            "&zoom=18" +
            "&addressdetails=1" +
            "&accept-language=es" +
            "&countrycodes=sv";

        await esperarNominatim();

        const respuesta =
            await fetch(url, {

                headers: {
                    "Accept":
                        "application/json"
                }

            });

        if (!respuesta.ok) {
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

        return cacheDetalle[key];
    }

    /* ================= NOMBRE ================= */

    async function buscarNombreLugar(
        lat,
        lon,
        feature
    ) {

        const nombreGuardado =
            buscarPropiedad(feature, [

                "nombre_lugar",
                "nombreLugar",

                "nombre_ubicacion",
                "nombreUbicacion",

                "ubicacion",
                "lugar",

                "place_name",
                "placeName"

            ]);

        if (nombreGuardado) {
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
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
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

            let encontrado = "";

            for (
                const valor of
                posibles
            ) {

                if (
                    valor &&
                    String(valor).trim()
                ) {

                    encontrado =
                        String(valor).trim();

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
            ] = encontrado;

            return encontrado;

        } catch (error) {

            console.warn(
                "Error reverse geocoding:",
                error
            );

            return "Ubicación marcada";
        }
    }

    /* ================= MUNICIPIO POR COORDENADAS ================= */

    async function buscarMunicipioPorCoordenadas(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            return "Sin municipio";
        }

        const key =
            lat.toFixed(4) +
            "," +
            lon.toFixed(4);

        if (
            cacheMunicipios[key]
        ) {

            return cacheMunicipios[key];
        }

        try {

            const datos =
                await obtenerReverse(
                    lat,
                    lon
                );

            if (!datos) {
                return "Sin municipio";
            }

            const address =
                datos.address ||
                {};

            const municipio =
                address.municipality ||
                address.city ||
                address.town ||
                address.village ||
                address.county ||
                address.city_district ||
                "";

            const resultado =
                String(
                    municipio ||
                    "Sin municipio"
                ).trim();

            cacheMunicipios[key] =
                resultado;

            return resultado;

        } catch (error) {

            console.warn(
                "No se pudo obtener municipio:",
                error
            );

            return "Sin municipio";
        }
    }

    /* ================= DIRECCIÓN ================= */

    async function buscarDireccion(
        lat,
        lon
    ) {

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
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

    /* ================= CREAR MODAL ================= */

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
                    Datos de Cobertura - El Salvador
                </h2>

                <p>
                    Departamentos, municipios y ubicaciones marcadas
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
                placeholder="Buscar departamento, municipio o ubicación...">

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
                    e.target === modal
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
                        departamentoSeleccionado
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

                <div id="progresoSacarData"></div>

            </div>

        `;

        dataCoberturas =
            obtenerCoberturas();

        await prepararDatos();

        renderizarDepartamentos();

        departamentoSeleccionado =
            "San Salvador";

        renderizarResultados(
            "",
            departamentoSeleccionado
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

    /* ================= PREPARAR DATOS ================= */

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

            let departamento =
                obtenerDepartamentoFeature(
                    feature
                );

            let municipio =
                obtenerMunicipioFeature(
                    feature
                );

            /*
             * 1. Departamento por la capa
             */

            if (
                !departamento &&
                centro
            ) {

                departamento =
                    obtenerDepartamentoPorCapa(
                        lat,
                        lon
                    );
            }

            /*
             * 2. Reverse de Nominatim
             */

            if (
                (!departamento ||
                 !municipio) &&
                centro
            ) {

                try {

                    const reverse =
                        await obtenerReverse(
                            lat,
                            lon
                        );

                    if (!departamento) {

                        departamento =
                            obtenerDepartamentoReverse(
                                reverse
                            );
                    }

                    if (!municipio) {

                        municipio =
                            obtenerMunicipioReverse(
                                reverse
                            );
                    }

                } catch (error) {
                }
            }

            /*
             * 3. Último recurso:
             * departamento más cercano.
             */

            if (
                !departamento &&
                centro
            ) {

                departamento =
                    obtenerDepartamentoPorCercania(
                        lat,
                        lon
                    );
            }

            /*
             * 4. Municipio por coordenadas
             */

            if (
                !municipio &&
                centro
            ) {

                municipio =
                    await buscarMunicipioPorCoordenadas(
                        lat,
                        lon
                    );
            }

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
                    [
                        "id",
                        "objectid",
                        "OBJECTID"
                    ]
                ) ||
                "cobertura_" +
                i;

            lista.push({

                id: id,

                feature: feature,

                departamento:
                    departamento ||
                    "Sin departamento",

                municipio:
                    municipio ||
                    "Sin municipio",

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
                    ) === "inactiva"
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

            return cacheReverse[key];
        }

        const url =
            URL_REVERSE +
            "?lat=" +
            encodeURIComponent(lat) +
            "&lon=" +
            encodeURIComponent(lon) +
            "&format=jsonv2" +
            "&zoom=10" +
            "&addressdetails=1" +
            "&accept-language=es" +
            "&countrycodes=sv";

        await esperarNominatim();

        const respuesta =
            await fetch(url);

        if (!respuesta.ok) {
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

        return cacheReverse[key];
    }

    /* ================= DEPARTAMENTO REVERSE ================= */

    function obtenerDepartamentoReverse(
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
            address.department,
            address.county,

            address["ISO3166-2-lvl4"],
            address["ISO3166-2-lvl3"]

        ];

        for (
            const valor of
            posibles
        ) {

            const encontrado =
                buscarDepartamentoEnLista(
                    valor
                );

            if (encontrado) {

                return encontrado;

            }

        }

        return "";
    }

    /* ================= MUNICIPIO REVERSE ================= */

    function obtenerMunicipioReverse(
        datos
    ) {

        if (!datos) {
            return "";
        }

        const address =
            datos.address ||
            {};

        return String(

            address.municipality ||
            address.city ||
            address.town ||
            address.village ||
            address.county ||
            address.city_district ||
            ""

        ).trim();
    }

    /* ================= AGRUPAR ================= */

    function agruparPorDepartamento() {

        const grupos = {};

        /*
         * Crear siempre los 14 departamentos.
         */

        for (
            const dep of
            DEPARTAMENTOS_EL_SALVADOR
        ) {

            grupos[dep] = [];

        }

        for (
            const item of
            dataCoberturas
        ) {

            let dep =
                item.departamento ||
                "Sin departamento";

            const encontrado =
                buscarDepartamentoEnLista(
                    dep
                );

            if (encontrado) {

                dep =
                    encontrado;

            }

            if (!grupos[dep]) {

                grupos[dep] = [];

            }

            grupos[dep].push(
                item
            );
        }

        return grupos;
    }

    /* ================= CENTRAR ================= */

    function centrarEnDepartamento(
        nombreDepartamento
    ) {

        if (
            typeof mapa === "undefined" ||
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

                        if (encontrado) {
                            return;
                        }

                        const props =
                            layer.feature &&
                            layer.feature.properties
                                ? layer.feature.properties
                                : {};

                        const posibles = [

                            props.departamento,
                            props.Departamento,
                            props.DEPARTAMENTO,

                            props.nombre,
                            props.Nombre,

                            props.name,
                            props.NAME,

                            props.NAME_1,

                            props.nombre_departamento,
                            props.NOMBRE_DEPARTAMENTO

                        ];

                        let nombre =
                            "";

                        for (
                            const valor
                            of posibles
                        ) {

                            if (
                                valor !==
                                undefined &&
                                valor !==
                                null &&
                                String(
                                    valor
                                ).trim()
                            ) {

                                nombre =
                                    valor;

                                break;

                            }

                        }

                        if (
                            normalizarDepartamento(
                                nombre
                            ) ===
                            normalizarDepartamento(
                                nombreDepartamento
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
                                                [25,25],

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
                "Error centrando departamento:",
                error
            );

        }

        /*
         * FALLBACK
         */

        if (!encontrado) {

            const centro =
                CENTROS_DEPARTAMENTOS[
                    nombreDepartamento
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

    /* ================= RENDER DEPARTAMENTOS ================= */

    function renderizarDepartamentos() {

        const contenedor =
            document.getElementById(
                "listaDepartamentosData"
            );

        if (!contenedor) {
            return;
        }

        const grupos =
            agruparPorDepartamento();

        contenedor.innerHTML =
            "";

        /*
         * SIEMPRE EXACTAMENTE LOS 14
         * DEPARTAMENTOS OFICIALES.
         */

        DEPARTAMENTOS_EL_SALVADOR.forEach(
            function (departamento) {

                const cantidad =
                    grupos[departamento]
                        ? grupos[departamento].length
                        : 0;

                const boton =
                    document.createElement(
                        "button"
                    );

                boton.type =
                    "button";

                boton.className =
                    "sacar-data-departamento";

                boton.dataset.departamento =
                    departamento;

                boton.innerHTML = `

                    <div>

                        <div class="sacar-data-departamento-nombre">

                            ${escaparHTML(
                                departamento
                            )}

                        </div>

                        <span class="sacar-data-departamento-sub">

                            ${cantidad}
                            ubicación${cantidad === 1 ? "" : "es"}

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
                                function (x) {

                                    x.classList.remove(
                                        "activo"
                                    );

                                }
                            );

                        this.classList.add(
                            "activo"
                        );

                        departamentoSeleccionado =
                            departamento;

                        /*
                         * CENTRAR EN EL DEPARTAMENTO
                         */

                        centrarEnDepartamento(
                            departamento
                        );

                        renderizarResultados(
                            "",
                            departamento
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
                function (boton) {

                    return (
                        normalizarTexto(
                            boton.dataset.departamento
                        ) ===
                        normalizarTexto(
                            departamentoSeleccionado
                        )
                    );

                }
            );

        if (botonInicial) {

            botonInicial.classList.add(
                "activo"
            );

        }
    }

    /* ================= RENDER RESULTADOS ================= */

    function renderizarResultados(
        textoBusqueda = "",
        departamentoForzado = null
    ) {

        const contenedor =
            document.getElementById(
                "resultadosData"
            );

        if (!contenedor) {
            return;
        }

        if (departamentoForzado) {

            departamentoSeleccionado =
                departamentoForzado;

        }

        const grupos =
            agruparPorDepartamento();

        const departamento =
            departamentoSeleccionado;

        let datos =
            grupos[departamento] ||
            [];

        const busqueda =
            normalizarTexto(
                textoBusqueda
            );

        if (busqueda) {

            datos =
                datos.filter(
                    function (item) {

                        const texto = [

                            item.departamento,
                            item.municipio,
                            item.ubicacion,
                            item.direccion,
                            item.cobertura,
                            item.estado,
                            item.viajes

                        ].join(" ");

                        return (
                            normalizarTexto(
                                texto
                            ).includes(
                                busqueda
                            )
                        );

                    }
                );
        }

        const activas =
            datos.filter(
                function (x) {

                    return (
                        x.estado ===
                        "Activa"
                    );

                }
            ).length;

        const noViajes =
            datos.filter(
                function (x) {

                    return (
                        x.viajes ===
                        TXT_NO_COBERTURA
                    );

                }
            ).length;

        contenedor.innerHTML = `

            <div class="sacar-data-resumen">

                <div class="sacar-data-resumen-card">

                    <span>
                        Departamento
                    </span>

                    <strong>
                        ${escaparHTML(
                            departamento
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

        if (!datos.length) {

            contenedor.innerHTML += `

                <div class="sacar-data-vacio">

                    <i class="fa-solid fa-location-dot"></i>

                    <strong>
                        No hay ubicaciones marcadas
                    </strong>

                    <span>
                        Este departamento todavía no tiene
                        coberturas registradas.
                    </span>

                </div>

            `;

            return;
        }

        /* ================= AGRUPAR MUNICIPIOS ================= */

        const municipios = {};

        datos.forEach(
            function (item) {

                const municipio =
                    item.municipio ||
                    "Sin municipio";

                if (
                    !municipios[
                        municipio
                    ]
                ) {

                    municipios[
                        municipio
                    ] = [];

                }

                municipios[
                    municipio
                ].push(
                    item
                );

            }
        );

        Object.keys(
            municipios
        )
        .sort(
            function (a,b) {

                return a.localeCompare(
                    b,
                    "es"
                );

            }
        )
        .forEach(
            function (municipio) {

                const items =
                    municipios[
                        municipio
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
                                municipio
                            )}
                        </strong>

                        <span>
                            (${items.length})
                        </span>

                    </div>

                `;

                items.forEach(
                    function (item) {

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

                        if (seleccionada) {

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

                        /*
                         * CLICK:
                         * seleccionar para Excel
                         */

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

                        /*
                         * DOBLE CLICK:
                         * ir al lugar
                         */

                        fila.addEventListener(
                            "dblclick",
                            function (e) {

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
            typeof mapa === "undefined" ||
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
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            return;
        }

        cerrarSacarData();

        mapa.setView(
            [lat, lon],
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
                    function (layer) {

                        if (
                            !layer.feature ||
                            !layer.feature.properties
                        ) {

                            return;
                        }

                        const id =
                            String(
                                layer.feature.properties.id ||
                                layer.feature.properties.objectid ||
                                layer.feature.properties.OBJECTID ||
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
            function (item) {

                seleccionadas.add(
                    String(
                        item.id
                    )
                );

            }
        );

        renderizarResultados(
            "",
            departamentoSeleccionado
        );
    }

    function limpiarSeleccion() {

        seleccionadas.clear();

        renderizarResultados(
            "",
            departamentoSeleccionado
        );
    }

    /* ================= CARGAR XLSX ================= */

    function cargarExcelJS() {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (window.XLSX) {

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

        /*
         * Si hay selección:
         * exportar solo seleccionadas.
         */

        if (
            seleccionadas.size
        ) {

            datosExportar =
                dataCoberturas.filter(
                    function (item) {

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
                function (item) {

                    return {

                        "País":
                            "El Salvador",

                        "Departamento":
                            item.departamento,

                        "Municipio":
                            item.municipio,

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

            { wch: 14 },
            { wch: 22 },
            { wch: 25 },
            { wch: 42 },
            { wch: 55 },
            { wch: 22 },
            { wch: 12 },
            { wch: 13 },
            { wch: 22 },
            { wch: 14 },
            { wch: 14 }

        ];

        const contar =
            function (
                campo,
                valor
            ) {

                return datosExportar.filter(
                    function (x) {

                        return (
                            x[campo] ===
                            valor
                        );

                    }
                ).length;

            };

        const resumen = [

            [
                "MENSAJERÍA EXPRESS"
            ],

            [
                "Reporte de coberturas - El Salvador"
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
                    "48 horas"
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
            `Coberturas_El_Salvador_${yyyy}-${mm}-${dd}.xlsx`
        );
    }

    /* ================= ESCAPE ================= */

    document.addEventListener(
        "keydown",
        function (e) {

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
