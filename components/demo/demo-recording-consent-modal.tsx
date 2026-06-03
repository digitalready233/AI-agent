"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  message: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function DemoRecordingConsentModal({
  open,
  message,
  busy,
  onAccept,
  onDecline,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recording consent</DialogTitle>
          <DialogDescription className="text-left pt-2">{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onDecline}>
            Decline
          </Button>
          <Button type="button" disabled={busy} onClick={onAccept}>
            Accept and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
