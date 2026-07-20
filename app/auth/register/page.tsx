"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStoredUser } from "@/lib/api-client"
import { registerUser } from "@/services/auth"
import type { User } from "@/types"

const schema = z.object({
  role: z.enum(["teacher", "parent"]),
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone_number: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "teacher",
      full_name: "",
      email: "",
      password: "",
      phone_number: "",
    },
  })

  async function onSubmit(values: FormData) {
    const admin = getStoredUser<User>()
    if (!admin || !["institution_admin", "super_admin"].includes(admin.role)) {
      toast.error("Only institution admins can register users. Please login as admin first.")
      router.push("/auth/login")
      return
    }

    try {
      await registerUser(values)
      toast.success(`${values.role} registered successfully`)
      form.reset({ role: values.role, full_name: "", email: "", password: "", phone_number: "" })
    } catch {
      toast.error("Registration failed")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register User</CardTitle>
          <CardDescription>
            Institution admins can create teachers and parents. Students are imported via CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) => form.setValue("role", value as FormData["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...form.register("full_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input id="phone_number" {...form.register("phone_number")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...form.register("password")} />
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              Register
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link href="/auth/login" className="text-primary underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
