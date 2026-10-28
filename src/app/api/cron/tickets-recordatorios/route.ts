import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ejecutarRecordatoriosTickets } from '@/lib/tickets/recordatorios'

// Cron horario (vercel.json: "0 * * * *"): recalcula tiempos de los tickets abiertos,
// envía recordatorios y escalamientos, aplica cierres automáticos y el resumen diario.
export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const resultado = await ejecutarRecordatoriosTickets(supabase)
    if (resultado.errores.length) console.error('[cron tickets] errores:', resultado.errores)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error('[cron tickets] error general:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
