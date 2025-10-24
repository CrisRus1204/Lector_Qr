// =================================================================
// COMPLETO: Escáner QR con extracción y formato SAT (con extracción robusta)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // Obtiene los elementos de la interfaz (asegurarse que existan en el DOM)
    const resultadoTexto = document.getElementById('resultadoTexto');
    const botonCopiar = document.getElementById('botonCopiar');
    const copyMessage = document.getElementById('copyMessage');
    const readerDiv = document.getElementById('reader');

    if (!resultadoTexto || !botonCopiar || !copyMessage || !readerDiv) {
        console.error('No se encontraron elementos del DOM requeridos (resultadoTexto, botonCopiar, copyMessage, reader). Verifica el HTML.');
        return;
    }

    // Ocultar copia inicialmente
    botonCopiar.style.display = 'none';
    copyMessage.style.display = 'none';

    // Añadir el escuchador de eventos para el botón de copiar
    botonCopiar.addEventListener('click', copiarTextoAlPortapapeles);

    // Inicialización del lector de QR
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        /* verbose= */ false
    );

    // Función principal de manejo de éxito (Ejecutada por el scanner)
    async function handleScanSuccess(decodedText, decodedResult) {
        try {
            console.log('QR detectado:', decodedText);
            let textoFinal = decodedText ? decodedText.trim() : '';
            let contenidoExtraido = null;

            // 1. DETENER EL ESCANEO INMEDIATAMENTE ANTES DE CUALQUIER PROCESAMIENTO LENTO
            html5QrcodeScanner.clear().then(async () => {
                if (readerDiv) readerDiv.style.display = 'none';
                console.log('Escaneo detenido (clear). Resultado guardado.');

                // 2. LÓGICA DE PROCESAMIENTO (Se ejecuta después de la detención)

                // Si parece una URL
                if (esURLPosible(textoFinal)) {
                    const urlConProtocolo = añadirProtocoloSiHaceFalta(textoFinal);
                    resultadoTexto.innerHTML = `Cargando información de la URL: <a href="${urlConProtocolo}" target="_blank">${urlConProtocolo}</a>...`;
                    botonCopiar.style.display = 'none'; 

                    try {
                        contenidoExtraido = await extraerInfoDeURL(urlConProtocolo);
                    } catch (error) {
                        console.error("Error al extraer info de la URL:", error);
                    }

                    if (contenidoExtraido) {
                        if (contenidoExtraido.includes('PrimeFaces.cw') || contenidoExtraido.includes('PrimeFaces')) {
                            textoFinal = limpiarYFormatearTextoSAT(contenidoExtraido);
                        } else {
                            textoFinal = contenidoExtraido;
                        }
                    } else {
                        textoFinal = `Error al cargar la URL. Por favor, copia y abre el enlace manualmente:\n\n${urlConProtocolo}`;
                    }
                }
                // Si es formato Wi-Fi
                else if (textoFinal.toUpperCase().startsWith('WIFI:')) {
                    const datosWifi = parsearCodigoWifi(textoFinal);
                    if (datosWifi) {
                        textoFinal = '--- Código Wi-Fi Decodificado ---\n';
                        textoFinal += `SSID (Nombre de la Red): ${datosWifi.S || 'N/A'}\n`;
                        textoFinal += `Contraseña (P): ${datosWifi.P || 'N/A'}\n`;
                        textoFinal += `Seguridad (T): ${datosWifi.T || 'N/A'}\n`;
                        textoFinal += `Red Oculta (H): ${datosWifi.H || 'false'}`;
                    }
                }

                // 3. Mostrar el resultado final
                if (/<[a-z][\s\S]*>/i.test(textoFinal)) {
                    resultadoTexto.innerHTML = textoFinal;
                } else {
                    resultadoTexto.innerHTML = textoFinal.replace(/\n/g, '<br><br>');
                }

                botonCopiar.style.display = 'inline-block';

            }).catch(err => {
                console.warn('Fallo al detener el scanner:', err);
                resultadoTexto.innerHTML = textoFinal.replace(/\n/g, '<br>');
                botonCopiar.style.display = 'inline-block';
            });

        } catch (err) {
            console.error('Error catastrófico en la función de éxito:', err);
        }
    }

    function onScanError(errorMessage) {
        if (!resultadoTexto.innerText || resultadoTexto.innerText.trim() === '' || resultadoTexto.innerHTML === 'Escaneá un código QR...') {
            botonCopiar.style.display = 'none';
            copyMessage.style.display = 'none';
        }
    }

    try {
        html5QrcodeScanner.render(handleScanSuccess, onScanError);
        console.log('Html5QrcodeScanner renderizado correctamente.');
    } catch (err) {
        console.error('Error al renderizar Html5QrcodeScanner:', err);
    }

    // =================================================================
    // 2. FUNCIÓN DE COPIADO
    // =================================================================

    function copiarTextoAlPortapapeles() {
        const textoACopiar = resultadoTexto.innerText || resultadoTexto.textContent || '';
        if (!textoACopiar) { alert('No hay texto para copiar.'); return; }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            const textoLimpioParaPortapapeles = textoACopiar.replace(/\s*\n\s*/g, '\n').trim();
            navigator.clipboard.writeText(textoLimpioParaPortapapeles)
                .then(() => { copyMessage.style.display = 'inline-block'; setTimeout(() => copyMessage.style.display = 'none', 2000); })
                .catch(err => { console.error('Error al copiar:', err); alert('Error al copiar.'); });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = textoACopiar;
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); copyMessage.style.display = 'inline-block'; setTimeout(() => copyMessage.style.display = 'none', 2000); } 
            catch (err) { console.error('Fallback copy falló:', err); alert('No se pudo copiar automáticamente.'); }
            document.body.removeChild(textarea);
        }
    }

    // =================================================================
    // 3. FUNCIONES DE AYUDA
    // =================================================================

    function parsearCodigoWifi(wifiString) {
        if (!wifiString || !wifiString.toUpperCase().startsWith('WIFI:')) return null;
        const datos = {};
        let contenido = wifiString.substring(5);
        if (contenido.endsWith(';')) contenido = contenido.slice(0, -1);
        const campos = contenido.split(';');
        campos.forEach(campo => {
            const partes = campo.split(':');
            if (partes.length >= 2) {
                const key = partes[0].trim();
                const val = partes.slice(1).join(':').trim();
                datos[key] = val;
            }
        });
        return datos;
    }

    function esURLPosible(str) { if (!str) return false; const s = str.trim(); return (/^[^\s]+(\.[^\s]+)+/.test(s)); }
    function añadirProtocoloSiHaceFalta(str) { if (!/^https?:\/\//i.test(str)) return 'https://' + str; return str; }

    async function extraerInfoDeURL(url) {
        try { const response = await fetch(url, { mode: 'cors' }); if (!response.ok) return null; return await response.text(); } 
        catch (error) { return null; }
    }

    // =================================================================
    // 4. LIMPIEZA Y FORMATEO DE DATOS DEL SAT
    // =================================================================

    function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function limpiarYFormatearTextoSAT(textoSucio) {
        let limpio = textoSucio || '';
        limpio = limpio.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        limpio = limpio.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
        limpio = limpio.replace(/<[^>]+>/g, ' ');
        limpio = limpio.replace(/\$\(function\)\{PrimeFaces\.cw[\s\S]*?\}\);?/gi, ' ');
        limpio = limpio.replace(/::/g, ':');
        limpio = limpio.replace(/\s{2,}/g, ' ');
        limpio = limpio.replace(/[\r\n]+/g, '\n');
        limpio = limpio.trim();

        const etiquetas = [
            { key: 'Denominación o Razón Social', variants: ['Denominación / Razón Social', 'Denominación o Razón Social', 'Denominación', 'Razón Social'] },
            { key: 'Régimen de capital', variants: ['Régimen de capital', 'Régimen de Capital'] },
            { key: 'Fecha de constitución', variants: ['Fecha de constitución', 'Fecha de constitucion'] },
            { key: 'Fecha de Inicio de operaciones', variants: ['Fecha de Inicio de operaciones', 'Fecha de inicio de operaciones'] },
            { key: 'Situación del contribuyente', variants: ['Situación del contribuyente', 'Situacion del contribuyente'] },
            { key: 'Fecha del último cambio de situación', variants: ['Fecha del último cambio de situación', 'Fecha del ultimo cambio de situacion'] },
            { key: 'Entidad Federativa', variants: ['Entidad Federativa', 'Entidad'] },
            { key: 'Municipio o delegación', variants: ['Municipio o delegación', 'Municipio', 'Delegación', 'Delegacion', 'Municipio o delegación'] },
            { key: 'Colonia', variants: ['Colonia'] },
            { key: 'Tipo de vialidad', variants: ['Tipo de vialidad', 'Tipo de Vialidad'] },
            { key: 'Nombre de la vialidad', variants: ['Nombre de la vialidad', 'Nombre de la Vialidad'] },
            { key: 'Número exterior', variants: ['Número exterior', 'Numero exterior'] },
            { key: 'Número interior', variants: ['Número interior', 'Numero interior'] },
            { key: 'CP', variants: ['Código Postal', 'CP', 'C.P.'] },
            { key: 'Correo electrónico', variants: ['Correo electrónico', 'Correo electronico', 'Correo'] },
            { key: 'AL', variants: ['AL'] },
            { key: 'Régimen', variants: ['Régimen', 'Regimen'] },
            { key: 'Fecha de alta', variants: ['Fecha de alta', 'Fecha alta'] }
        ];

        const lowered = limpio.toLowerCase();
        const posiciones = [];
        etiquetas.forEach(et => {
            for (const variant of et.variants) {
                const rx = new RegExp('\\b' + escapeRegex(variant.toLowerCase()) + '\\b', 'i');
                const m = rx.exec(lowered);
                if (m && m.index != null) {
                    posiciones.push({ key: et.key, variant: variant, index: m.index, length: variant.length });
                    break;
                }
            }
        });

        const resultadoMap = new Map();
        if (posiciones.length > 0) {
            posiciones.sort((a, b) => a.index - b.index);
            for (let i = 0; i < posiciones.length; i++) {
                const cur = posiciones[i];
                const start = cur.index + cur.length;
                const end = (i + 1 < posiciones.length) ? posiciones[i + 1].index : limpio.length;
                let slice = limpio.slice(start, end).trim();
                slice = slice.replace(/^[:\-\–\s]+/, '').trim();

                for (let j = i + 1; j < posiciones.length; j++) {
                    const nextKeyVariant = posiciones[j].variant;
                    const indexNextKey = slice.indexOf(nextKeyVariant);
                    if (indexNextKey > 0 && indexNextKey < 30) { slice = slice.slice(0, indexNextKey).trim(); break; }
                }

                if (slice.length > 0) {
                    slice = slice.replace(/Datos de Identificación|Datos de Ubicación \(domicilio fiscal, vigente\)|Características fiscales \(vigente\)/gi, '').trim();
                    resultadoMap.set(cur.key, slice);
                }
            }
        }

        // 🔹 CORRECCIÓN: separar AL y Régimen si vienen juntos
        if (resultadoMap.has('AL')) {
            const alValue = resultadoMap.get('AL');
            const match = alValue.match(/(.*?)\s*Régimen[:\-]?\s*(.+)/i);
            if (match) {
                resultadoMap.set('AL', match[1].trim());
                resultadoMap.set('Régimen', match[2].trim());
            }
        }

        const ordenFinal = [
            'Denominación o Razón Social','Régimen de capital','Fecha de constitución','Fecha de Inicio de operaciones',
            'Situación del contribuyente','Fecha del último cambio de situación','Entidad Federativa','Municipio o delegación',
            'Colonia','Tipo de vialidad','Nombre de la vialidad','Número exterior','Número interior','CP','Correo electrónico',
            'AL','Régimen','Fecha de alta'
        ];

        const outputLines = [];
        for (const lbl of ordenFinal) {
            let keyToUse = lbl;
            let displayValue = resultadoMap.get(lbl);
            if (displayValue) {
                displayValue = displayValue.replace(/o Raz$|N:$|Nº|idado QR$|2 Características fiscales \(vigente\) Régimen: de capital|vigente|domicilio fiscal/gi, '').trim();
                outputLines.push(`${keyToUse}: ${displayValue}`);
            }
        }

        const outputFiltrado = outputLines.filter(line => !line.startsWith('Datos de Ubicación') && !line.startsWith('Características fiscales'));

        if (outputFiltrado.length < 5) {
            return `No se pudieron extraer datos específicos.\n\nTexto limpio inicial:\n${limpio.slice(0, 500)}`;
        }

        return outputFiltrado.join('\n');
    }

}); // fin DOMContentLoaded
