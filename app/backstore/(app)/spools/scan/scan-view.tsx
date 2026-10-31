"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { QrScanner } from "@/components/backstore/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findSpool } from "../actions";

/** Scan a spool's QR label (camera, or a USB scanner typing into the box) to open its weigh page. */
export function ScanView() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function go(value: string) {
    if (!value.trim()) return;
    startTransition(async () => {
      const res = await findSpool(value);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/backstore/spools/${res.data}`);
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/spools">
          <ArrowLeft /> Spools
        </Link>
      </Button>
      <PageHeader title="Scan & weigh" description="Point the camera at a spool's QR label, then weigh it." />
      <QrScanner onScan={go} paused={pending} />
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go(text);
        }}
      >
        {/* USB / Bluetooth scanners type the code and press Enter, so this box keeps focus. */}
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Serial, e.g. SP-261031-001"
          aria-label="Spool serial"
          className="font-mono"
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          <ScanLine /> Open
        </Button>
      </form>
    </div>
  );
}
