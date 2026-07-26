import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Shell } from "@/components/layout/Shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader as Loader2, Save } from "lucide-react"
import { getClinic, updateClinic } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

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

  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

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
      </div>
    </Shell>
  )
}
