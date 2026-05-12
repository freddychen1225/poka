/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    const body = await req.json()

    const {
      family_id,
      parent_member_id,
      endpoint,
      p256dh,
      auth,
      platform = 'unknown',
      browser = 'unknown',
      pwa_installed = false,
      app_instance_id = null,
    } = body ?? {}

    if (!family_id || !parent_member_id || !endpoint || !p256dh || !auth) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        member_id: parent_member_id,
        device_role: 'parent_phone',
        platform,
        browser,
        pwa_installed,
        app_instance_id,
        status: 'active',
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (deviceError) {
      return new Response(
        JSON.stringify({ error: 'Create device failed', detail: deviceError }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const { data: subscription, error: subError } = await supabase
      .from('push_subscriptions')
      .insert({
        device_id: device.id,
        family_id,
        member_id: parent_member_id,
        endpoint,
        p256dh,
        auth,
        status: 'active',
      })
      .select()
      .single()

    if (subError) {
      return new Response(
        JSON.stringify({ error: 'Create subscription failed', detail: subError }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        subscription_id: subscription.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Unexpected error',
        detail: String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})