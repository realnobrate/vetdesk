interface EmailConfig {
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string
}

interface AppointmentReminderData {
  clinicName: string
  ownerName: string
  petName: string
  appointmentDate: string
  appointmentTime: string
  veterinarian?: string
  clinicPhone: string
}

interface VaccineReminderData {
  clinicName: string
  ownerName: string
  petName: string
  vaccineType: string
  dueDate: string
  clinicPhone: string
}

export function generateAppointmentReminderEmail(data: AppointmentReminderData): EmailConfig {
  const { clinicName, ownerName, petName, appointmentDate, appointmentTime, veterinarian, clinicPhone } = data

  const subject = `Appointment Reminder: ${petName} at ${clinicName}`
  
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
        
        <p>Dear ${ownerName},</p>
        
        <p>This is a friendly reminder that you have an upcoming appointment for <strong>${petName}</strong> at <strong>${clinicName}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <p style="margin: 0;"><strong>Date:</strong> ${appointmentDate}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${appointmentTime}</p>
          ${veterinarian ? `<p style="margin: 5px 0;"><strong>Veterinarian:</strong> Dr. ${veterinarian}</p>` : ''}
        </div>
        
        <p>If you need to reschedule or have any questions, please contact us at <strong>${clinicPhone}</strong>.</p>
        
        <p style="font-size: 14px; color: #666;">We look forward to seeing you and ${petName}!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin: 0;">
          This is an automated message from ${clinicName}. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  return {
    from: clinicName,
    to: ownerName,
    subject,
    html,
  }
}

export function generateVaccineReminderEmail(data: VaccineReminderData): EmailConfig {
  const { clinicName, ownerName, petName, vaccineType, dueDate, clinicPhone } = data

  const subject = `Vaccination Reminder: ${vaccineType} for ${petName}`
  
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
        
        <p>Dear ${ownerName},</p>
        
        <p>This is a friendly reminder that <strong>${petName}</strong> is due for <strong>${vaccineType}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
          <p style="margin: 0;"><strong>Pet:</strong> ${petName}</p>
          <p style="margin: 5px 0;"><strong>Vaccine:</strong> ${vaccineType}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        
        <p>Please contact <strong>${clinicName}</strong> at <strong>${clinicPhone}</strong> to schedule an appointment.</p>
        
        <p style="font-size: 14px; color: #666;">Keeping up with vaccinations is important for ${petName}'s health!</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #999; margin: 0;">
          This is an automated message from ${clinicName}. Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `

  return {
    from: clinicName,
    to: ownerName,
    subject,
    html,
  }
}

export async function sendEmail(config: EmailConfig, replyTo?: string): Promise<{ success: boolean; error?: string }> {
  // In a production environment, this would integrate with an email service like:
  // - SendGrid
  // - AWS SES
  // - Resend
  // - Mailgun
  // - Or a custom SMTP server
  
  const emailServiceUrl = import.meta.env.VITE_EMAIL_SERVICE_URL
  const emailServiceApiKey = import.meta.env.VITE_EMAIL_SERVICE_API_KEY

  if (!emailServiceUrl || !emailServiceApiKey) {
    console.error('Email service not configured. Missing VITE_EMAIL_SERVICE_URL or VITE_EMAIL_SERVICE_API_KEY')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch(emailServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailServiceApiKey}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: config.to,
        subject: config.subject,
        html: config.html,
        replyTo: replyTo || config.replyTo,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to send email')
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Mock email service for development/testing
export async function sendMockEmail(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  console.log('=== MOCK EMAIL SERVICE ===')
  console.log('To:', config.to)
  console.log('From:', config.from)
  console.log('Subject:', config.subject)
  console.log('Reply-To:', config.replyTo || 'Not set')
  console.log('========================')
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  return { success: true }
}
