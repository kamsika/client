"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AttendanceDatePicker } from "@/components/attendance-date-picker"
import { StudentAttendanceHistoryDialog } from "@/components/student-attendance-history-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { downloadBlob } from "@/lib/download"
import { localTodayISO } from "@/lib/format-time"
import { selectItems } from "@/lib/select-items"
import {
  exportAttendanceReportCsv,
  exportAttendanceReportPdf,
  getAttendanceReport,
} from "@/services/attendance"
import { listClassrooms } from "@/services/classroom"
import type { AttendanceReportResponse, Classroom } from "@/types"

function defaultStartDate() {
  const today = localTodayISO()
  const [year, month] = today.split("-")
  return `${year}-${month}-01`
}

export function AttendanceReportsPanel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState("")
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(localTodayISO)
  const [report, setReport] = useState<AttendanceReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)
  const [historyStudentId, setHistoryStudentId] = useState<number | null>(null)
  const [historyStudentLabel, setHistoryStudentLabel] = useState<string | null>(null)

  const classroomId = selectedClassroomId ? Number(selectedClassroomId) : null

  useEffect(() => {
    listClassrooms()
      .then((items) => {
        setClassrooms(items)
        if (items.length > 0) {
          setSelectedClassroomId(String(items[0].id))
        }
      })
      .catch(() => toast.error("Failed to load classrooms"))
  }, [])

  const loadReport = useCallback(async () => {
    if (!classroomId) return
    if (startDate > endDate) {
      toast.error("Start date must be on or before end date")
      return
    }

    setLoading(true)
    try {
      const data = await getAttendanceReport({
        classroomId,
        startDate,
        endDate,
      })
      setReport(data)
    } catch {
      toast.error("Failed to load attendance report")
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [classroomId, startDate, endDate])

  useEffect(() => {
    if (!classroomId) return
    void loadReport()
  }, [classroomId, loadReport])

  async function handleExport(format: "csv" | "pdf") {
    if (!classroomId) return
    if (startDate > endDate) {
      toast.error("Start date must be on or before end date")
      return
    }

    setExporting(format)
    try {
      const params = { classroomId, startDate, endDate }
      if (format === "csv") {
        const blob = await exportAttendanceReportCsv(params)
        downloadBlob(blob, `attendance_summary_${classroomId}_${startDate}_${endDate}.csv`)
        toast.success("CSV / Excel file downloaded")
      } else {
        const blob = await exportAttendanceReportPdf(params)
        downloadBlob(blob, `attendance_summary_${classroomId}_${startDate}_${endDate}.pdf`)
        toast.success("PDF downloaded")
      }
    } catch {
      toast.error(format === "csv" ? "Failed to export CSV" : "Failed to export PDF")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Reports</CardTitle>
          <CardDescription>
            Filter by date range and classroom / batch, then export a summary as CSV (Excel) or PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AttendanceDatePicker
            id="report-start-date"
            label="Start Date"
            value={startDate}
            onChange={(next) => {
              setStartDate(next)
              if (next > endDate) setEndDate(next)
            }}
          />
          <AttendanceDatePicker
            id="report-end-date"
            label="End Date"
            value={endDate}
            onChange={(next) => {
              setEndDate(next)
              if (next < startDate) setStartDate(next)
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="report-classroom">Classroom / Batch</Label>
            <Select
              value={selectedClassroomId}
              onValueChange={(value) => value && setSelectedClassroomId(value)}
              items={selectItems(
                classrooms.map((cls) => ({
                  value: cls.id,
                  label: cls.name,
                })),
              )}
            >
              <SelectTrigger id="report-classroom" className="w-full">
                <SelectValue placeholder="Select classroom" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((cls) => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!classroomId || exporting !== null}
                onClick={() => void handleExport("csv")}
              >
                {exporting === "csv" ? "Exporting..." : "Export CSV / Excel"}
              </Button>
              <Button
                type="button"
                disabled={!classroomId || exporting !== null}
                onClick={() => void handleExport("pdf")}
              >
                {exporting === "pdf" ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            {report
              ? `${report.start_date} → ${report.end_date} · ${report.classroom.name} · ${report.total_classes_held} classes held`
              : "Select filters to generate a report"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!classroomId ? (
            <p className="text-muted-foreground text-sm">
              {classrooms.length === 0
                ? "No classrooms found. Create a classroom to generate reports."
                : "Select a classroom / batch to view the report."}
            </p>
          ) : loading && !report ? (
            <p className="text-muted-foreground text-sm">Loading report...</p>
          ) : !report ? (
            <p className="text-muted-foreground text-sm">Unable to load report.</p>
          ) : report.students.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No active students found for this center.
            </p>
          ) : (
            <div className="space-y-3">
              {report.total_classes_held === 0 && (
                <p className="text-muted-foreground text-sm">
                  No attendance sessions recorded in this date range yet. Percentages will appear
                  once classes are marked.
                </p>
              )}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="text-right">Total Present</TableHead>
                      <TableHead className="text-right">Total Absent</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium underline-offset-4 hover:underline"
                            onClick={() => {
                              setHistoryStudentId(row.student_id)
                              setHistoryStudentLabel(row.student_name)
                            }}
                          >
                            {row.student_name || "Student"}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.registration_no || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_present}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_absent}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <StudentAttendanceHistoryDialog
        studentId={historyStudentId}
        studentLabel={historyStudentLabel}
        classroomId={classroomId}
        open={historyStudentId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setHistoryStudentId(null)
            setHistoryStudentLabel(null)
          }
        }}
      />
    </div>
  )
}
