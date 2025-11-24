// =================================================================
// LÓGICA PRINCIPAL: Escáner QR con extracción y formato SAT
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // Obtiene los elementos de la interfaz
    const resultadoTexto = document.getElementById('resultadoTexto');
    const botonCopiar = document.getElementById('botonCopiar');
    const copyMessage = document.getElementById('copyMessage');
    const readerDiv = document.getElementById('reader');
    const previsualizacionContrato = document.getElementById('previsualizacionContrato');
    const textoContrato = document.getElementById('textoContrato');
    const botonCopiarContrato = document.getElementById('botonCopiarContrato');
    // BOTONES DE DESCARGA
    const botonDescargarResultado = document.getElementById('botonDescargarResultado');
    const botonDescargarContrato = document.getElementById('botonDescargarContrato');

    

    if (!resultadoTexto || !botonCopiar || !copyMessage || !readerDiv || !previsualizacionContrato || !textoContrato || !botonCopiarContrato || !botonDescargarResultado || !botonDescargarContrato) {
        console.error('No se encontraron elementos del DOM requeridos. Verifica el HTML.');
        return;
    }

    botonCopiar.style.display = 'none';
    botonDescargarResultado.style.display = 'none'; 
    copyMessage.style.display = 'none';
    previsualizacionContrato.style.display = 'none';

    botonCopiar.addEventListener('click', copiarTextoAlPortapapeles);
    botonCopiarContrato.addEventListener('click', copiarFormatoContrato);
    
    // VINCULACIÓN DE BOTONES DE DESCARGA
    botonDescargarResultado.addEventListener('click', () => descargarTextoComoTXT(resultadoTexto.innerText, 'resultado_escaneo'));
    botonDescargarContrato.addEventListener('click', () => descargarTextoComoTXT(textoContrato.innerText, 'formato_contrato'));
    
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
    );

    async function handleScanSuccess(decodedText, decodedResult) {
        try {
            let textoFinal = decodedText ? decodedText.trim() : '';
            let contenidoExtraido = null;

            html5QrcodeScanner.clear().then(async () => {
                if (readerDiv) readerDiv.style.display = 'none';

                if (esURLPosible(textoFinal)) {
                    const urlConProtocolo = añadirProtocoloSiHaceFalta(textoFinal);
                    resultadoTexto.innerHTML = `Cargando información de la URL: <a href="${urlConProtocolo}" target="_blank">${urlConProtocolo}</a>...`;
                    botonCopiar.style.display = 'none'; 
                    botonDescargarResultado.style.display = 'none'; 
                    previsualizacionContrato.style.display = 'none';

                    try { contenidoExtraido = await extraerInfoDeURL(urlConProtocolo); } 
                    catch (error) { console.error("Error al extraer info de la URL:", error); }

                    if (contenidoExtraido) {
                        if (contenidoExtraido.includes('PrimeFaces.cw') || contenidoExtraido.includes('PrimeFaces')) {
                            textoFinal = limpiarYFormatearTextoSAT(contenidoExtraido);
                        } else { textoFinal = contenidoExtraido; }
                    } else {
                        textoFinal = `Error al cargar la URL. Por favor, copia y abre el enlace manualmente:\n\n${urlConProtocolo}`;
                    }
                } else if (textoFinal.toUpperCase().startsWith('WIFI:')) {
                    const datosWifi = parsearCodigoWifi(textoFinal);
                    if (datosWifi) {
                        textoFinal = '--- Código Wi-Fi Decodificado ---\n';
                        textoFinal += `SSID (Nombre de la Red): ${datosWifi.S || 'N/A'}\n`;
                        textoFinal += `Contraseña (P): ${datosWifi.P || 'N/A'}\n`;
                        textoFinal += `Seguridad (T): ${datosWifi.T || 'N/A'}\n`;
                        textoFinal += `Red Oculta (H): ${datosWifi.H || 'false'}`;
                    }
                }

                if (/<[a-z][\s\S]*>/i.test(textoFinal)) {
                    resultadoTexto.innerHTML = textoFinal;
                } else {
                    resultadoTexto.innerHTML = textoFinal.replace(/\n/g, '<br><br>');
                }

                botonCopiar.style.display = 'inline-block';
                botonDescargarResultado.style.display = 'inline-block'; 
                
                // Mostrar automáticamente el formato contrato
                mostrarFormatoContrato();
                

            }).catch(err => {
                resultadoTexto.innerHTML = textoFinal.replace(/\n/g, '<br>');
                botonCopiar.style.display = 'inline-block';
                botonDescargarResultado.style.display = 'inline-block'; 
                mostrarFormatoContrato();
            });

        } catch (err) { console.error('Error catastrófico en la función de éxito:', err); }
    }

    function onScanError(errorMessage) {
        if (!resultadoTexto.innerText || resultadoTexto.innerText.trim() === '' || resultadoTexto.innerHTML === 'Escaneá un código QR...') {
            botonCopiar.style.display = 'none';
            botonDescargarResultado.style.display = 'none';
            copyMessage.style.display = 'none';
            previsualizacionContrato.style.display = 'none';
        }
    }

    try { html5QrcodeScanner.render(handleScanSuccess, onScanError); } 
    catch (err) { console.error('Error al renderizar Html5QrcodeScanner:', err); }

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
    
    // FUNCIÓN PARA DESCARGAR TEXTO COMO .TXT
    function descargarTextoComoTXT(texto, nombreArchivoBase) {
        if (!texto || texto.trim() === '') {
            alert('No hay texto para descargar.');
            return;
        }

        const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
        
        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // Formato YYYYMMDD
        const nombreArchivo = `${nombreArchivoBase}_${fecha}.txt`;

        // Utiliza la librería FileSaver.js (saveAs)
        saveAs(blob, nombreArchivo);
        
        // Muestra mensaje de éxito temporal
        copyMessage.innerText = '¡Descargando!';
        copyMessage.style.display = 'inline-block'; 
        setTimeout(() => {
            copyMessage.style.display = 'none';
            copyMessage.innerText = '¡Copiado!'; 
        }, 2000);
    }

    function mostrarFormatoContrato() {
        const textoCompleto = resultadoTexto.innerText || resultadoTexto.textContent || '';
        if (!textoCompleto || textoCompleto === 'Escaneá un código QR...') { 
            previsualizacionContrato.style.display = 'none';
            return; 
        }

        const formatoContrato = generarFormatoContratoHTML(textoCompleto);
        textoContrato.innerHTML = formatoContrato;
        previsualizacionContrato.style.display = 'block';
    }

    function copiarFormatoContrato() {
        const textoHTML = textoContrato.innerHTML || '';
        if (!textoHTML) { alert('No hay datos para copiar.'); return; }

        // Extraer solo el texto sin HTML
        const textoPlano = textoContrato.innerText || textoContrato.textContent || '';

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textoPlano)
                .then(() => { copyMessage.style.display = 'inline-block'; setTimeout(() => copyMessage.style.display = 'none', 2000); })
                .catch(err => { console.error('Error al copiar:', err); alert('Error al copiar.'); });
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = textoPlano;
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); copyMessage.style.display = 'inline-block'; setTimeout(() => copyMessage.style.display = 'none', 2000); } 
            catch (err) { console.error('Fallback copy falló:', err); alert('No se pudo copiar automáticamente.'); }
            document.body.removeChild(textarea);
        }
    }

    function generarFormatoContratoHTML(textoCompleto) {
        // Extraer los campos del texto
        const extraerCampo = (label) => {
            const regex = new RegExp(`${label}[:\\s]+([^\n]+)`, 'i');
            const match = textoCompleto.match(regex);
            return match ? match[1].trim() : '';
        };

        const nombre = extraerCampo('Denominación o Razón Social') || extraerCampo('Razón Social') || '';
        const estado = extraerCampo('Entidad Federativa') || '';
        const ciudad = extraerCampo('Municipio o delegación') || '';
        const email = extraerCampo('Correo electrónico') || '';
        let rfc = extraerCampo('RFC') || '';
        const telefono = extraerCampo('Teléfono') || '';
        
        // Limpiar RFC (elimina texto extra después de la coma, si existe)
        rfc = rfc.replace(/,.*$/, '').trim();
        
        // Construir dirección completa
        const tipoVialidad = extraerCampo('Tipo de vialidad') || '';
        const nombreVialidad = extraerCampo('Nombre de la vialidad') || '';
        const numExterior = extraerCampo('Número exterior') || '';
        const numInterior = extraerCampo('Número interior') || '';
        const colonia = extraerCampo('Colonia') || '';
        const cp = extraerCampo('CP') || extraerCampo('Código Postal') || '';
        
        let direccion = '';
        if (nombreVialidad) {
            const partes = [];
            if (tipoVialidad) partes.push(tipoVialidad);
            if (nombreVialidad) partes.push(nombreVialidad);
            if (numExterior) partes.push('#' + numExterior);
            if (numInterior) partes.push('Int. ' + numInterior);
            if (colonia) partes.push('Col. ' + colonia);
            if (cp) partes.push('C.P. ' + cp);
            direccion = partes.join(', ');
        }

        // Formato contrato con etiquetas en negritas (el formato de salida que quieres)
        return `<strong>Nombre:</strong> ${nombre}<br><strong>Ciudad:</strong> ${ciudad}<br><strong>Estado:</strong> ${estado}<br><strong>Dirección:</strong> ${direccion}<br><strong>Teléfono:</strong> ${telefono}<br><strong>Email:</strong> ${email}<br><strong>RFC:</strong> ${rfc}`;
    }

    function parsearCodigoWifi(wifiString) {
        if (!wifiString || !wifiString.toUpperCase().startsWith('WIFI:')) return null;
        const datos = {};
        let contenido = wifiString.substring(5);
        if (contenido.endsWith(';')) contenido = contenido.slice(0, -1);
        const campos = contenido.split(';');
        campos.forEach(campo => {
            const partes = campo.split(':');
            if (partes.length >= 2) { datos[partes[0].trim()] = partes.slice(1).join(':').trim(); }
        });
        return datos;
    }

    function esURLPosible(str) { if (!str) return false; return (/^[^\s]+(\.[^\s]+)+/.test(str.trim())); }
    function añadirProtocoloSiHaceFalta(str) { if (!/^https?:\/\//i.test(str)) return 'https://' + str; return str; }
    async function extraerInfoDeURL(url) { try { const r = await fetch(url,{mode:'cors'}); if (!r.ok) return null; return await r.text(); } catch { return null; }}

    function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function limpiarYFormatearTextoSAT(textoSucio) {
        let limpio = textoSucio || '';
        // Limpieza de etiquetas, scripts y estilos
        limpio = limpio.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        limpio = limpio.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
        limpio = limpio.replace(/<[^>]+>/g, ' ');
        limpio = limpio.replace(/\$\(function\)\{PrimeFaces\.cw[\s\S]*?\}\);?/gi, ' ');
         // Limpieza de espaciado y saltos de línea
        limpio = limpio.replace(/::/g, ':');
        limpio = limpio.replace(/\s{2,}/g, ' ');
        limpio = limpio.replace(/[\r\n]+/g, '\n');
        limpio = limpio.trim();

        const etiquetas = [
            { key:'Denominación o Razón Social', variants:['Denominación / Razón Social','Denominación o Razón Social','Denominación','Razón Social'] },
            { key:'Régimen de capital', variants:['Régimen de capital','Régimen de Capital'] },
            { key:'Fecha de constitución', variants:['Fecha de constitución','Fecha de constitucion'] },
            { key:'Fecha de Inicio de operaciones', variants:['Fecha de Inicio de operaciones','Fecha de inicio de operaciones'] },
            { key:'Situación del contribuyente', variants:['Situación del contribuyente','Situacion del contribuyente'] },
            { key:'Fecha del último cambio de situación', variants:['Fecha del último cambio de situación','Fecha del ultimo cambio de situacion'] },
            { key:'Entidad Federativa', variants:['Entidad Federativa','Entidad'] },
            { key:'Municipio o delegación', variants:['Municipio o delegación','Municipio','Delegación','Delegacion','Municipio o delegación'] },
            { key:'Colonia', variants:['Colonia'] },
            { key:'Tipo de vialidad', variants:['Tipo de vialidad','Tipo de Vialidad'] },
            { key:'Nombre de la vialidad', variants:['Nombre de la vialidad','Nombre de la Vialidad'] },
            { key:'Número exterior', variants:['Número exterior','Numero exterior'] },
            { key:'Número interior', variants:['Número interior','Numero interior'] },
            { key:'CP', variants:['Código Postal','CP','C.P.'] },
            { key:'Correo electrónico', variants:['Correo electrónico','Correo electronico','Correo'] },
            { key:'AL', variants:['AL'] },
            { key:'Régimen', variants:['Régimen','Regimen'] },
            { key:'RFC', variants:['RFC','R.F.C.'] },
            { key:'Fecha de alta', variants:['Fecha de alta','Fecha alta'] }
        ];

        const lowered = limpio.toLowerCase();
        const posiciones = [];
        etiquetas.forEach(et => {
            for (const variant of et.variants) {
                const rx = new RegExp('\\b'+escapeRegex(variant.toLowerCase())+'\\b','i');
                const m = rx.exec(lowered);
                if(m && m.index!=null){ posiciones.push({key:et.key,variant:variant,index:m.index,length:variant.length}); break; }
            }
        });

        const resultadoMap = new Map();
        if(posiciones.length>0){
            posiciones.sort((a,b)=>a.index-b.index);
            for(let i=0;i<posiciones.length;i++){
                const cur=posiciones[i];
                const start=cur.index+cur.length;
                const end=(i+1<posiciones.length)?posiciones[i+1].index:limpio.length;
                let slice=limpio.slice(start,end).trim();
                slice=slice.replace(/^[:\-\–\s]+/,'').trim();

                for(let j=i+1;j<posiciones.length;j++){
                    const nextKeyVariant=posiciones[j].variant;
                    const indexNextKey=slice.indexOf(nextKeyVariant);
                    if(indexNextKey>0 && indexNextKey<30){ slice=slice.slice(0,indexNextKey).trim(); break; }
                }

                if(slice.length>0){ slice=slice.replace(/Datos de Identificación|Datos de Ubicación \(domicilio fiscal, vigente\)|Características fiscales \(vigente\)/gi,'').trim(); resultadoMap.set(cur.key,slice); }
            }
        }
        
        // Manejo especial para AL y Régimen (a veces vienen juntos)
        if(resultadoMap.has('AL')){
            const alValue=resultadoMap.get('AL');
            const match=alValue.match(/(.*?)\s*Régimen[:\-]?\s*(.+)/i);
            if(match){ resultadoMap.set('AL',match[1].trim()); resultadoMap.set('Régimen',match[2].trim()); }
        }

        // Formateo y limpieza final de la salida
        const ordenFinal=['Denominación o Razón Social','Régimen de capital','Fecha de constitución','Fecha de Inicio de operaciones','Situación del contribuyente','Fecha del último cambio de situación','Entidad Federativa','Municipio o delegación','Colonia','Tipo de vialidad','Nombre de la vialidad','Número exterior','Número interior','CP','Correo electrónico','AL','Régimen','RFC','Fecha de alta'];

        const outputLines=[];
        for(const lbl of ordenFinal){
            let displayValue=resultadoMap.get(lbl);
            if(displayValue){ 
                displayValue=displayValue.replace(/o Raz$|N:$|Nº|idado QR$|2 Características fiscales \(vigente\) Régimen: de capital|vigente|domicilio fiscal/gi,'').trim(); 
                outputLines.push(`${lbl}: ${displayValue}`); 
            }
        }

        const outputFiltrado=outputLines.filter(line=>!line.startsWith('Datos de Ubicación')&&!line.startsWith('Características fiscales'));
        if(outputFiltrado.length<5) return `No se pudieron extraer datos específicos.\n\nTexto limpio inicial:\n${limpio.slice(0,500)}`;
        return outputFiltrado.join('\n');
    }

});