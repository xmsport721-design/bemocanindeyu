const xlsx = require('xlsx');
const fs = require('fs');

console.log("Iniciando conversión de Excel a JSON para CANINDEYÚ. Esto puede tomar unos segundos...");

// 1. Leer el archivo Excel
const workbook = xlsx.readFile('BASE DE DATOS CANINDEYU.xlsx');
const sheetName = workbook.SheetNames[0]; 
const sheet = workbook.Sheets[sheetName];

// 2. Convertir los datos a formato JSON
const data = xlsx.utils.sheet_to_json(sheet);

const padronFirebase = {};
let contador = 0;

if(data.length > 0) {
    console.log("📌 Excel leído correctamente. Procesando filas...");
}

data.forEach(row => {
    // Convertir los títulos de tu Excel a minúsculas exactas para no fallar
    const rowNorm = {};
    for(let key in row){
        rowNorm[key.toLowerCase().trim()] = row[key];
    }

    // MAPEAMOS EXACTAMENTE TUS NOMBRES DE COLUMNA
    const cedula = String(rowNorm['numero_ced'] || '').trim();
    
    // Si no hay cédula válida en esta fila, la saltamos
    if (!cedula || cedula === 'undefined' || cedula === 'null') return;

    padronFirebase[cedula] = {
        cedula: cedula, // Guardamos la cédula también adentro
        nombre: String(rowNorm['nombre'] || '').trim(),
        apellido: String(rowNorm['apellido'] || '').trim(),
        distrito: String(rowNorm['desc_dis'] || '').trim().toUpperCase(),
        local: String(rowNorm['desc_locanr'] || '').trim(),
        mesa: String(rowNorm['mesa'] || '').trim(),
        orden: String(rowNorm['orden'] || '').trim()
    };
    
    contador++;
});

// Envolver todo dentro del nodo "padron" para que Firebase lo estructure perfecto
const jsonFinal = {
    "padron": padronFirebase
};

// 3. Guardar el archivo JSON
console.log(`Guardando ${contador} electores en el archivo JSON. Por favor espera...`);
fs.writeFileSync('padron_canindeyu_firebase.json', JSON.stringify(jsonFinal, null, 2));

console.log(`✅ ¡Éxito! Archivo padron_canindeyu_firebase.json generado.`);
console.log(`👥 Total de electores procesados: ${contador}`);