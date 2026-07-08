import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/gmail.send']

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Faltan credenciales de Google Service Account en las variables de entorno')
  }

  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
    subject: process.env.GMAIL_FROM,
  })
}

/** RFC 2047 Base64 para tildes y caracteres especiales en el asunto */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
}

/** ID raíz del hilo por requerimiento — todos los correos del mismo req lo referencian */
function threadMessageId(requerimientoId: string): string {
  return `<thread-req-${requerimientoId}@tinflow.iwglogistics.com>`
}

function buildRawMessage(
  to: string | string[],
  subject: string,
  html: string,
  requerimientoId?: string,
): string {
  const recipients = Array.isArray(to) ? to.join(', ') : to
  const from = process.env.GMAIL_FROM ?? 'no-reply@iwglogistics.com'
  const msgId = `<msg-${Date.now()}-${Math.random().toString(36).slice(2)}@tinflow.iwglogistics.com>`
  const threadId = requerimientoId ? threadMessageId(requerimientoId) : undefined

  const headers = [
    `From: TIN-FLOW <${from}>`,
    `To: ${recipients}`,
    `Subject: ${encodeSubject(subject)}`,
    `Message-ID: ${msgId}`,
    ...(threadId ? [`In-Reply-To: ${threadId}`, `References: ${threadId}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
  ]

  const message = [...headers, '', html].join('\r\n')
  return Buffer.from(message, 'utf-8').toString('base64url')
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  requerimientoId?: string
}

export async function sendEmail({ to, subject, html, requerimientoId }: SendEmailOptions): Promise<void> {
  const auth = getAuth()
  const gmail = google.gmail({ version: 'v1', auth })

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: buildRawMessage(to, subject, html, requerimientoId) },
  })
}
