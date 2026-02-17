import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request data
    const { email, password, companyName } = await req.json()

    // Validate input
    if (!email || !password || !companyName) {
      throw new Error('Email, password, and company name are required')
    }

    // Create Supabase Admin client with service role
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

    // Step 1: Create the user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) throw userError

    // Step 2: Update profile to set role as 'customer'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'customer' })
      .eq('id', userData.user.id)

    if (profileError) throw profileError

    // Step 3: Create customer record
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        user_id: userData.user.id,
        company_name: companyName,
      })
      .select()
      .single()

    if (customerError) throw customerError

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        customer: customerData,
        message: 'Customer created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})