import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Shell } from "@/components/layout/Shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader as Loader2, Save, Download, FileSpreadsheet, FileArchive, Mail } from "lucide-react"
import { getClinic, updateClinic, getClinicExportData, updateNotificationSettings, sendTestEmail } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { exportToCSV, exportToExcel, downloadBlob, generateBackupFilename } from "@/lib/export"

export default function ClinicSettings() {
  const { staff } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const clinicId = staff?.clinic_id ?? 0

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: () => getClinic(clinicId),
    enabled: clinicId > 0,
  })

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    working_hours: "",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    appointment_reminders_enabled: true,
    recall_reminders_enabled: true,
    appointment_reminder_hours_before: 24,
    recall_reminder_days_before: 7,
    email_sender_name: "VetDesk",
    reply_to_email: "",
  })

  const [testEmail, setTestEmail] = useState("")
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)

  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | null>(null)

  const handleLogoUpload = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file = event.target.files?.[0]

  if (!file) return

  if (!file.type.startsWith("image/")) {
    toast({
      title: "Invalid file",
      description: "Please select an image.",
      variant: "destructive",
    })
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast({
      title: "Image is too large",
      description: "Maximum logo size is 5 MB.",
      variant: "destructive",
    })
    return
  }

  try {
    setIsUploadingLogo(true)

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "png"

    const filePath = `clinics/${clinicId}/logo-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from("clinic-assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage
      .from("clinic-assets")
      .getPublicUrl(filePath)

    await updateClinic(clinicId, {
      logo_url: publicUrlData.publicUrl,
    })

    await queryClient.invalidateQueries({
      queryKey: ["clinic", clinicId],
    })

    toast({
      title: "Clinic logo updated",
    })

    event.target.value = ""
  } catch (error: any) {
    toast({
      title: "Logo upload failed",
      description: error?.message || "Please try again.",
      variant: "destructive",
    })
  } finally {
    setIsUploadingLogo(false)
  }
}

  useEffect(() => {
    if (!clinic) return

    setFormData({
      name: clinic.name || "",
      phone: clinic.phone || "",
      email: clinic.email || "",
      address: clinic.address || "",
      website: clinic.website || "",
      working_hours: clinic.working_hours || "",
    })

    setNotificationSettings({
      appointment_reminders_enabled: clinic.appointment_reminders_enabled ?? true,
      recall_reminders_enabled: clinic.recall_reminders_enabled ?? true,
      appointment_reminder_hours_before: clinic.appointment_reminder_hours_before ?? 24,
      recall_reminder_days_before: clinic.recall_reminder_days_before ?? 7,
      email_sender_name: clinic.email_sender_name || "VetDesk",
      reply_to_email: clinic.reply_to_email || "",
    })
  }, [clinic])

  const updateMutation = useMutation({
    mutationFn: () =>
      updateClinic(clinicId, {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        website: formData.website.trim() || null,
        working_hours: formData.working_hours.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clinic", clinicId],
      })

      toast({
        title: "Clinic settings saved",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save clinic settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleExport = async (format: "csv" | "excel") => {
    setIsExporting(true)
    setExportFormat(format)

    try {
      const exportData = await getClinicExportData(clinicId)

      let blob: Blob
      let filename: string

      if (format === "csv") {
        blob = await exportToCSV(exportData)
        filename = generateBackupFilename("zip")
      } else {
        blob = exportToExcel(exportData)
        filename = generateBackupFilename("xlsx")
      }

      downloadBlob(blob, filename)

      toast({
        title: "Backup exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  const notificationSettingsMutation = useMutation({
    mutationFn: () =>
      updateNotificationSettings(clinicId, notificationSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clinic", clinicId],
      })
      toast({
        title: "Notification settings saved",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save notification settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    },
  })

  const sendTestEmailMutation = useMutation({
    mutationFn: () => sendTestEmail(clinicId, testEmail || undefined),
    onSuccess: (data) => {
      toast({
        title: data.success ? "Test email sent successfully" : "Failed to send test email",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      })
      setTestEmail("")
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send test email",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    },
  })

  if (!clinicId) {
    return (
      <Shell>
        <div className="p-8 text-center text-muted-foreground">
          Clinic information is not available for this account.
        </div>
      </Shell>
    )
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Clinic Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Update your clinic information and contact details.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clinic Information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-5 border-b">
  <div className="w-24 h-24 rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center shrink-0">
    {clinic?.logo_url ? (
      <img
        src={clinic.logo_url}
        alt={`${clinic.name} logo`}
        className="w-full h-full object-cover"
      />
    ) : (
      <span className="text-sm text-muted-foreground text-center px-2">
        No logo
      </span>
    )}
  </div>

  <div className="space-y-2">
    <Label htmlFor="clinic-logo">Clinic Logo</Label>

    <label
      htmlFor="clinic-logo"
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 border bg-background hover:bg-accent cursor-pointer ${
        isUploadingLogo ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {isUploadingLogo ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Uploading...
        </>
      ) : (
        "Upload Logo"
      )}
    </label>

    <input
      id="clinic-logo"
      type="file"
      accept="image/*"
      className="hidden"
      disabled={isUploadingLogo}
      onChange={handleLogoUpload}
    />

    <p className="text-xs text-muted-foreground">
      PNG, JPG or WEBP. Maximum size 5 MB.
    </p>
  </div>
</div>
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Clinic Name</Label>
              <Input
                id="clinic-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    name: event.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">Phone</Label>
                <Input
                  id="clinic-phone"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      phone: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-email">Email</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      email: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-address">Address</Label>
              <Input
                id="clinic-address"
                value={formData.address}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    address: event.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-website">Website</Label>
              <Input
                id="clinic-website"
                value={formData.website}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    website: event.target.value,
                  })
                }
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-hours">Working Hours</Label>
              <Textarea
                id="clinic-hours"
                value={formData.working_hours}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    working_hours: event.target.value,
                  })
                }
                placeholder="Monday-Friday: 08:00-18:00"
                className="min-h-28"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={
                  updateMutation.isPending ||
                  !formData.name.trim()
                }
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Backup & Export</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export all your clinic data including owners, pets, appointments, visits, recalls, and staff. 
              Data is exported only for your clinic and includes relationship information for easy reference.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleExport("csv")}
                disabled={isExporting}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                {isExporting && exportFormat === "csv" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileArchive className="w-4 h-4 mr-2" />
                    Export to CSV
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleExport("excel")}
                disabled={isExporting}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                {isExporting && exportFormat === "excel" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export to Excel
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>CSV Export:</strong> Generates separate CSV files bundled in a ZIP archive</p>
              <p>• <strong>Excel Export:</strong> Generates a single workbook with separate worksheets</p>
              <p>• Both formats include Owner Name with Pets, Pet Name with appointments/recalls</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send automatic email reminders before appointments
                </p>
              </div>
              <Switch
                id="appointment-reminders"
                checked={notificationSettings.appointment_reminders_enabled}
                onCheckedChange={(checked) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    appointment_reminders_enabled: checked,
                  })
                }
              />
            </div>

            {notificationSettings.appointment_reminders_enabled && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <Label htmlFor="appointment-hours">Hours Before Appointment</Label>
                <Input
                  id="appointment-hours"
                  type="number"
                  min="1"
                  max="168"
                  value={notificationSettings.appointment_reminder_hours_before}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      appointment_reminder_hours_before: parseInt(e.target.value) || 24,
                    })
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Send reminder this many hours before the appointment (default: 24)
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="recall-reminders">Vaccine/Recall Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send automatic email reminders for due vaccines and recalls
                </p>
              </div>
              <Switch
                id="recall-reminders"
                checked={notificationSettings.recall_reminders_enabled}
                onCheckedChange={(checked) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    recall_reminders_enabled: checked,
                  })
                }
              />
            </div>

            {notificationSettings.recall_reminders_enabled && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <Label htmlFor="recall-days">Days Before Due Date</Label>
                <Input
                  id="recall-days"
                  type="number"
                  min="1"
                  max="30"
                  value={notificationSettings.recall_reminder_days_before}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      recall_reminder_days_before: parseInt(e.target.value) || 7,
                    })
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Send reminder this many days before due date (default: 7)
                </p>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="sender-name">Email Sender Name</Label>
                <Input
                  id="sender-name"
                  value={notificationSettings.email_sender_name}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      email_sender_name: e.target.value,
                    })
                  }
                  placeholder="VetDesk"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply-to">Reply-To Email (Optional)</Label>
                <Input
                  id="reply-to"
                  type="email"
                  value={notificationSettings.reply_to_email}
                  onChange={(e) =>
                    setNotificationSettings({
                      ...notificationSettings,
                      reply_to_email: e.target.value,
                    })
                  }
                  placeholder="clinic@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Recipients can reply to this address instead of the sender
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => notificationSettingsMutation.mutate()}
                disabled={notificationSettingsMutation.isPending}
              >
                {notificationSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Notification Settings
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Send Test Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com (optional, uses clinic email if empty)"
                    className="flex-1"
                    disabled={sendTestEmailMutation.isPending}
                  />
                  <Button
                    onClick={() => {
                      if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
                        toast({
                          title: "Invalid email format",
                          description: "Please enter a valid email address",
                          variant: "destructive",
                        })
                        return
                      }
                      sendTestEmailMutation.mutate()
                    }}
                    disabled={sendTestEmailMutation.isPending}
                    variant="outline"
                  >
                    {sendTestEmailMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send a test email to verify your email configuration is working correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  )
}
