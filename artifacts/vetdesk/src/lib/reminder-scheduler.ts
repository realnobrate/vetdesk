import { subHours, subDays, addDays, format } from 'date-fns';
import { supabase } from './supabase';
import { 
  createAppointmentReminder, 
  createVaccineReminder, 
  recordSentEmail, 
  updateNotificationStatus 
} from './api';
import { 
  generateAppointmentReminderEmail, 
  generateVaccineReminderEmail, 
  sendEmail,
  sendMockEmail 
} from './email';

// Schedule appointment reminder when appointment is created
export async function scheduleAppointmentReminder(
  clinicId: number,
  appointmentId: number,
  scheduledAt: string,
  hoursBefore: number
): Promise<void> {
  const appointmentDate = new Date(scheduledAt);
  const reminderDate = subHours(appointmentDate, hoursBefore);
  
  // Only schedule if reminder time is in the future
  if (reminderDate > new Date()) {
    await createAppointmentReminder(
      clinicId,
      appointmentId,
      reminderDate.toISOString()
    );
  }
}

// Schedule vaccine reminders when recall is created
export async function scheduleVaccineReminders(
  clinicId: number,
  recallId: number,
  dueDate: string,
  daysBefore: number
): Promise<void> {
  const due = new Date(dueDate);
  
  // Schedule reminder X days before due date
  const reminderDate = subDays(due, daysBefore);
  
  if (reminderDate > new Date()) {
    await createVaccineReminder(
      clinicId,
      recallId,
      reminderDate.toISOString()
    );
  }
  
  // Schedule reminder on due date
  if (due > new Date()) {
    await createVaccineReminder(
      clinicId,
      recallId,
      due.toISOString()
    );
  }
  
  // Schedule reminder 7 days after due date if still incomplete
  const overdueDate = addDays(due, 7);
  if (overdueDate > new Date()) {
    await createVaccineReminder(
      clinicId,
      recallId,
      overdueDate.toISOString()
    );
  }
}

