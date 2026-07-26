"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  LayoutGrid,
  Menu,
  QrCode,
  Users,
  X,
} from "lucide-react"

const NAV = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#modules", label: "Modules" },
  { href: "#get-started", label: "Get Started" },
] as const

/** Core Student Management System capabilities only. */
const FEATURES = [
  {
    icon: Users,
    title: "Student Management",
    body: "Register students, manage profiles, grades, enrolled subjects, and classroom assignment in one place.",
  },
  {
    icon: QrCode,
    title: "QR Code Attendance",
    body: "Teachers scan student QR codes to mark Present for the correct subject based on today’s timetable.",
  },
  {
    icon: ClipboardCheck,
    title: "Face & Manual Attendance",
    body: "Face kiosk recognition and manual roster marking for classrooms when QR scanning is not practical.",
  },
  {
    icon: LayoutGrid,
    title: "Classroom Management",
    body: "Create classrooms, assign teachers, and keep attendance records scoped to each class and subject.",
  },
  {
    icon: BookOpen,
    title: "Timetable Tracking",
    body: "Match scans to active timetable slots, continuous classes, and enrolled subjects automatically.",
  },
  {
    icon: Bell,
    title: "Parent Communication",
    body: "Send late and absent alerts so parents stay informed about attendance without manual calls.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    body: "View attendance history, daily summaries, and exportable reports for students and classrooms.",
  },
] as const

const MODULES = [
  {
    role: "Institution Admin",
    items: ["Student registration & imports", "Classroom setup", "Staff accounts", "Attendance reports"],
  },
  {
    role: "Teacher",
    items: ["QR & face attendance", "Manual marking", "Timetable", "Student subject enrollment"],
  },
  {
    role: "Student / Parent",
    items: ["Student portal access", "Attendance visibility", "Parent alerts", "Study tracking"],
  },
] as const

export function LandingPage() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-[#05082E] antialiased">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || open
            ? "border-b border-[#00AAE4]/15 bg-[#05082E]/95 shadow-lg shadow-[#05082E]/20 backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#home" className="flex items-center gap-2.5">
            <span className="flex size-10 overflow-hidden rounded-xl bg-white shadow-[0_0_16px_rgba(0,170,228,0.3)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ahms-logo.png" alt="AHMS" className="size-10 object-cover" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight text-white">AHMS</p>
              <p className="hidden text-[10px] font-medium text-sky-200/70 sm:block">
                Student Management System
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-white/85 transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/auth/register"
              className="inline-flex h-9 items-center rounded-md bg-[#F9BF15] px-4 text-sm font-semibold text-[#05082E] transition hover:bg-[#E88D1D] hover:text-white"
            >
              Register Student
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-9 items-center rounded-md border border-white/70 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Login
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center text-white md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open ? (
          <div className="border-t border-white/10 bg-[#05082E] px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-white"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
              <Link
                href="/auth/register"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#F9BF15] text-sm font-semibold text-[#05082E]"
                onClick={() => setOpen(false)}
              >
                Register
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/60 text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* Hero — SMS purpose only */}
      <section
        id="home"
        className="relative isolate overflow-hidden bg-[#05082E] px-4 pb-20 pt-28 text-white sm:px-6 sm:pb-24 sm:pt-32"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-24 right-0 size-[26rem] rounded-full bg-[#00AAE4]/18 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(0,170,228,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(0,170,228,0.4)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#F9BF15] uppercase">
            Student Management System
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Manage students, classrooms, and attendance in one system
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-sky-100/75 sm:text-lg">
            AHMS is a Student Management System for tuition centers — covering student records,
            classroom setup, QR and face attendance, parent alerts, timetables, and attendance
            reports.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#F9BF15] px-5 text-sm font-semibold text-[#05082E] transition hover:bg-[#E88D1D] hover:text-white"
            >
              Login to Dashboard
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
            >
              View SMS Features
            </a>
          </div>
        </div>
      </section>

      {/* Core SMS features */}
      <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-[0.14em] text-[#00AAE4] uppercase">
              Core Features
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#05082E]">
              Everything a Student Management System needs
            </h2>
            <p className="mt-3 text-base text-[#0047AB]/80">
              Focused tools for students, attendance, classrooms, communication, and reporting —
              nothing unrelated to school operations.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-[#00AAE4]/15 bg-white p-5 shadow-sm transition hover:border-[#00AAE4]/35"
              >
                <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-[#0047AB]/10 text-[#0047AB]">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="text-base font-semibold text-[#05082E]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#0047AB]/80">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Role modules */}
      <section
        id="modules"
        className="scroll-mt-24 border-y border-[#00AAE4]/10 bg-white px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-[0.14em] text-[#E88D1D] uppercase">
              System Modules
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#05082E]">
              Role-based access for your center
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {MODULES.map((mod) => (
              <div
                key={mod.role}
                className="rounded-2xl border border-[#00AAE4]/15 bg-[#f4f7fb] p-5"
              >
                <h3 className="text-base font-semibold text-[#05082E]">{mod.role}</h3>
                <ul className="mt-4 space-y-2.5">
                  {mod.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-[#0047AB]/90">
                      <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-[#00AAE4]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get started — no vanity stats */}
      <section id="get-started" className="scroll-mt-24 bg-[#05082E] px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Start managing students and attendance
          </h2>
          <p className="mt-3 text-sky-100/70">
            Log in as admin or teacher to manage classrooms, mark QR attendance, review reports, and
            keep parents informed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center rounded-md bg-[#F9BF15] px-5 text-sm font-semibold text-[#05082E] hover:bg-[#E88D1D] hover:text-white"
            >
              Register Student
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Login
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#03051c] py-5 text-center text-xs text-sky-200/45">
        © {new Date().getFullYear()} AHMS · Student Management System
      </footer>
    </div>
  )
}
