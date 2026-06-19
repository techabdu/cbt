"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, WifiOff } from "lucide-react";

import { studentLoginSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { z } from "zod";

type StudentLoginForm = z.infer<typeof studentLoginSchema>;

export default function StudentExamLoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentLoginForm>({
    resolver: zodResolver(studentLoginSchema),
  });

  const onSubmit = async (_data: StudentLoginForm) => {
    // Phase 8 — student exam login will be implemented here
    await new Promise((r) => setTimeout(r, 500));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4">
      <div className="mb-8 text-center">
        <WifiOff className="h-8 w-8 text-slate-500 mx-auto mb-2" aria-hidden="true" />
        <p className="text-xs text-slate-500 uppercase tracking-widest">Offline CBT Centre</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Student Exam Login</CardTitle>
          <CardDescription>Enter your matric number and the exam code provided by your invigilator.</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-xs text-slate-500 mb-4">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="matric_number">
                Matric Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="matric_number"
                type="text"
                autoComplete="off"
                placeholder="e.g. NCE/2021/0001"
                {...register("matric_number")}
              />
              {errors.matric_number && (
                <p className="text-sm text-red-600">! {errors.matric_number.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam_code">
                Exam Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="exam_code"
                type="text"
                autoComplete="off"
                placeholder="8-character code"
                className="tracking-widest uppercase"
                {...register("exam_code")}
              />
              {errors.exam_code && (
                <p className="text-sm text-red-600">! {errors.exam_code.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Starting exam…" : "Start Exam"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-slate-600">
        Full exam interface available in Phase 8.
      </p>
    </div>
  );
}