// Process pending reminders (to be called by cron job or edge function)
export async function processPendingReminders(): Promise<void> {
  const now = new Date().toISOString();
  
  // Fetch pending reminders that are due
  const { data: pendingReminders, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now);
  
  if (error) {
    console.error('Failed to fetch pending reminders:', error);
    return;
  }
  
  if (!pendingReminders || pendingReminders.length === 0) {
    return;
  }
  
  // Process each reminder
  for (const reminder of pendingReminders) {
    try {
      if (reminder.type === 'appointment_reminder') {
        await processAppointmentReminder(reminder);
      } else if (reminder.type === 'vaccine_reminder') {
        await processVaccineReminder(reminder);
      }
    } catch (error) {
      console.error(`Failed to process reminder ${reminder.id}:`, error);
      await updateNotificationStatus(reminder.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

async function processAppointmentReminder(reminder: any): Promise<void> {
  // Fetch appointment with pet and owner details
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      *,
      pets (*, owners (*))
    `)
    .eq('id', reminder.target_id)
    .single();
  
  if (error || !appointment) {
    throw new Error('Failed to fetch appointment details');
  }
  
  // Fetch clinic details
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', reminder.clinic_id)
    .single();
  
  if (!clinic) {
    throw new Error('Failed to fetch clinic details');
  }
  
  // Check if reminders are enabled
  if (!clinic.appointment_reminders_enabled) {
    await updateNotificationStatus(reminder.id, 'cancelled', 'Reminders disabled');
    return;
  }
  
  const pet = appointment.pets;
  const owner = pet.owners;
  
  // Generate email content
  const appointmentDate = format(new Date(appointment.scheduled_at), 'MMMM d, yyyy');
  const appointmentTime = format(new Date(appointment.scheduled_at), 'h:mm a');
  
  const emailConfig = generateAppointmentReminderEmail({
    clinicName: clinic.name,
    ownerName: `${owner.first_name} ${owner.last_name}`,
    petName: pet.name,
    appointmentDate,
    appointmentTime,
    veterinarian: appointment.vet_name || undefined,
    clinicPhone: clinic.phone || 'Contact clinic',
  });
  
  // Send email
  const useMock = !import.meta.env.VITE_EMAIL_SERVICE_URL || !import.meta.env.VITE_EMAIL_SERVICE_API_KEY;
  const result = useMock 
    ? await sendMockEmail(emailConfig)
    : await sendEmail(emailConfig, clinic.reply_to_email || undefined);
  
  if (result.success) {
    // Record sent email
    await recordSentEmail(
      reminder.clinic_id,
      reminder.id,
      owner.email || '',
      emailConfig.subject,
      emailConfig.html,
      'sent'
    );
    
    // Update reminder status
    await updateNotificationStatus(reminder.id, 'sent');
  } else {
    // Record failed email
    await recordSentEmail(
      reminder.clinic_id,
      reminder.id,
      owner.email || '',
      emailConfig.subject,
      emailConfig.html,
      'failed',
      result.error
    );
    
    // Update reminder status
    await updateNotificationStatus(reminder.id, 'failed', result.error);
  }
}

async function processVaccineReminder(reminder: any): Promise<void> {
  // Fetch recall with pet and owner details
  const { data: recall, error } = await supabase
    .from('recalls')
    .select(`
      *,
      pets (*, owners (*))
    `)
    .eq('id', reminder.target_id)
    .single();
  
  if (error || !recall) {
    throw new Error('Failed to fetch recall details');
  }
  
  // Skip if recall is already completed
  if (recall.status === 'completed') {
    await updateNotificationStatus(reminder.id, 'cancelled', 'Recall completed');
    return;
  }
  
  // Fetch clinic details
  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', reminder.clinic_id)
    .single();
  
  if (!clinic) {
    throw new Error('Failed to fetch clinic details');
  }
  
  // Check if reminders are enabled
  if (!clinic.recall_reminders_enabled) {
    await updateNotificationStatus(reminder.id, 'cancelled', 'Reminders disabled');
    return;
  }
  
  // Check for duplicate reminders (same type and target within last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentReminders } = await supabase
    .from('sent_emails')
    .select('id')
    .eq('clinic_id', reminder.clinic_id)
    .eq('notification_queue_id', reminder.id)
    .gte('sent_at', sevenDaysAgo.toISOString())
    .limit(1);
  
  if (recentReminders && recentReminders.length > 0) {
    await updateNotificationStatus(reminder.id, 'cancelled', 'Duplicate reminder');
    return;
  }
  
  const pet = recall.pets;
  const owner = pet.owners;
  
  // Generate email content
  const dueDate = format(new Date(recall.due_date), 'MMMM d, yyyy');
  
  const emailConfig = generateVaccineReminderEmail({
    clinicName: clinic.name,
    ownerName: `${owner.first_name} ${owner.last_name}`,
    petName: pet.name,
    vaccineType: recall.recall_type,
    dueDate,
    clinicPhone: clinic.phone || 'Contact clinic',
  });
  
  // Send email
  const useMock = !import.meta.env.VITE_EMAIL_SERVICE_URL || !import.meta.env.VITE_EMAIL_SERVICE_API_KEY;
  const result = useMock 
    ? await sendMockEmail(emailConfig)
    : await sendEmail(emailConfig, clinic.reply_to_email || undefined);
  
  if (result.success) {
    // Record sent email
    await recordSentEmail(
      reminder.clinic_id,
      reminder.id,
      owner.email || '',
      emailConfig.subject,
      emailConfig.html,
      'sent'
    );
    
    // Update reminder status
    await updateNotificationStatus(reminder.id, 'sent');
  } else {
    // Record failed email
    await recordSentEmail(
      reminder.clinic_id,
      reminder.id,
      owner.email || '',
      emailConfig.subject,
      emailConfig.html,
      'failed',
      result.error
    );
    
    // Update reminder status
    await updateNotificationStatus(reminder.id, 'failed', result.error);
  }
}
