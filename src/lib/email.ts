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
    subject: process.env.GMAIL_FROM, // impersonate sending address
  })
}

function buildRawMessage(to: string | string[], subject: string, html: string): string {
  const recipients = Array.isArray(to) ? to.join(', ') : to
  const from = process.env.GMAIL_FROM ?? 'no-reply@iwglogistics.com'

  const message = [
    `From: IWG Logistics <${from}>`,
    `To: ${recipients}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n')

  return Buffer.from(message).toString('base64url')
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const auth = getAuth()
  const gmail = google.gmail({ version: 'v1', auth })

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: buildRawMessage(to, subject, html) },
  })
}
