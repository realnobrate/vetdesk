import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  HeartPulse,
  LoaderCircle,
  PawPrint,
  Pill,
  Save,
  ShieldAlert,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import {
  ClinicalVisitDialog,
  DocumentUploadDialog,
  LabOrderDialog,
  MedicalTemplateDialog,
  PrescriptionDialog,
  VaccinationDialog,
} from "@/components/clinical/record-dialogs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  createLabOrder,
  createMedicalNoteTemplate,
  createPrescription,
  createVaccination,
  createVisit,
  getClinicalRecord,
  updateLabOrder,
  updatePet,
  updatePrescriptionStatus,
  uploadClinicalDocument,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { LabOrder, Prescription } from "@/lib/types";

function content(value: string | null | undefined): string {
  return value?.trim() || "Not recorded";
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["active", "completed", "final"].includes(status)) return "default";
  if (["cancelled", "discontinued", "abnormal"].includes(status)) return "destructive";
  if (["draft", "ordered", "processing", "collected"].includes(status)) return "secondary";
  return "outline";
}

export default function ClinicalRecordPage() {
  const { id } = useParams();
  const petId = Number(id);
  const { staff } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = staff?.role === "admin" || staff?.role === "veterinarian";
  const queryKey = ["clinical-record", petId];

  const recordQuery = useQuery({
    queryKey,
    queryFn: () => getClinicalRecord(petId),
    enabled: Number.isSafeInteger(petId) && petId > 0,
  });

  const refreshRecord = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["pet", petId] }),
    ]);
  };

  const visitMutation = useMutation({
    mutationFn: (input: Parameters<typeof createVisit>[1]) => createVisit(petId, input),
    onSuccess: async () => { toast({ title: "Clinical note saved" }); await refreshRecord(); },
  });
  const vaccinationMutation = useMutation({
    mutationFn: (input: Parameters<typeof createVaccination>[1]) => createVaccination(petId, input),
    onSuccess: async () => { toast({ title: "Vaccination recorded", description: "Any next due date was added to recalls." }); await refreshRecord(); },
  });
  const prescriptionMutation = useMutation({
    mutationFn: (input: Parameters<typeof createPrescription>[1]) => createPrescription(petId, input),
    onSuccess: async () => { toast({ title: "Prescription created" }); await refreshRecord(); },
  });
  const labMutation = useMutation({
    mutationFn: (input: Parameters<typeof createLabOrder>[1]) => createLabOrder(petId, input),
    onSuccess: async () => { toast({ title: "Laboratory order created" }); await refreshRecord(); },
  });
  const templateMutation = useMutation({
    mutationFn: createMedicalNoteTemplate,
    onSuccess: async () => { toast({ title: "SOAP template created" }); await refreshRecord(); },
  });
  const uploadMutation = useMutation({
    mutationFn: ({ file, input }: { file: File; input: Parameters<typeof uploadClinicalDocument>[2] }) => uploadClinicalDocument(petId, file, input),
    onSuccess: async () => { toast({ title: "Document uploaded securely" }); await refreshRecord(); },
  });
  const prescriptionStatusMutation = useMutation({
    mutationFn: ({ id: prescriptionId, status }: { id: number; status: Prescription["status"] }) => updatePrescriptionStatus(prescriptionId, status),
    onSuccess: async () => { toast({ title: "Medication status updated" }); await refreshRecord(); },
    onError: (error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({
    microchip: "", allergies: "", conditions: "", warnings: "", insuranceProvider: "",
    insurancePolicy: "", reproductiveStatus: "unknown", isDeceased: false, deceasedOn: "", causeOfDeath: "",
  });

  useEffect(() => {
    const pet = recordQuery.data?.pet;
    if (!pet || editingProfile) return;
    setProfile({
      microchip: pet.microchip_number ?? "",
      allergies: pet.allergies ?? "",
      conditions: pet.chronic_conditions ?? "",
      warnings: pet.important_warnings ?? "",
      insuranceProvider: pet.insurance_provider ?? "",
      insurancePolicy: pet.insurance_policy_number ?? "",
      reproductiveStatus: pet.reproductive_status ?? "unknown",
      isDeceased: pet.is_deceased,
      deceasedOn: pet.deceased_on ?? "",
      causeOfDeath: pet.cause_of_death ?? "",
    });
  }, [recordQuery.data?.pet, editingProfile]);

  const profileMutation = useMutation({
    mutationFn: () => updatePet(petId, {
      microchip_number: profile.microchip.trim() || null,
      allergies: profile.allergies.trim() || null,
      chronic_conditions: profile.conditions.trim() || null,
      important_warnings: profile.warnings.trim() || null,
      insurance_provider: profile.insuranceProvider.trim() || null,
      insurance_policy_number: profile.insurancePolicy.trim() || null,
      reproductive_status: profile.reproductiveStatus as "intact" | "neutered" | "spayed" | "unknown",
      is_deceased: profile.isDeceased,
      deceased_on: profile.isDeceased && profile.deceasedOn ? profile.deceasedOn : null,
      cause_of_death: profile.isDeceased && profile.causeOfDeath.trim() ? profile.causeOfDeath.trim() : null,
    }),
    onSuccess: async () => { setEditingProfile(false); toast({ title: "Patient clinical profile updated" }); await refreshRecord(); },
    onError: (error) => toast({ title: "Profile update failed", description: error.message, variant: "destructive" }),
  });

  const [resultLab, setResultLab] = useState<LabOrder | null>(null);
  const [labResult, setLabResult] = useState({ text: "", numeric: "", unit: "", range: "", abnormal: false });
  const openLabResult = (lab: LabOrder) => {
    setResultLab(lab);
    setLabResult({ text: lab.result_text ?? "", numeric: lab.result_numeric?.toString() ?? "", unit: lab.result_unit ?? "", range: lab.reference_range ?? "", abnormal: lab.is_abnormal });
  };
  const saveLabResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!resultLab) return;
    try {
      await updateLabOrder(resultLab.id, { status: "completed", result_text: labResult.text.trim() || null, result_numeric: labResult.numeric ? Number(labResult.numeric) : null, result_unit: labResult.unit.trim() || null, reference_range: labResult.range.trim() || null, is_abnormal: labResult.abnormal, reviewed: true });
      setResultLab(null); toast({ title: "Laboratory result saved and reviewed" }); await refreshRecord();
    } catch (error) { toast({ title: "Result update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" }); }
  };

  const generateSummary = () => {
    const data = recordQuery.data;
    if (!data) return;
    const doc = new jsPDF();
    let y = 18;
    const addLine = (label: string, value: string, bold = false) => {
      if (y > 275) { doc.addPage(); y = 18; }
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(`${label}${value}`, 170);
      doc.text(lines, 20, y); y += lines.length * 6 + 2;
    };
    doc.setFontSize(18); addLine("", `VetDesk Clinical Summary — ${data.pet.name}`, true);
    doc.setFontSize(10);
    addLine("Owner: ", `${data.pet.owner.first_name} ${data.pet.owner.last_name}`);
    addLine("Species / breed: ", `${data.pet.species} / ${data.pet.breed ?? "not recorded"}`);
    addLine("Microchip: ", content(data.pet.microchip_number));
    addLine("Allergies: ", content(data.pet.allergies));
    addLine("Chronic conditions: ", content(data.pet.chronic_conditions));
    addLine("Warnings: ", content(data.pet.important_warnings));
    y += 4; addLine("", "Clinical visits", true);
    for (const visit of [...data.pet.visits].reverse()) {
      addLine("", `${formatDate(visit.visit_date)} — ${visit.reason}`, true);
      addLine("Assessment: ", content(visit.assessment ?? visit.notes));
      addLine("Plan: ", content(visit.treatment_plan));
    }
    y += 4; addLine("", "Vaccinations", true);
    for (const item of data.vaccinations) addLine("", `${formatDate(item.administered_on)} — ${item.vaccine_name}${item.next_due_date ? `; next due ${formatDate(item.next_due_date)}` : ""}`);
    y += 4; addLine("", "Medications", true);
    for (const item of data.prescriptions) addLine("", `${item.medication_name}: ${item.dosage}, ${item.frequency} (${item.status})`);
    y += 4; addLine("", "Laboratory", true);
    for (const item of data.labOrders) addLine("", `${item.test_name}: ${item.status}${item.is_abnormal ? " — ABNORMAL" : ""}`);
    addLine("", "Generated from VetDesk. Clinical decisions require veterinarian review.");
    doc.save(`${data.pet.name.replace(/[^a-zA-Z0-9-_]/g, "-")}-clinical-summary.pdf`);
  };

  const warningItems = useMemo(() => {
    const pet = recordQuery.data?.pet;
    if (!pet) return [];
    return [pet.important_warnings, pet.allergies, pet.chronic_conditions].filter((value): value is string => Boolean(value?.trim()));
  }, [recordQuery.data?.pet]);

  if (recordQuery.isLoading) return <Shell><div className="flex min-h-[60vh] items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div></Shell>;
  if (recordQuery.isError) return <Shell><div className="mx-auto max-w-2xl p-6"><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Clinical record unavailable</AlertTitle><AlertDescription>{recordQuery.error.message}. Confirm that the clinical-core migration has been applied.</AlertDescription></Alert></div></Shell>;
  const data = recordQuery.data;
  if (!data) return null;

  return (
    <Shell>
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Link href={`/pets/${petId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Back to patient chart</Link>
        <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><HeartPulse className="h-7 w-7" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold tracking-tight">{data.pet.name} clinical record</h1>{data.pet.is_deceased ? <Badge variant="outline">Deceased</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">Longitudinal medical record · {data.pet.owner.first_name} {data.pet.owner.last_name}</p></div></div>
          <Button variant="outline" onClick={generateSummary}><Download className="mr-2 h-4 w-4" />Clinical summary PDF</Button>
        </header>

        {!canEdit ? <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Read-only clinical access</AlertTitle><AlertDescription>Only veterinarians and clinic administrators can change medical records.</AlertDescription></Alert> : null}
        {warningItems.length > 0 ? <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Patient alerts</AlertTitle><AlertDescription>{warningItems.join(" · ")}</AlertDescription></Alert> : null}

        <Tabs defaultValue="timeline" className="space-y-5">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
            <TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="vaccinations">Vaccinations</TabsTrigger><TabsTrigger value="medications">Medications</TabsTrigger><TabsTrigger value="laboratory">Laboratory</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            {canEdit ? <div className="flex flex-wrap justify-end gap-2"><MedicalTemplateDialog onCreate={(input) => templateMutation.mutateAsync(input)} /><ClinicalVisitDialog templates={data.noteTemplates} staffName={staff?.name ?? "Veterinarian"} onCreate={(input) => visitMutation.mutateAsync(input)} /></div> : null}
            {data.pet.visits.length === 0 ? <EmptySection message="No clinical visits have been recorded." /> : [...data.pet.visits].reverse().map((visit) => <Card key={visit.id}><CardHeader className="pb-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-lg">{visit.presenting_complaint ?? visit.reason}</CardTitle><div className="flex items-center gap-2"><Badge variant={statusVariant(visit.record_status)}>{visit.record_status}</Badge><span className="text-sm text-muted-foreground">{formatDate(visit.visit_date)}</span></div></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Subjective</p><p className="mt-1 whitespace-pre-wrap text-sm">{content(visit.subjective_notes)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Objective</p><p className="mt-1 whitespace-pre-wrap text-sm">{content(visit.objective_notes)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assessment</p><p className="mt-1 whitespace-pre-wrap text-sm">{content(visit.assessment ?? visit.notes)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Plan</p><p className="mt-1 whitespace-pre-wrap text-sm">{content(visit.treatment_plan)}</p></div></div>{visit.temperature_celsius || visit.heart_rate_bpm || visit.respiratory_rate_bpm || visit.body_condition_score ? <div className="flex flex-wrap gap-2 border-t pt-3 text-xs"><Badge variant="outline">Temp {visit.temperature_celsius ?? "—"} °C</Badge><Badge variant="outline">Heart {visit.heart_rate_bpm ?? "—"} bpm</Badge><Badge variant="outline">Resp {visit.respiratory_rate_bpm ?? "—"} bpm</Badge><Badge variant="outline">BCS {visit.body_condition_score ?? "—"}/9</Badge></div> : null}{visit.internal_notes ? <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><strong>Internal:</strong> {visit.internal_notes}</div> : null}</CardContent></Card>)}
          </TabsContent>

          <TabsContent value="profile"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Clinical profile</CardTitle>{canEdit ? <Button variant={editingProfile ? "outline" : "secondary"} onClick={() => setEditingProfile(!editingProfile)}>{editingProfile ? "Cancel" : "Edit profile"}</Button> : null}</CardHeader><CardContent>{editingProfile ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Microchip number</Label><Input value={profile.microchip} onChange={(e) => setProfile({ ...profile, microchip: e.target.value })} /></div><div className="space-y-2"><Label>Reproductive status</Label><Select value={profile.reproductiveStatus} onValueChange={(value) => setProfile({ ...profile, reproductiveStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="intact">Intact</SelectItem><SelectItem value="neutered">Neutered</SelectItem><SelectItem value="spayed">Spayed</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Insurance provider</Label><Input value={profile.insuranceProvider} onChange={(e) => setProfile({ ...profile, insuranceProvider: e.target.value })} /></div><div className="space-y-2"><Label>Insurance policy</Label><Input value={profile.insurancePolicy} onChange={(e) => setProfile({ ...profile, insurancePolicy: e.target.value })} /></div></div><div className="space-y-2"><Label>Allergies</Label><Textarea value={profile.allergies} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} /></div><div className="space-y-2"><Label>Chronic conditions</Label><Textarea value={profile.conditions} onChange={(e) => setProfile({ ...profile, conditions: e.target.value })} /></div><div className="space-y-2"><Label>Important warnings</Label><Textarea value={profile.warnings} onChange={(e) => setProfile({ ...profile, warnings: e.target.value })} /></div><label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={profile.isDeceased} onChange={(e) => setProfile({ ...profile, isDeceased: e.target.checked })} />Mark patient as deceased</label>{profile.isDeceased ? <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Date of death</Label><Input type="date" value={profile.deceasedOn} onChange={(e) => setProfile({ ...profile, deceasedOn: e.target.value })} /></div><div className="space-y-2"><Label>Cause of death</Label><Input value={profile.causeOfDeath} onChange={(e) => setProfile({ ...profile, causeOfDeath: e.target.value })} /></div></div> : null}<Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}><Save className="mr-2 h-4 w-4" />Save clinical profile</Button></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[["Microchip", content(data.pet.microchip_number)], ["Reproductive status", content(data.pet.reproductive_status)], ["Allergies", content(data.pet.allergies)], ["Chronic conditions", content(data.pet.chronic_conditions)], ["Important warnings", content(data.pet.important_warnings)], ["Insurance", data.pet.insurance_provider ? `${data.pet.insurance_provider}${data.pet.insurance_policy_number ? ` · ${data.pet.insurance_policy_number}` : ""}` : "Not recorded"]].map(([label, value]) => <div key={label} className="rounded-xl border p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm">{value}</p></div>)}</div>}</CardContent></Card></TabsContent>

          <TabsContent value="vaccinations" className="space-y-4">{canEdit ? <div className="flex justify-end"><VaccinationDialog onCreate={(input) => vaccinationMutation.mutateAsync(input)} /></div> : null}{data.vaccinations.length === 0 ? <EmptySection message="No structured vaccination records yet." /> : <div className="grid gap-4 md:grid-cols-2">{data.vaccinations.map((item) => <Card key={item.id}><CardHeader><div className="flex items-start justify-between"><CardTitle className="flex items-center gap-2 text-lg"><Syringe className="h-5 w-5 text-primary" />{item.vaccine_name}</CardTitle><Badge variant="outline">{formatDate(item.administered_on)}</Badge></div></CardHeader><CardContent className="space-y-2 text-sm"><p><strong>Manufacturer:</strong> {content(item.manufacturer)}</p><p><strong>Lot:</strong> {content(item.lot_number)}</p><p><strong>Site:</strong> {content(item.administration_site)}</p><p><strong>Next due:</strong> {item.next_due_date ? formatDate(item.next_due_date) : "Not scheduled"}</p></CardContent></Card>)}</div>}</TabsContent>

          <TabsContent value="medications" className="space-y-4">{canEdit ? <div className="flex justify-end"><PrescriptionDialog onCreate={(input) => prescriptionMutation.mutateAsync(input)} /></div> : null}{data.prescriptions.length === 0 ? <EmptySection message="No structured prescriptions yet." /> : <div className="space-y-4">{data.prescriptions.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold"><Pill className="mr-2 inline h-4 w-4 text-primary" />{item.medication_name}</h3><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div><p className="mt-2 text-sm">{item.dosage} · {item.frequency}{item.duration ? ` · ${item.duration}` : ""}</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.instructions}</p>{item.medication_warnings ? <p className="mt-2 text-sm text-destructive"><strong>Warning:</strong> {item.medication_warnings}</p> : null}<p className="mt-2 text-xs text-muted-foreground">Started {formatDate(item.starts_on)} · {item.refills_remaining} refill(s) remaining</p></div>{canEdit && item.status === "active" ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => prescriptionStatusMutation.mutate({ id: item.id, status: "completed" })}>Complete</Button><Button size="sm" variant="destructive" onClick={() => prescriptionStatusMutation.mutate({ id: item.id, status: "discontinued" })}>Discontinue</Button></div> : null}</CardContent></Card>)}</div>}</TabsContent>

          <TabsContent value="laboratory" className="space-y-4">{canEdit ? <div className="flex justify-end"><LabOrderDialog onCreate={(input) => labMutation.mutateAsync(input)} /></div> : null}{data.labOrders.length === 0 ? <EmptySection message="No laboratory orders yet." /> : <div className="space-y-4">{data.labOrders.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold"><FlaskConical className="mr-2 inline h-4 w-4 text-primary" />{item.test_name}</h3><Badge variant={statusVariant(item.status)}>{item.status}</Badge>{item.is_abnormal ? <Badge variant="destructive">abnormal</Badge> : null}</div><p className="mt-2 text-sm text-muted-foreground">{item.category} · {item.laboratory_type} laboratory</p>{item.result_text || item.result_numeric !== null ? <p className="mt-3 whitespace-pre-wrap text-sm"><strong>Result:</strong> {item.result_numeric !== null ? `${item.result_numeric} ${item.result_unit ?? ""}` : item.result_text}</p> : null}{item.reference_range ? <p className="mt-1 text-xs text-muted-foreground">Reference: {item.reference_range}</p> : null}</div>{canEdit ? <div className="flex flex-wrap gap-2">{item.status === "ordered" ? <Button size="sm" variant="outline" onClick={async () => { await updateLabOrder(item.id, { status: "collected", sample_collected_at: new Date().toISOString() }); await refreshRecord(); }}>Mark collected</Button> : null}{item.status === "collected" ? <Button size="sm" variant="outline" onClick={async () => { await updateLabOrder(item.id, { status: "processing" }); await refreshRecord(); }}>Start processing</Button> : null}{item.status !== "cancelled" ? <Button size="sm" onClick={() => openLabResult(item)}>Enter result</Button> : null}</div> : null}</CardContent></Card>)}</div>}</TabsContent>

          <TabsContent value="documents" className="space-y-4">{canEdit ? <div className="flex justify-end"><DocumentUploadDialog onUpload={(file, input) => uploadMutation.mutateAsync({ file, input })} /></div> : null}{data.documents.length === 0 ? <EmptySection message="No private clinical documents have been uploaded." /> : <div className="grid gap-4 md:grid-cols-2">{data.documents.map((document) => <Card key={document.id}><CardContent className="flex items-start justify-between gap-4 p-5"><div><FileText className="mb-3 h-6 w-6 text-primary" /><h3 className="break-all font-semibold">{document.display_name}</h3><p className="mt-1 text-xs text-muted-foreground">{document.document_type.replaceAll("_", " ")} · {(document.size_bytes / 1024).toFixed(0)} KB</p>{document.client_visible ? <Badge className="mt-2" variant="outline">Owner-visible</Badge> : null}</div>{document.signed_url ? <Button size="icon" variant="outline" asChild><a href={document.signed_url} target="_blank" rel="noreferrer" aria-label={`Open ${document.display_name}`}><ExternalLink className="h-4 w-4" /></a></Button> : null}</CardContent></Card>)}</div>}</TabsContent>
        </Tabs>

        <Dialog open={Boolean(resultLab)} onOpenChange={(open) => { if (!open) setResultLab(null); }}><DialogContent><DialogHeader><DialogTitle>Enter and review laboratory result</DialogTitle></DialogHeader><form onSubmit={saveLabResult} className="space-y-4"><div className="space-y-2"><Label>Result notes</Label><Textarea value={labResult.text} onChange={(e) => setLabResult({ ...labResult, text: e.target.value })} /></div><div className="grid grid-cols-3 gap-3"><div className="space-y-2"><Label>Numeric</Label><Input type="number" step="any" value={labResult.numeric} onChange={(e) => setLabResult({ ...labResult, numeric: e.target.value })} /></div><div className="space-y-2"><Label>Unit</Label><Input value={labResult.unit} onChange={(e) => setLabResult({ ...labResult, unit: e.target.value })} /></div><div className="space-y-2"><Label>Reference</Label><Input value={labResult.range} onChange={(e) => setLabResult({ ...labResult, range: e.target.value })} /></div></div><label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={labResult.abnormal} onChange={(e) => setLabResult({ ...labResult, abnormal: e.target.checked })} />Flag as abnormal</label><DialogFooter><Button type="submit">Save reviewed result</Button></DialogFooter></form></DialogContent></Dialog>
      </main>
    </Shell>
  );
}
