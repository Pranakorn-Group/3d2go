"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ScanLine } from "lucide-react";
import { OpenSpoolDialog, type BoxLabel } from "@/components/backstore/open-spool-dialog";
import { PageHeader } from "@/components/backstore/page-header";
import { QrScanner } from "@/components/backstore/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductDTO, SpoolSpecDTO } from "@/lib/types";
import { resolveScan } from "../actions";

/**
 * Scan a spool's QR label (camera, or a USB scanner typing into the box) to open its weigh page — or a
 * roll's box label from stock to open that roll as a new spool.
 */
export function ScanView({ products, specs }: { products: ProductDTO[]; specs: Record<string, SpoolSpecDTO> }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [box, setBox] = useState<BoxLabel | null>(null);
  const [pending, startTransition] = useTransition();

  function go(value: string) {
    if (!value.trim() || box) return;
    startTransition(async () => {
      const res = await resolveScan(value);
      if (!res.ok) return void toast.error(res.error);
      setText("");
      if (res.data.kind === "spool") router.push(`/backstore/spools/${res.data.serial}`);
      else setBox({ serial: res.data.serial, productId: res.data.productId });
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/spools">
          <ArrowLeft /> Spools
        </Link>
      </Button>
      <PageHeader title="Scan & weigh" description="Point the camera at a spool's QR label to weigh it — or at a roll's box label to open it as a new spool." />
      <QrScanner onScan={go} paused={pending || !!box} />
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
          placeholder="Spool or box serial, e.g. SP48217"
          aria-label="Spool or box label serial"
          className="font-mono"
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          <ScanLine /> Open
        </Button>
      </form>
      <OpenSpoolDialog products={products} specs={specs} label={box} open={!!box} onOpenChange={(o) => !o && setBox(null)} />
    </div>
  );
}
