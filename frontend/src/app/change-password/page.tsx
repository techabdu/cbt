"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/auth.service";
import { changePasswordSchema } from "@/lib/validators";
import { ROLE_HOME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      await authService.changePassword({
        current_password:       data.current_password,
        new_password:           data.new_password,
        new_password_confirmation: data.new_password_confirmation,
      });

      if (user) {
        updateUser({ ...user, force_password_change: false });
        toast.success("Password changed successfully. Welcome!");
        router.push(ROLE_HOME[user.role]);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const fieldErrors = axiosErr.response?.data?.errors;
      if (fieldErrors?.current_password) {
        setError("current_password", { message: fieldErrors.current_password[0] });
      } else if (fieldErrors?.new_password) {
        setError("new_password", { message: fieldErrors.new_password[0] });
      } else {
        toast.error(axiosErr.response?.data?.message ?? "Failed to change password. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Change Your Password</CardTitle>
          <CardDescription>
            You must set a new password before accessing the portal. Use at least 8 characters.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-xs text-slate-500 mb-4">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="current_password">
                Current Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                {...register("current_password")}
              />
              {errors.current_password && (
                <p className="text-sm text-red-600">! {errors.current_password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password">
                New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                {...register("new_password")}
              />
              {errors.new_password && (
                <p className="text-sm text-red-600">! {errors.new_password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password_confirmation">
                Confirm New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new_password_confirmation"
                type="password"
                autoComplete="new-password"
                {...register("new_password_confirmation")}
              />
              {errors.new_password_confirmation && (
                <p className="text-sm text-red-600">! {errors.new_password_confirmation.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving…" : "Set New Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
