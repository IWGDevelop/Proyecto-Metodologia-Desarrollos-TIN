#!/usr/bin/env node
// Carga los instructivos y procedimientos de TIN en la base de conocimiento de ConeIA (RAG).
//
//   node --env-file=.env.local scripts/cargar-conocimiento-tickets.mjs "<carpeta o archivo>" [--simular]
//
// Lee los .docx, .md y .txt, los parte en fragmentos por sección (~1.200 caracteres),
// calcula el embedding de cada fragmento con Gemini y los guarda en ticket_conocimiento.
// Cada archivo reemplaza por completo sus fragmentos anteriores, así que se puede volver a
// ejecutar cuando un documento cambie. --simular muestra los fragmentos sin guardar nada.
// --probar="pregunta" (se puede repetir) calcula los embeddings en memoria, sin guardar, y
// muestra qué fragmentos encontraría el asistente para cada pregunta.
// Requiere NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y GEMINI_API_KEY.

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import { createClient } from '@supabase/supabase-js'

const MODELO = 'gemini-embedding-001'
const DIMENSIONES = 768
const MAX_FRAGMENTO = 1200
const EXTENSIONES = new Set(['.docx', '.md', '.txt'])

const args = process.argv.slice(2)
const simular = args.includes('--simular')
const preguntas = args.filter(a => a.startsWith('--probar=')).map(a => a.slice('--probar='.length)).filter(Boolean)
const destino = args.find(a => !a.startsWith('--'))
if (!destino) {
  console.error('Uso: node --env-file=.env.local scripts/cargar-conocimiento-tickets.mjs "<carpeta o archivo>" [--simular]')
  process.exit(1)
}

// ── Texto ────────────────────────────────────────────────────────────────────

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
const decodificar = s => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => entidades[e])
const limpiar = s => decodificar(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** HTML de mammoth → texto con títulos (##), viñetas (-) y tablas (| a | b |) */
function htmlATexto(html) {
  const sinImagenes = html.replace(/<img[^>]*>/g, '')
  const tablas = sinImagenes.replace(/<table[\s\S]*?<\/table>/g, tabla =>
    '\n' + [...tabla.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([fila]) => {
      const celdas = [...fila.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => limpiar(c[1])).filter(Boolean)
      const unicas = celdas.filter((c, i) => c !== celdas[i - 1])
      return unicas.length ? `| ${unicas.join(' | ')} |` : ''
    }).filter(Boolean).join('\n') + '\n')
  return tablas
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g, (_, t) => `\n## ${limpiar(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_, t) => `\n- ${limpiar(t)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, t) => `\n${limpiar(t)}\n`)
    .replace(/<[^>]+>/g, '')
    .split('\n').map(l => decodificar(l).trim()).filter(Boolean).join('\n')
}

/** Código (TIN-I-008) y título a partir del nombre del archivo */
function datosDocumento(archivo) {
  const base = path.basename(archivo, path.extname(archivo))
  const m = base.match(/^([A-Z]{2,5}-[A-Z]-\d{2,4})\s*[-–]?\s*(.*)$/)
  return { codigo: m ? m[1] : base.slice(0, 40), titulo: (m ? m[2] : base).replace(/\s+(-\s*)?\d+$/, '').trim() || base }
}

/** ¿La línea es un título de sección? (## …, o una línea corta en mayúsculas que termina en ':') */
function tituloSeccion(linea) {
  // Títulos largos (pasos que Word marcó como título) se tratan como texto
  if (linea.startsWith('## ')) {
    const t = linea.slice(3).replace(/^[-\d.\s]+/, '').replace(/:$/, '').trim()
    return t && t.length <= 80 ? t : null
  }
  if (linea.length <= 70 && /^[A-ZÁÉÍÓÚÑ0-9 .,()/-]+:?$/.test(linea) && /[A-ZÁÉÍÓÚÑ]{4}/.test(linea)) {
    return linea.replace(/^[-\d.\s]+/, '').replace(/:$/, '').trim() || null
  }
  return null
}

/** Parte el texto en fragmentos dentro de cada sección, sin cortar líneas */
function fragmentar(texto) {
  const fragmentos = []
  let seccion = null
  let actual = []
  const cerrar = () => {
    const contenido = actual.join('\n').trim()
    if (contenido.length >= 40) fragmentos.push({ seccion, contenido })
    actual = []
  }
  for (let linea of texto.split('\n')) {
    const titulo = tituloSeccion(linea)
    if (linea.startsWith('## ') && !titulo) linea = linea.slice(3)
    if (titulo) {
      cerrar()
      seccion = titulo
      continue
    }
    // Líneas muy largas (filas de tabla extensas) se parten por oraciones
    const piezas = linea.length > MAX_FRAGMENTO ? linea.match(new RegExp(`[^.]{1,${MAX_FRAGMENTO}}(\\.|$)`, 'g')) ?? [linea] : [linea]
    for (const pieza of piezas) {
      if (actual.join('\n').length + pieza.length > MAX_FRAGMENTO) {
        const ultima = actual[actual.length - 1]
        cerrar()
        // Solapamiento: se repite la última línea para no perder el hilo
        if (ultima && ultima.length < 300) actual.push(ultima)
      }
      actual.push(pieza.trim())
    }
  }
  cerrar()
  return fragmentos
}

async function leerTexto(archivo) {
  const ext = path.extname(archivo).toLowerCase()
  if (ext === '.docx') {
    const { value } = await mammoth.convertToHtml({ path: archivo })
    return htmlATexto(value)
  }
  return (await readFile(archivo, 'utf8')).replace(/\r\n/g, '\n')
}

// ── Embeddings ───────────────────────────────────────────────────────────────

async function embeddings(textos, titulo, taskType = 'RETRIEVAL_DOCUMENT') {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('Falta GEMINI_API_KEY')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:batchEmbedContents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      requests: textos.map(t => ({
        model: `models/${MODELO}`,
        content: { parts: [{ text: t }] },
        taskType,
        ...(titulo ? { title: titulo } : {}),
        outputDimensionality: DIMENSIONES,
      })),
    }),
  })
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  return json.embeddings.map(e => e.values)
}

