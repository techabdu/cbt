"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { collegeService } from "@/services/college.service";
import { collegeSchema, type CollegeInput } from "@/lib/validators";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CollegeSettingsPage() {
  const queryClient = useQueryClient();
  const { data: college, isLoading } = useQuery({
    queryKey: ["college"],
    queryFn: collegeService.get,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CollegeInput>({
    resolver: zodResolver(collegeSchema),
    values: college
      ? {
          name: college.name ?? "",
          contact_email: college.contact_email ?? "",
          contact_phone: college.contact_phone ?? "",
          address: college.address ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: CollegeInput) =>
      collegeService.update({
        name: data.name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        address: data.address || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["college"], updated);
      reset({
        name: updated.name ?? "",
        contact_email: updated.contact_email ?? "",
        contact_phone: updated.contact_phone ?? "",
        address: updated.address ?? "",
      });
      toast.success("College settings saved");
    },
    onError: () => toast.error("Failed to save — please try again"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="College Settings" description="Manage the institution's identity and contact information." />

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4 max-w-xl">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate className="max-w-xl space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  College Name <span className="text-red-500">*</span>
                </Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input id="contact_email" type="email" {...register("contact_email")} />
                  {errors.contact_email && <p className="text-sm text-red-600">! {errors.contact_email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input id="contact_phone" {...register("contact_phone")} />
                  {errors.contact_phone && <p className="text-sm text-red-600">! {errors.contact_phone.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" rows={3} {...register("address")} />
                {errors.address && <p className="text-sm text-red-600">! {errors.address.message}</p>}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={mutation.isPending || !isDirty}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
