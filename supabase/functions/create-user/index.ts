import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Only a logged-in administrator may create accounts
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    const { data: callerData } = await supabaseAdmin.auth.getUser(token)
    const caller = callerData?.user
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("is_admin, is_active").eq("id", caller.id).maybeSingle()
    if (!callerProfile?.is_admin || callerProfile.is_active === false) {
      return new Response(
        JSON.stringify({ error: "Only administrators can create users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { email, password, full_name, position, is_admin } = await req.json()

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    // Update profile with name, email, position and admin flag
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        email,
        position: position || "Supervisor",
        is_admin: is_admin ?? false,
      })
      .eq("id", authData.user.id)

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
