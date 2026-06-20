"use client";

import * as React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TempPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileNumber?: string;
  password: string | null;
}

/**
 * Shown once after creating an account or resetting a password. The temp
 * password is never retrievable again, so the admin must copy it now.
 */
export function TempPasswordDialog({ open, onOpenChange, fileNumber, password }: TempPasswordDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            Temporary Password
          </DialogTitle>
          <DialogDescription>
            Share this one-time password with {fileNumber ? <span className="font-medium">{fileNumber}</span> : "the user"}.
            They will be required to change it on first login. <strong>This password will not be shown again.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <code className="flex-1 select-all font-mono text-lg tracking-wide text-slate-900 dark:text-slate-100">
            {password}
          </code>
          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy password">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
