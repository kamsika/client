"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AttendanceSummaryStats } from "@/components/attendance-summary-stats"
import { StudentAttendanceHistoryDialog } from "@/components/student-attendance-history-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatLocalTime, localTodayISO } from "@/lib/format-time"
import { getClassroomAttendance, markAttendance } from "@/services/attendance"
import type { AttendanceRecord, AttendanceSummary } from "@/types"

interface AttendanceDayPanelProps {
  classroomId: number
  date: string
  /** Teachers can mark absent students Present for today. */
  allowMarkPresent?: boolean
  /** Bump to force a reload (e.g. after a QR scan). */
  refreshToken?: number
}

export function AttendanceDayPanel({
  classroomId,
  date,
  allowMarkPresent = false,
  refreshToken = 0,
}: AttendanceDayPanelProps) {
  const [loading, setLoading] = useState(true)
  const [present, setPresent] = useState<AttendanceRecord[]>([])
  const [absent, setAbsent] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [historyStudentId, setHistoryStudentId] = useState<number | null>(null)
  const [historyStudentLabel, setHistoryStudentLabel] = useState<string | null>(null)

  const isToday = date === localTodayISO()
  const canMark = allowMarkPresent && isToday

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getClassroomAttendance(classroomId, date)
      setPresent(data.present ?? [])
      setAbsent(data.absent ?? [])
      setSummary(data.summary)
    } catch {
      toast.error("Failed to load attendance roster")
      setPresent([])
      setAbsent([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [classroomId, date])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  useEffect(() => {
    if (!isToday) return
    const interval = setInterval(() => {
      void load()
    }, 8000)
    return () => clearInterval(interval)
  }, [isToday, load])

  async function handleMarkPresent(studentId: number) {
    if (!canMark) {
      toast.error("Marking Present is only available for today's date.")
      return
    }
    setMarkingId(studentId)
    try {
      await markAttendance(studentId, classroomId, "Present")
      toast.success("Marked Present")
      await load()
    } catch {
      toast.error("Failed to mark student Present")
    } finally {
      setMarkingId(null)
    }
  }

  function openHistory(studentId: number, label: string | null | undefined) {
    setHistoryStudentId(studentId)
    setHistoryStudentLabel(label || null)
  }

  return (
    <div className="space-y-4">
      <AttendanceSummaryStats summary={summary} />

      {loading && !summary ? (
        <p className="text-muted-foreground text-sm">Loading roster...</p>
      ) : (
        <Tabs defaultValue="present">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="present">
              Present ({summary?.total_present ?? present.length})
            </TabsTrigger>
            <TabsTrigger value="absent">
              Absent ({summary?.total_absent ?? absent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="present" className="mt-3">
            {present.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No students marked Present for this date yet.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {present.map(({ student, attendance }) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-left underline-offset-4 hover:underline"
                            onClick={() => openHistory(student.id, student.full_name)}
                          >
                            {student.full_name || "Student"}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {student.registration_no || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={attendance?.status === "Late" ? "destructive" : "default"}
                          >
                            {attendance?.status || "Present"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLocalTime(attendance?.arrival_time)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="absent" className="mt-3">
            {absent.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Everyone on the roster is Present for this date.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      {canMark ? <TableHead className="text-right">Action</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absent.map(({ student }) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-left underline-offset-4 hover:underline"
                            onClick={() => openHistory(student.id, student.full_name)}
                          >
                            {student.full_name || "Student"}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {student.registration_no || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Absent</Badge>
                        </TableCell>
                        {canMark ? (
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={markingId === student.id}
                              onClick={() => void handleMarkPresent(student.id)}
                            >
                              {markingId === student.id ? "Saving..." : "Mark Present"}
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {allowMarkPresent && !isToday && (
              <p className="text-muted-foreground mt-2 text-xs">
                Switch to today to manually mark absent students Present.
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}

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
