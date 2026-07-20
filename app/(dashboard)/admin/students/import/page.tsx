"use client"

import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { downloadBlob } from "@/lib/download"
import { getAdminNav } from "@/lib/admin-nav"
import { downloadImportTemplate, importStudents } from "@/services/student"

export default function ImportStudentsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: string[]; errors: string[] } | null>(null)

  async function handleDownloadTemplate() {
    try {
      const blob = await downloadImportTemplate()
      downloadBlob(blob, "students_import_template.csv")
    } catch {
      toast.error("Failed to download template")
    }
  }

  async function handleImport(file: File) {
    setLoading(true)
    try {
      const data = await importStudents(file)
      setResult(data)
      toast.success(`Imported ${data.count} students`)
    } catch {
      toast.error("Import failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardShell title="Import Students" navItems={getAdminNav(false)} allowedRoles={["institution_admin"]}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Student Import</CardTitle>
            <CardDescription>
              Upload a CSV file with columns: registration_no, full_name, email, parent_name, parent_phone, parent_email
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="size-4" />
              Download Template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
              }}
            />
            <Button disabled={loading} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              {loading ? "Importing..." : "Upload CSV"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">Created ({result.created.length})</p>
                <ul className="text-muted-foreground list-disc pl-5 text-sm">
                  {result.created.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <p className="font-medium text-red-600">Errors</p>
                  <ul className="text-muted-foreground list-disc pl-5 text-sm">
                    {result.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
