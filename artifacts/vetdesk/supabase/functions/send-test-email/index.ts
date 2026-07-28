import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

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
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { clinicId, testEmail } = await req.json()

    if (!clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinicId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase credentials not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch clinic details
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .single()

    if (clinicError) {
      console.error('Failed to fetch clinic:', clinicError.message)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch clinic: ${clinicError.message}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!clinic) {
      console.error('Clinic not found for ID:', clinicId)
      return new Response(
        JSON.stringify({ success: false, error: `Clinic not found for ID: ${clinicId}` }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use test email if provided, otherwise use clinic email
    const recipientEmail = testEmail || clinic.email

    if (!recipientEmail) {
      console.error('No email address available')
      return new Response(
        JSON.stringify({ success: false, error: 'No email address available for test' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate test email content
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #2563eb; margin-top: 0;">Test Email</h1>
          
          <p>This is a test email from <strong>${clinic.name}</strong>.</p>
          
          <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p style="margin: 0;"><strong>Clinic:</strong> ${clinic.name}</p>
            <p style="margin: 5px 0;"><strong>Sent to:</strong> ${recipientEmail}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p style="font-size: 14px; color: #666;">If you received this email, your email notification system is working correctly!</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; margin: 0;">
            This is an automated test message from ${clinic.name}.
          </p>
        </div>
      </body>
      </html>
    `

    const subject = `Test Email from ${clinic.name}`
    const senderName = clinic.email_sender_name || 'VetDesk'
    const senderAddress = `${senderName} <onboarding@resend.dev>`

    // Send email via Resend
    const emailResult = await sendEmailViaResend({
      to: recipientEmail,
      from: senderAddress,
      subject,
      html,
      replyTo: clinic.reply_to_email || undefined
    }, resendApiKey)

    // Record sent email in database
    const { error: insertError } = await supabase.from('sent_emails').insert({
      clinic_id: clinic.id,
      notification_queue_id: null,
      recipient_email: recipientEmail,
      subject,
      body: html,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error || null
    })

    if (insertError) {
      console.error('Failed to record sent email:', insertError.message)
      // Continue anyway - email was sent but recording failed
    }

    if (emailResult.success) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Test email sent successfully',
          to: recipientEmail
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('Failed to send test email:', emailResult.error)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: emailResult.error || 'Failed to send test email'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendEmailViaResend(
  email: { to: string; from: string; subject: string; html: string; replyTo?: string },
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: email.replyTo,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data.message || data.error || JSON.stringify(data)
      console.error('Resend API error:', { status: response.status, errorMessage })
      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    console.error('Resend API network error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
