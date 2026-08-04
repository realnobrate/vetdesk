import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { FilePlus2, FileUp, FlaskConical, Pill, Plus, Stethoscope, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateVisitInput, MedicalNoteTemplate } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ErrorText({ message }: { message: string | null }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function valueOrNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

const clinicalVisitSchema = z.object({
  visitDate: z.string().min(1, "Visit date is required."),
  complaint: z.string().trim().min(2, "Presenting complaint is required."),
  assessment: z.string().trim().min(2, "Assessment is required."),
  plan: z.string().trim().min(2, "Treatment plan is required."),
  temperature: z.union([z.literal(""), z.coerce.number().min(20).max(50)]),
  heartRate: z.union([z.literal(""), z.coerce.number().int().min(1).max(400)]),
  respiratoryRate: z.union([z.literal(""), z.coerce.number().int().min(1).max(300)]),
  bodyCondition: z.union([z.literal(""), z.coerce.number().min(1).max(9)]),
});

export function ClinicalVisitDialog({
  templates,
  staffName,
  onCreate,
}: {
  templates: MedicalNoteTemplate[];
  staffName: string;
  onCreate: (input: CreateVisitInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    visitDate: today(),
    complaint: "",
    subjective: "",
    objective: "",
    assessment: "",
    differential: "",
    plan: "",
    followUp: "",
    internalNotes: "",
    temperature: "",
    heartRate: "",
    respiratoryRate: "",
    bodyCondition: "",
    recordStatus: "final" as "draft" | "final",
  });

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setForm((current) => ({
      ...current,
      complaint: template.presenting_complaint ?? current.complaint,
      subjective: template.subjective_notes ?? "",
      objective: template.objective_notes ?? "",
      assessment: template.assessment ?? "",
      plan: template.treatment_plan ?? "",
      followUp: template.follow_up_recommendations ?? "",
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = clinicalVisitSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the clinical note fields.");
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        visit_date: new Date(`${form.visitDate}T12:00:00`).toISOString(),
        reason: form.complaint.trim(),
        presenting_complaint: form.complaint.trim(),
        subjective_notes: valueOrNull(form.subjective),
        objective_notes: valueOrNull(form.objective),
        assessment: form.assessment.trim(),
        differential_diagnosis: valueOrNull(form.differential),
        treatment_plan: form.plan.trim(),
        follow_up_recommendations: valueOrNull(form.followUp),
        internal_notes: valueOrNull(form.internalNotes),
        temperature_celsius: form.temperature ? Number(form.temperature) : null,
        heart_rate_bpm: form.heartRate ? Number(form.heartRate) : null,
        respiratory_rate_bpm: form.respiratoryRate ? Number(form.respiratoryRate) : null,
        body_condition_score: form.bodyCondition ? Number(form.bodyCondition) : null,
        record_status: form.recordStatus,
        finalized_at: form.recordStatus === "final" ? new Date().toISOString() : null,
        notes: null,
        weight_lb: null,
        meds_prescribed: null,
        vaccines_administered: [],
        vet_name: staffName,
      });
      setOpen(false);
      setForm((current) => ({
        ...current,
        visitDate: today(),
        complaint: "",
        subjective: "",
        objective: "",
        assessment: "",
        differential: "",
        plan: "",
        followUp: "",
        internalNotes: "",
        temperature: "",
        heartRate: "",
        respiratoryRate: "",
        bodyCondition: "",
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The clinical note could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Stethoscope className="mr-2 h-4 w-4" />New SOAP note</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New clinical SOAP note</DialogTitle>
          <DialogDescription>Draft notes remain clearly marked until a veterinarian finalizes them.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Visit date</Label><Input type="date" value={form.visitDate} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} /></div>
            <div className="space-y-2">
              <Label>Reusable template</Label>
              <Select onValueChange={applyTemplate} disabled={templates.length === 0}>
                <SelectTrigger><SelectValue placeholder={templates.length ? "Choose a template" : "No templates yet"} /></SelectTrigger>
                <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Presenting complaint *</Label><Input value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Subjective</Label><Textarea className="min-h-28" value={form.subjective} onChange={(event) => setForm({ ...form, subjective: event.target.value })} /></div>
            <div className="space-y-2"><Label>Objective</Label><Textarea className="min-h-28" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></div>
            <div className="space-y-2"><Label>Assessment *</Label><Textarea className="min-h-28" value={form.assessment} onChange={(event) => setForm({ ...form, assessment: event.target.value })} /></div>
            <div className="space-y-2"><Label>Treatment plan *</Label><Textarea className="min-h-28" value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2"><Label>Temp °C</Label><Input type="number" step="0.1" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} /></div>
            <div className="space-y-2"><Label>Heart bpm</Label><Input type="number" value={form.heartRate} onChange={(event) => setForm({ ...form, heartRate: event.target.value })} /></div>
            <div className="space-y-2"><Label>Resp. bpm</Label><Input type="number" value={form.respiratoryRate} onChange={(event) => setForm({ ...form, respiratoryRate: event.target.value })} /></div>
            <div className="space-y-2"><Label>BCS 1–9</Label><Input type="number" step="0.5" value={form.bodyCondition} onChange={(event) => setForm({ ...form, bodyCondition: event.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Differential diagnosis</Label><Textarea value={form.differential} onChange={(event) => setForm({ ...form, differential: event.target.value })} /></div>
          <div className="space-y-2"><Label>Follow-up recommendations</Label><Textarea value={form.followUp} onChange={(event) => setForm({ ...form, followUp: event.target.value })} /></div>
          <div className="space-y-2"><Label>Internal staff notes</Label><Textarea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /><p className="text-xs text-muted-foreground">Internal notes must never be exposed in a future owner portal.</p></div>
          <div className="space-y-2"><Label>Record status</Label><Select value={form.recordStatus} onValueChange={(value: "draft" | "final") => setForm({ ...form, recordStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="final">Final</SelectItem></SelectContent></Select></div>
          <ErrorText message={error} />
          <DialogFooter><Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save clinical note"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const vaccinationSchema = z.object({
  vaccineName: z.string().trim().min(2, "Vaccine name is required."),
  administeredOn: z.string().min(1, "Administration date is required."),
});

export function VaccinationDialog({ onCreate }: { onCreate: (input: Parameters<typeof import("@/lib/api").createVaccination>[1]) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vaccineName: "", manufacturer: "", lotNumber: "", administeredOn: today(), expiresOn: "", site: "", nextDue: "", notes: "" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = vaccinationSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the vaccination fields.");
    setSaving(true); setError(null);
    try {
      await onCreate({ vaccine_name: form.vaccineName.trim(), manufacturer: valueOrNull(form.manufacturer), lot_number: valueOrNull(form.lotNumber), administered_on: form.administeredOn, expires_on: form.expiresOn || null, administration_site: valueOrNull(form.site), next_due_date: form.nextDue || null, notes: valueOrNull(form.notes) });
      setOpen(false); setForm({ vaccineName: "", manufacturer: "", lotNumber: "", administeredOn: today(), expiresOn: "", site: "", nextDue: "", notes: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Vaccination could not be saved."); } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Syringe className="mr-2 h-4 w-4" />Record vaccination</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Record vaccination</DialogTitle><DialogDescription>A next due date automatically creates or updates the patient recall.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Vaccine name *</Label><Input value={form.vaccineName} onChange={(e) => setForm({ ...form, vaccineName: e.target.value })} /></div><div className="space-y-2"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></div><div className="space-y-2"><Label>Lot number</Label><Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} /></div><div className="space-y-2"><Label>Administration site</Label><Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></div><div className="space-y-2"><Label>Administered on *</Label><Input type="date" value={form.administeredOn} onChange={(e) => setForm({ ...form, administeredOn: e.target.value })} /></div><div className="space-y-2"><Label>Product expires</Label><Input type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} /></div><div className="space-y-2"><Label>Next due date</Label><Input type="date" value={form.nextDue} onChange={(e) => setForm({ ...form, nextDue: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><ErrorText message={error} /><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save vaccination"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

const prescriptionSchema = z.object({
  medicationName: z.string().trim().min(2, "Medication name is required."),
  dosage: z.string().trim().min(1, "Dosage is required."),
  frequency: z.string().trim().min(1, "Frequency is required."),
  instructions: z.string().trim().min(2, "Instructions are required."),
  refills: z.coerce.number().int().min(0).max(99),
});

export function PrescriptionDialog({ onCreate }: { onCreate: (input: Parameters<typeof import("@/lib/api").createPrescription>[1]) => Promise<unknown> }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ medicationName: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "", startsOn: today(), endsOn: "", refills: "0", warnings: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); const parsed = prescriptionSchema.safeParse(form); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the prescription fields."); setSaving(true); setError(null); try { await onCreate({ medication_name: form.medicationName.trim(), dosage: form.dosage.trim(), frequency: form.frequency.trim(), duration: valueOrNull(form.duration), route: valueOrNull(form.route), instructions: form.instructions.trim(), starts_on: form.startsOn, ends_on: form.endsOn || null, refills_allowed: Number(form.refills), medication_warnings: valueOrNull(form.warnings) }); setOpen(false); setForm({ medicationName: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "", startsOn: today(), endsOn: "", refills: "0", warnings: "" }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Prescription could not be saved."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Pill className="mr-2 h-4 w-4" />New prescription</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New prescription</DialogTitle><DialogDescription>Medication decisions remain the responsibility of the prescribing veterinarian.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Medication *</Label><Input value={form.medicationName} onChange={(e) => setForm({ ...form, medicationName: e.target.value })} /></div><div className="space-y-2"><Label>Dosage *</Label><Input placeholder="e.g. 50 mg" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} /></div><div className="space-y-2"><Label>Frequency *</Label><Input placeholder="e.g. every 12 hours" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} /></div><div className="space-y-2"><Label>Duration</Label><Input placeholder="e.g. 7 days" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div><div className="space-y-2"><Label>Route</Label><Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} /></div><div className="space-y-2"><Label>Refills</Label><Input type="number" min="0" max="99" value={form.refills} onChange={(e) => setForm({ ...form, refills: e.target.value })} /></div><div className="space-y-2"><Label>Starts</Label><Input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></div><div className="space-y-2"><Label>Ends</Label><Input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></div></div><div className="space-y-2"><Label>Instructions *</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div><div className="space-y-2"><Label>Medication warnings</Label><Textarea value={form.warnings} onChange={(e) => setForm({ ...form, warnings: e.target.value })} /></div><ErrorText message={error} /><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create prescription"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

const labSchema = z.object({ testName: z.string().trim().min(2, "Test name is required."), category: z.string().trim().min(2, "Category is required.") });

export function LabOrderDialog({ onCreate }: { onCreate: (input: Parameters<typeof import("@/lib/api").createLabOrder>[1]) => Promise<unknown> }) {
  const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ testName: "", category: "Hematology", laboratoryType: "internal" as "internal" | "external", laboratoryName: "", sampleType: "", notes: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); const parsed = labSchema.safeParse(form); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the lab order fields."); setSaving(true); setError(null); try { await onCreate({ test_name: form.testName.trim(), category: form.category.trim(), laboratory_type: form.laboratoryType, laboratory_name: valueOrNull(form.laboratoryName), sample_type: valueOrNull(form.sampleType), notes: valueOrNull(form.notes) }); setOpen(false); setForm({ testName: "", category: "Hematology", laboratoryType: "internal", laboratoryName: "", sampleType: "", notes: "" }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Lab order could not be saved."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><FlaskConical className="mr-2 h-4 w-4" />Order lab test</Button></DialogTrigger><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Order laboratory test</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Test name *</Label><Input value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category *</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div><div className="space-y-2"><Label>Laboratory</Label><Select value={form.laboratoryType} onValueChange={(value: "internal" | "external") => setForm({ ...form, laboratoryType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="external">External</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>External lab name</Label><Input disabled={form.laboratoryType === "internal"} value={form.laboratoryName} onChange={(e) => setForm({ ...form, laboratoryName: e.target.value })} /></div><div className="space-y-2"><Label>Sample type</Label><Input value={form.sampleType} onChange={(e) => setForm({ ...form, sampleType: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><ErrorText message={error} /><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create lab order"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function DocumentUploadDialog({ onUpload }: { onUpload: (file: File, input: { document_type: string; client_visible?: boolean }) => Promise<unknown> }) {
  const [open, setOpen] = useState(false); const [file, setFile] = useState<File | null>(null); const [documentType, setDocumentType] = useState("laboratory_result"); const [clientVisible, setClientVisible] = useState(false); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const accept = useMemo(() => "application/pdf,image/jpeg,image/png,image/webp", []);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!file) return setError("Choose a document to upload."); setSaving(true); setError(null); try { await onUpload(file, { document_type: documentType, client_visible: clientVisible }); setOpen(false); setFile(null); setClientVisible(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Document could not be uploaded."); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><FileUp className="mr-2 h-4 w-4" />Upload document</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Upload clinical document</DialogTitle><DialogDescription>Private storage. PDF/JPG/PNG/WEBP, maximum 10 MB.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Document type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="laboratory_result">Laboratory result</SelectItem><SelectItem value="imaging">Diagnostic imaging</SelectItem><SelectItem value="previous_record">Previous clinic record</SelectItem><SelectItem value="consent">Consent form</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>File</Label><Input type="file" accept={accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div><label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} /><span><strong>Owner-visible in a future portal</strong><br /><span className="text-muted-foreground">Internal notes remain separate and are never included automatically.</span></span></label><ErrorText message={error} /><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Uploading…" : "Upload securely"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function MedicalTemplateDialog({ onCreate }: { onCreate: (input: Parameters<typeof import("@/lib/api").createMedicalNoteTemplate>[0]) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", complaint: "", subjective: "", objective: "", assessment: "", plan: "", followUp: "" });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2) return setError("Template name is required.");
    setSaving(true); setError(null);
    try {
      await onCreate({ name: form.name.trim(), presenting_complaint: valueOrNull(form.complaint), subjective_notes: valueOrNull(form.subjective), objective_notes: valueOrNull(form.objective), assessment: valueOrNull(form.assessment), treatment_plan: valueOrNull(form.plan), follow_up_recommendations: valueOrNull(form.followUp) });
      setOpen(false); setForm({ name: "", complaint: "", subjective: "", objective: "", assessment: "", plan: "", followUp: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Template could not be saved."); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><FilePlus2 className="mr-2 h-4 w-4" />New template</Button></DialogTrigger><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Create SOAP template</DialogTitle><DialogDescription>Templates store reusable structure only; review every note before finalizing it.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>Template name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-2"><Label>Presenting complaint</Label><Input value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Subjective</Label><Textarea value={form.subjective} onChange={(e) => setForm({ ...form, subjective: e.target.value })} /></div><div className="space-y-2"><Label>Objective</Label><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></div><div className="space-y-2"><Label>Assessment</Label><Textarea value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} /></div><div className="space-y-2"><Label>Treatment plan</Label><Textarea value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} /></div></div><div className="space-y-2"><Label>Follow-up</Label><Textarea value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} /></div><ErrorText message={error} /><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save template"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function EmptyClinicalAction({ label }: { label: string }) {
  return <span className="inline-flex items-center text-sm text-muted-foreground"><Plus className="mr-1 h-4 w-4" />{label}</span>;
}
