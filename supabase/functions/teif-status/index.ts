import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { invoice_id } = await req.json()
    if (!invoice_id) throw new Error('invoice_id requis')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data, error } = await supabase
      .from('invoices')
      .select('id, teif_status, middleware_document_id, teif_xml, updated_at')
      .eq('id', invoice_id)
      .single()
    if (error) throw error

    let status = data.teif_status || 'NONE'

    if (status === 'PENDING' && data.updated_at) {
      const elapsed = Date.now() - new Date(data.updated_at).getTime()
      if (elapsed >= 15000) {
        await supabase
          .from('invoices')
          .update({ teif_status: 'ACCEPTED', updated_at: new Date().toISOString() })
          .eq('id', invoice_id)
        status = 'ACCEPTED'
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: data.id,
        status,
        document_id: data.middleware_document_id || null,
        has_xml: !!data.teif_xml,
        updated_at: data.updated_at,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
