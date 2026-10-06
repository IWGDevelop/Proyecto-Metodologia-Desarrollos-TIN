import type { FrecuenciaUsoIA, FuenteDatosIA, TipoRegistroCasoIA } from '@/lib/supabase/types'
import { PROCESOS_INTERNOS } from '@/lib/constants'

export const TIPOS_REGISTRO_CASO_IA: { value: TipoRegistroCasoIA; label: string; descripcion: string }[] = [
  {
    value: 'SOLICITUD',
    label: 'Solicitud de uso',
    descripcion: 'Quiero usar una herramienta de IA y necesito la autorización (TIN-P-008).',
  },
  {
    value: 'USO_EXISTENTE',
    label: 'Uso existente',
    descripcion: 'Ya estoy usando una herramienta de IA y quiero registrar cómo me aporta y su impacto.',
  },
]

export function labelTipoRegistroCasoIA(tipo: TipoRegistroCasoIA | null | undefined) {
  return TIPOS_REGISTRO_CASO_IA.find(t => t.value === tipo)?.label ?? 'Solicitud de uso'
}

/** Herramientas de IA habilitadas para registrar. `proveedor` se guarda en herramienta_proveedor. */
export const HERRAMIENTAS_IA: { value: string; label: string; proveedor: string }[] = [
  { value: 'Gemini',     label: 'Gemini',     proveedor: 'Google' },
  { value: 'Claude',     label: 'Claude',     proveedor: 'Anthropic' },
  { value: 'ChatGPT',    label: 'ChatGPT',    proveedor: 'OpenAI' },
  { value: 'Copilot',    label: 'Copilot',    proveedor: 'Microsoft' },
  { value: 'ElevenLabs', label: 'ElevenLabs', proveedor: 'ElevenLabs' },
  { value: 'OTRO',       label: 'Otra',       proveedor: 'Otro' },
]

/** Procesos para el selector (sin el valor legacy GENERAL) */
export const PROCESOS_CASO_IA = PROCESOS_INTERNOS.filter(p => p.value !== 'GENERAL')

/** Muestra la etiqueta del proceso; los registros antiguos guardaban texto libre. */
export function labelProcesoCasoIA(proceso: string) {
  return PROCESOS_INTERNOS.find(p => p.value === proceso)?.label ?? proceso
}

export const HORAS_LABORALES_MES = 160

/** Ahorro mensual en COP = horas ahorradas al mes × (salario / horas laborales al mes). */
export function ahorroMensualCOP(minutosMes: number | null | undefined, salario: number | null | undefined) {
  if (!minutosMes || !salario) return null
  return Math.round((minutosMes / 60) * (salario / HORAS_LABORALES_MES))
}

export const FUENTES_DATOS_IA: { value: FuenteDatosIA; label: string }[] = [
  { value: 'GMAIL',             label: 'Gmail' },
  { value: 'OUTLOOK',           label: 'Outlook / correo corporativo' },
  { value: 'GOOGLE_DRIVE',      label: 'Carpeta de Google Drive' },
  { value: 'GOOGLE_DOCS_SHEETS',label: 'Google Docs / Sheets' },
  { value: 'ONEDRIVE_SHAREPOINT', label: 'OneDrive / SharePoint' },
  { value: 'ARCHIVOS_LOCALES',  label: 'Archivos locales' },
  { value: 'SISTEMA_INTERNO',   label: 'Sistema interno (TMS, ERP, CRM...)' },
  { value: 'BASE_DATOS',        label: 'Base de datos' },
  { value: 'WEB_PUBLICA',       label: 'Información pública / web' },
  { value: 'OTRO',              label: 'Otro' },
]

export function labelFuenteDatosIA(fuente: string) {
  return FUENTES_DATOS_IA.find(f => f.value === fuente)?.label ?? fuente
}

export const FRECUENCIAS_USO_IA: { value: FrecuenciaUsoIA; label: string; vecesMes: number }[] = [
  { value: 'DIARIA',    label: 'Diaria',    vecesMes: 22 },
  { value: 'SEMANAL',   label: 'Semanal',   vecesMes: 4 },
  { value: 'QUINCENAL', label: 'Quincenal', vecesMes: 2 },
  { value: 'MENSUAL',   label: 'Mensual',   vecesMes: 1 },
]

/** Minutos ahorrados al mes = minutos por ejecución × ejecuciones estimadas al mes (22 días hábiles). */
export function minutosAhorradosMes(minutos: number | null | undefined, frecuencia: FrecuenciaUsoIA | null | undefined) {
  if (!minutos || !frecuencia) return null
  const f = FRECUENCIAS_USO_IA.find(x => x.value === frecuencia)
  return f ? minutos * f.vecesMes : null
}

export function fmtMinutos(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
