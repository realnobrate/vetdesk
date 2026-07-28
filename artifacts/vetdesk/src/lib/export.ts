import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { Clinic, Owner, Pet, Visit, Recall, Appointment, Staff } from './types';

export interface ClinicExportData {
  clinic: Clinic;
  owners: (Owner & { pets?: Pet[] })[];
  pets: (Pet & { owner_name?: string })[];
  appointments: (Appointment & { pet_name?: string; owner_name?: string })[];
  visits: (Visit & { pet_name?: string; owner_name?: string })[];
  recalls: (Recall & { pet_name?: string; owner_name?: string })[];
  staff: Staff[];
}

// CSV generation helpers
function arrayToCSV<T extends Record<string, any>>(data: T[], headers: string[]): string {
  if (data.length === 0) return headers.join(',') + '\n';
  
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Excel generation helpers
function createWorksheet<T extends Record<string, any>>(data: T[], headers: string[]): XLSX.WorkSheet {
  const wsData: any[][] = [headers];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return value === null || value === undefined ? '' : value;
    });
    wsData.push(values);
  }
  
  return XLSX.utils.aoa_to_sheet(wsData);
}

// Export to CSV (ZIP bundle)
export async function exportToCSV(data: ClinicExportData): Promise<Blob> {
  const zip = new JSZip();
  
  // Clinic CSV
  const clinicHeaders = ['id', 'name', 'logo_url', 'phone', 'email', 'address', 'website', 'working_hours', 'created_at'];
  zip.file('clinic.csv', arrayToCSV([data.clinic], clinicHeaders));
  
  // Owners CSV
  const ownerHeaders = ['id', 'clinic_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'created_at'];
  zip.file('owners.csv', arrayToCSV(data.owners, ownerHeaders));
  
  // Pets CSV
  const petHeaders = ['id', 'owner_id', 'name', 'species', 'breed', 'sex', 'birth_date', 'weight_lb', 'notes', 'created_at', 'owner_name'];
  zip.file('pets.csv', arrayToCSV(data.pets, petHeaders));
  
  // Appointments CSV
  const appointmentHeaders = ['id', 'pet_id', 'scheduled_at', 'reason', 'status', 'created_at', 'pet_name', 'owner_name'];
  zip.file('appointments.csv', arrayToCSV(data.appointments, appointmentHeaders));
  
  // Visits CSV
  const visitHeaders = ['id', 'pet_id', 'visit_date', 'reason', 'notes', 'weight_lb', 'meds_prescribed', 'vaccines_administered', 'vet_name', 'created_at', 'pet_name', 'owner_name'];
  zip.file('visits.csv', arrayToCSV(data.visits, visitHeaders));
  
  // Recalls CSV
  const recallHeaders = ['id', 'pet_id', 'visit_id', 'recall_type', 'due_date', 'status', 'sent_at', 'completed_at', 'notes', 'created_at', 'pet_name', 'owner_name'];
  zip.file('recalls.csv', arrayToCSV(data.recalls, recallHeaders));
  
  // Staff CSV
  const staffHeaders = ['id', 'user_id', 'clinic_id', 'name', 'email', 'role', 'status', 'created_at'];
  zip.file('staff.csv', arrayToCSV(data.staff, staffHeaders));
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

// Export to Excel (single workbook with worksheets)
export function exportToExcel(data: ClinicExportData): Blob {
  const wb = XLSX.utils.book_new();
  
  // Clinic worksheet
  const clinicHeaders = ['id', 'name', 'logo_url', 'phone', 'email', 'address', 'website', 'working_hours', 'created_at'];
  const clinicWs = createWorksheet([data.clinic], clinicHeaders);
  XLSX.utils.book_append_sheet(wb, clinicWs, 'Clinic');
  
  // Owners worksheet
  const ownerHeaders = ['id', 'clinic_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'created_at'];
  const ownersWs = createWorksheet(data.owners, ownerHeaders);
  XLSX.utils.book_append_sheet(wb, ownersWs, 'Owners');
  
  // Pets worksheet
  const petHeaders = ['id', 'owner_id', 'name', 'species', 'breed', 'sex', 'birth_date', 'weight_lb', 'notes', 'created_at', 'owner_name'];
  const petsWs = createWorksheet(data.pets, petHeaders);
  XLSX.utils.book_append_sheet(wb, petsWs, 'Pets');
  
  // Appointments worksheet
  const appointmentHeaders = ['id', 'pet_id', 'scheduled_at', 'reason', 'status', 'created_at', 'pet_name', 'owner_name'];
  const appointmentsWs = createWorksheet(data.appointments, appointmentHeaders);
  XLSX.utils.book_append_sheet(wb, appointmentsWs, 'Appointments');
  
  // Visits worksheet
  const visitHeaders = ['id', 'pet_id', 'visit_date', 'reason', 'notes', 'weight_lb', 'meds_prescribed', 'vaccines_administered', 'vet_name', 'created_at', 'pet_name', 'owner_name'];
  const visitsWs = createWorksheet(data.visits, visitHeaders);
  XLSX.utils.book_append_sheet(wb, visitsWs, 'Visits');
  
  // Recalls worksheet
  const recallHeaders = ['id', 'pet_id', 'visit_id', 'recall_type', 'due_date', 'status', 'sent_at', 'completed_at', 'notes', 'created_at', 'pet_name', 'owner_name'];
  const recallsWs = createWorksheet(data.recalls, recallHeaders);
  XLSX.utils.book_append_sheet(wb, recallsWs, 'Recalls');
  
  // Staff worksheet
  const staffHeaders = ['id', 'user_id', 'clinic_id', 'name', 'email', 'role', 'status', 'created_at'];
  const staffWs = createWorksheet(data.staff, staffHeaders);
  XLSX.utils.book_append_sheet(wb, staffWs, 'Staff');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Download helper
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate backup filename
export function generateBackupFilename(extension: 'zip' | 'xlsx'): string {
  const date = new Date().toISOString().split('T')[0];
  return `VetDesk_Backup_${date}.${extension}`;
}
