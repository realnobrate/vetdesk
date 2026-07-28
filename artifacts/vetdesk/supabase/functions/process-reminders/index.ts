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
    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch pending reminders that are due
    const now = new Date().toISOString()
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch pending reminders:', fetchError)
      throw fetchError
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending reminders to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processed = 0
    let sent = 0
    let failed = 0
    let cancelled = 0

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        // Mark as processing to prevent duplicate processing
        const { error: updateError } = await supabase
          .from('notification_queue')
          .update({ status: 'processing' })
          .eq('id', reminder.id)
          .eq('status', 'pending')

        if (updateError) {
          console.log(`Reminder ${reminder.id} already being processed, skipping`)
          continue
        }

        if (reminder.type === 'appointment_reminder') {
          const result = await processAppointmentReminder(supabase, reminder, resendApiKey)
          if (result === 'sent') sent++
          else if (result === 'failed') failed++
          else if (result === 'cancelled') cancelled++
        } else if (reminder.type === 'vaccine_reminder') {
          const result = await processVaccineReminder(supabase, reminder, resendApiKey)
          if (result === 'sent') sent++
          else if (result === 'failed') failed++
          else if (result === 'cancelled') cancelled++
        }

        processed++
      } catch (error) {
        console.error(`Failed to process reminder ${reminder.id}:`, error)
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', reminder.id)
        failed++
        processed++
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processed} reminders`,
        processed,
        sent,
        failed,
        cancelled
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in process-reminders:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processAppointmentReminder(
  supabase: any,
  reminder: any,
  resendApiKey: string
): Promise<'sent' | 'failed' | 'cancelled'> {
  // Fetch appointment with pet and owner details
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      *,
      pets (*, owners (*))
    `)
    .eq('id', reminder.target_id)
    .single()

  if (error || !appointment) {
    console.error(`Failed to fetch appointment ${reminder.target_id}:`, error)
    throw new Error('Failed to fetch appointment details')
  }

  // Fetch clinic details
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', reminder.clinic_id)
    .single()

  if (!clinic) {
    console.error(`Failed to fetch clinic ${reminder.clinic_id}`)
    throw new Error('Failed to fetch clinic details')
  }

  // Check if reminders are enabled for this clinic
  if (!clinic.appointment_reminders_enabled) {
    await supabase
      .from('notification_queue')
      .update({ status: 'cancelled', error_message: 'Reminders disabled' })
      .eq('id', reminder.id)
    return 'cancelled'
  }

  const pet = appointment.pets
  const owner = pet.owners

  // Validate owner has email address
  if (!owner.email) {
    await supabase
      .from('notification_queue')
      .update({ status: 'failed', error_message: 'Owner has no email address' })
      .eq('id', reminder.id)
    return 'failed'
  }

  // Generate email content
  // Format date and time using Europe/Belgrade timezone to ensure correct display
  const appointmentDate = new Date(appointment.scheduled_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Belgrade'
  })
  const appointmentTime = new Date(appointment.scheduled_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Belgrade'
  })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Reminder</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">Appointment Reminder</h1>
        
        <p>Dear ${owner.first_name} ${owner.last_name},</p>
        
        <p>This is a friendly reminder that you have an upcoming appointment for <strong>${pet.name}</strong> at <strong>${clinic.name}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <p style="margin: 0;"><strong>Date:</strong> ${appointmentDate}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${appointmentTime}</p>
          ${appointment.reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${appointment.reason}</p>` : ''}
          ${appointment.vet_name ? `<p style="margin: 5px 0;"><strong>Veterinarian:</strong> Dr. ${appointment.vet_name}</p>` : ''}
        </div>
        
        <p>If you need to reschedule or have any questions, please contact us at <strong>${clinic.phone || 'Contact clinic'}</strong>.</p>
        
        <p style="font-size: 14px; color: #666;">We look forward to seeing you and ${pet.name}!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin: 0;">
          This is an automated message from ${clinic.name}. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  const subject = `Appointment Reminder: ${pet.name} at ${clinic.name}`

  console.log(`Sending appointment reminder email to: ${owner.email}`)

  // Send email via Resend
  const emailResult = await sendEmailViaResend({
    to: owner.email,
    from: `${clinic.email_sender_name || 'VetDesk'} <onboarding@resend.dev>`,
    subject,
    html,
    replyTo: clinic.reply_to_email || undefined
  }, resendApiKey)

  console.log(`Appointment reminder email result:`, { success: emailResult.success, error: emailResult.error })

  // Record sent email in database
  await supabase.from('sent_emails').insert({
    clinic_id: reminder.clinic_id,
    notification_queue_id: reminder.id,
    recipient_email: owner.email,
    subject,
    body: html,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error || null
  })

  // Update reminder status based on email result
  if (emailResult.success) {
    await supabase
      .from('notification_queue')
      .update({ status: 'sent' })
      .eq('id', reminder.id)
    return 'sent'
  } else {
    await supabase
      .from('notification_queue')
      .update({ status: 'failed', error_message: emailResult.error })
      .eq('id', reminder.id)
    return 'failed'
  }
}

async function processVaccineReminder(
  supabase: any,
  reminder: any,
  resendApiKey: string
): Promise<'sent' | 'failed' | 'cancelled'> {
  // Fetch recall with pet and owner details
  const { data: recall, error } = await supabase
    .from('recalls')
    .select(`
      *,
      pets (*, owners (*))
    `)
    .eq('id', reminder.target_id)
    .single()

  if (error || !recall) {
    console.error(`Failed to fetch recall ${reminder.target_id}:`, error)
    throw new Error('Failed to fetch recall details')
  }

  // Cancel reminder if recall is already completed
  if (recall.status === 'completed') {
    await supabase
      .from('notification_queue')
      .update({ status: 'cancelled', error_message: 'Recall completed' })
      .eq('id', reminder.id)
    return 'cancelled'
  }

  // Fetch clinic details
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', reminder.clinic_id)
    .single()

  if (!clinic) {
    console.error(`Failed to fetch clinic ${reminder.clinic_id}`)
    throw new Error('Failed to fetch clinic details')
  }

  // Check if reminders are enabled for this clinic
  if (!clinic.recall_reminders_enabled) {
    await supabase
      .from('notification_queue')
      .update({ status: 'cancelled', error_message: 'Reminders disabled' })
      .eq('id', reminder.id)
    return 'cancelled'
  }

  const pet = recall.pets
  const owner = pet.owners

  // Validate owner has email address
  if (!owner.email) {
    await supabase
      .from('notification_queue')
      .update({ status: 'failed', error_message: 'Owner has no email address' })
      .eq('id', reminder.id)
    return 'failed'
  }

  // Check for duplicate reminders to prevent sending multiple emails for the same recall
  // Only consider a reminder a duplicate if a successful email was already sent for the same target
  // within the last 7 days. This prevents spamming the user while allowing re-reminders after a week.
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Find successful sent emails for the same clinic within 7 days
  const { data: recentSentEmails } = await supabase
    .from('sent_emails')
    .select('id, notification_queue_id')
    .eq('clinic_id', reminder.clinic_id)
    .eq('status', 'sent')
    .gte('sent_at', sevenDaysAgo.toISOString())

  if (recentSentEmails && recentSentEmails.length > 0) {
    // Get the notification_queue_ids from these sent emails
    const queueIds = recentSentEmails.map(e => e.notification_queue_id).filter(Boolean)
    
    if (queueIds.length > 0) {
      // Check if any of these queue entries have the same target_id (recall)
      // Exclude the current reminder to avoid self-detection
      const { data: duplicateQueueEntries } = await supabase
        .from('notification_queue')
        .select('id, target_id')
        .in('id', queueIds)
        .eq('type', 'vaccine_reminder')
        .eq('target_id', reminder.target_id)
        .neq('id', reminder.id)
        .limit(1)

      if (duplicateQueueEntries && duplicateQueueEntries.length > 0) {
        await supabase
          .from('notification_queue')
          .update({ status: 'cancelled', error_message: 'Duplicate reminder' })
          .eq('id', reminder.id)
        return 'cancelled'
      }
    }
  }

  // Generate email content
  // Format date using Europe/Belgrade timezone to ensure correct display
  const dueDate = new Date(recall.due_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Belgrade'
  })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vaccination Reminder</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">Vaccination Reminder</h1>
        
        <p>Dear ${owner.first_name} ${owner.last_name},</p>
        
        <p>This is a friendly reminder that <strong>${pet.name}</strong> is due for <strong>${recall.recall_type}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <p style="margin: 0;"><strong>Pet:</strong> ${pet.name}</p>
          <p style="margin: 5px 0;"><strong>Vaccine:</strong> ${recall.recall_type}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        
        <p>Please contact <strong>${clinic.name}</strong> at <strong>${clinic.phone || 'Contact clinic'}</strong> to schedule an appointment.</p>
        
        <p style="font-size: 14px; color: #666;">Keeping up with vaccinations is important for ${pet.name}'s health!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin: 0;">
          This is an automated message from ${clinic.name}. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  const subject = `Vaccination Reminder: ${recall.recall_type} for ${pet.name}`

  console.log(`Sending vaccination reminder email to: ${owner.email}`)

  // Send email via Resend
  const emailResult = await sendEmailViaResend({
    to: owner.email,
    from: `${clinic.email_sender_name || 'VetDesk'} <onboarding@resend.dev>`,
    subject,
    html,
    replyTo: clinic.reply_to_email || undefined
  }, resendApiKey)

  console.log(`Vaccination reminder email result:`, { success: emailResult.success, error: emailResult.error })

  // Record sent email in database
  await supabase.from('sent_emails').insert({
    clinic_id: reminder.clinic_id,
    notification_queue_id: reminder.id,
    recipient_email: owner.email,
    subject,
    body: html,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error || null
  })

  // Update reminder status based on email result
  if (emailResult.success) {
    await supabase
      .from('notification_queue')
      .update({ status: 'sent' })
      .eq('id', reminder.id)
    return 'sent'
  } else {
    await supabase
      .from('notification_queue')
      .update({ status: 'failed', error_message: emailResult.error })
      .eq('id', reminder.id)
    return 'failed'
  }
}

async function sendEmailViaResend(
  email: { to: string; from: string; subject: string; html: string; replyTo?: string },
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Resend API request:`, { to: email.to, from: email.from, subject: email.subject })
    
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
    console.log(`Resend API response:`, { status: response.status, ok: response.ok, data })

    if (!response.ok) {
      const errorMessage = data.message || data.error || JSON.stringify(data)
      console.error('Resend API error:', { status: response.status, errorMessage })
      return { success: false, error: errorMessage }
    }

    console.log('Resend API: Email sent successfully')
    return { success: true }
  } catch (error) {
    console.error('Resend API network error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
