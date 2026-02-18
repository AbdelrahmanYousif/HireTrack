import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action = 'create' } = body

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // ── DELETE USER ────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body

      if (!userId) throw new Error('userId is required for deletion')

      // Step 1: Delete from Supabase Auth (cascades to profiles via trigger)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── CREATE USER ────────────────────────────────────────────────────────────
    const { email, password, companyName, role = 'customer' } = body

    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    if (role === 'customer' && !companyName) {
      throw new Error('Company name is required for customer accounts')
    }

    if (!['customer', 'admin'].includes(role)) {
      throw new Error('Role must be either "customer" or "admin"')
    }

    // Step 1: Create the user in Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) throw userError

    // Step 2: Update profile role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', userData.user.id)

    if (profileError) throw profileError

    // Step 3: If customer, create customer record
    let customerData = null
    if (role === 'customer') {
      const { data, error: customerError } = await supabaseAdmin
        .from('customers')
        .insert({
          user_id: userData.user.id,
          company_name: companyName,
        })
        .select()
        .single()

      if (customerError) throw customerError
      customerData = data
    }

    return new Response(
      JSON.stringify({
        success: true,
        role,
        customer: customerData,
        user: { id: userData.user.id, email: userData.user.email },
        message: `${role === 'admin' ? 'Admin' : 'Customer'} account created successfully`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})