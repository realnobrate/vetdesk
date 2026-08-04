import JSZip from 'jszip';
import writeExcelFile, { type Sheet, type SheetData } from 'write-excel-file/browser';
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
function safeExportValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  const normalized = Array.isArray(value) ? value.join('; ') : value;

  if (typeof normalized === 'number' || typeof normalized === 'boolean') {
    return normalized;
  }

  const text = String(normalized);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function arrayToCSV(data: object[], headers: string[]): string {
  if (data.length === 0) return headers.join(',') + '\n';
  
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = safeExportValue((row as Record<string, unknown>)[header]);
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

function createSheet(
  name: string,
  data: object[],
  headers: string[],
): Sheet<Blob> {
  const rows: SheetData = [
    headers.map((header) => ({
      value: header,
      type: String,
      fontWeight: 'bold',
      backgroundColor: '#0D4F6C',
      textColor: '#FFFFFF',
    })),
    ...data.map((row) => {
      const record = row as Record<string, unknown>;
      return headers.map((header) => safeExportValue(record[header]));
    }),
  ];

  return {
    data: rows,
    sheet: name,
    stickyRowsCount: 1,
    columns: headers.map((header) => ({
      width: Math.min(
        40,
        Math.max(
          12,
          header.length + 2,
          ...data.map((row) =>
            String(safeExportValue((row as Record<string, unknown>)[header])).length + 2,
          ),
        ),
      ),
    })),
  };
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
export async function exportToExcel(data: ClinicExportData): Promise<Blob> {
  const sheets: Sheet<Blob>[] = [];
  
  // Clinic worksheet
  const clinicHeaders = ['id', 'name', 'logo_url', 'phone', 'email', 'address', 'website', 'working_hours', 'created_at'];
  sheets.push(createSheet('Clinic', [data.clinic], clinicHeaders));
  
  // Owners worksheet
  const ownerHeaders = ['id', 'clinic_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'created_at'];
  sheets.push(createSheet('Owners', data.owners, ownerHeaders));
  
  // Pets worksheet
  const petHeaders = ['id', 'owner_id', 'name', 'species', 'breed', 'sex', 'birth_date', 'weight_lb', 'notes', 'created_at', 'owner_name'];
  sheets.push(createSheet('Pets', data.pets, petHeaders));
  
  // Appointments worksheet
  const appointmentHeaders = ['id', 'pet_id', 'scheduled_at', 'reason', 'status', 'created_at', 'pet_name', 'owner_name'];
  sheets.push(createSheet('Appointments', data.appointments, appointmentHeaders));
  
  // Visits worksheet
  const visitHeaders = ['id', 'pet_id', 'visit_date', 'reason', 'notes', 'weight_lb', 'meds_prescribed', 'vaccines_administered', 'vet_name', 'created_at', 'pet_name', 'owner_name'];
  sheets.push(createSheet('Visits', data.visits, visitHeaders));
  
  // Recalls worksheet
  const recallHeaders = ['id', 'pet_id', 'visit_id', 'recall_type', 'due_date', 'status', 'sent_at', 'completed_at', 'notes', 'created_at', 'pet_name', 'owner_name'];
  sheets.push(createSheet('Recalls', data.recalls, recallHeaders));
  
  // Staff worksheet
  const staffHeaders = ['id', 'user_id', 'clinic_id', 'name', 'email', 'role', 'status', 'created_at'];
  sheets.push(createSheet('Staff', data.staff, staffHeaders));

  return writeExcelFile(sheets).toBlob();
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