// ── Principal ────────────────────────────────────────────────────────────────

const info = await stat(destino)
const archivos = info.isDirectory()
  ? (await readdir(destino)).filter(f => EXTENSIONES.has(path.extname(f).toLowerCase()) && !f.startsWith('~$')).map(f => path.join(destino, f))
  : [destino]
if (!archivos.length) {
  console.error('No hay archivos .docx, .md o .txt en', destino)
  process.exit(1)
}

const probar = preguntas.length > 0
const supabase = simular || probar ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let total = 0
/** Fragmentos con su vector, solo en modo --probar */
const enMemoria = []
const coseno = (a, b) => {
  let p = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return p / Math.sqrt(na * nb)
}

for (const archivo of archivos.sort()) {
  const nombre = path.basename(archivo)
  const { codigo, titulo } = datosDocumento(archivo)
  const fragmentos = fragmentar(await leerTexto(archivo))
  console.log(`\n${codigo} · ${titulo}: ${fragmentos.length} fragmentos`)
  if (simular) {
    fragmentos.forEach((f, i) => console.log(`  [${i + 1}] (${f.seccion ?? 'sin sección'}) ${f.contenido.length} car. ${f.contenido.slice(0, 90).replace(/\n/g, ' ')}…`))
    continue
  }

  // El texto que se vectoriza lleva el documento y la sección, para que la búsqueda los tenga en cuenta
  const textos = fragmentos.map(f => `${codigo} ${titulo}${f.seccion ? ` — ${f.seccion}` : ''}\n${f.contenido}`)
  const vectores = []
  for (let i = 0; i < textos.length; i += 50) vectores.push(...(await embeddings(textos.slice(i, i + 50), `${codigo} ${titulo}`)))
  if (probar) {
    fragmentos.forEach((f, i) => enMemoria.push({ codigo, seccion: f.seccion, contenido: f.contenido, vector: vectores[i] }))
    continue
  }

  const { error: errBorrar } = await supabase.from('ticket_conocimiento').delete().eq('archivo', nombre)
  if (errBorrar) throw new Error(`No se pudieron borrar los fragmentos anteriores de ${nombre}: ${errBorrar.message}`)
  const filas = fragmentos.map((f, i) => ({
    documento_codigo: codigo,
    documento_titulo: titulo,
    archivo: nombre,
    seccion: f.seccion,
    orden: i + 1,
    contenido: f.contenido,
    embedding: JSON.stringify(vectores[i]),
    modelo_embedding: MODELO,
  }))
  const { error } = await supabase.from('ticket_conocimiento').insert(filas)
  if (error) throw new Error(`No se pudieron guardar los fragmentos de ${nombre}: ${error.message}`)
  total += filas.length
  console.log(`  guardados ${filas.length}`)
}

if (probar) {
  const vectoresPreguntas = await embeddings(preguntas, null, 'RETRIEVAL_QUERY')
  preguntas.forEach((pregunta, i) => {
    console.log(`\n» ${pregunta}`)
    enMemoria
      .map(f => ({ ...f, similitud: coseno(vectoresPreguntas[i], f.vector) }))
      .sort((a, b) => b.similitud - a.similitud)
      .slice(0, 5)
      .forEach(f => console.log(`  ${f.similitud.toFixed(3)}  ${f.codigo} (${f.seccion ?? 'sin sección'}) ${f.contenido.slice(0, 80).replace(/\n/g, ' ')}…`))
  })
} else if (!simular) {
  console.log(`\nListo: ${total} fragmentos de ${archivos.length} documentos.`)
}
