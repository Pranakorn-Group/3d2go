import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { LEND_MARKUP } from "@/lib/spool";
import { getSpoolSpecs } from "@/lib/spools";
import { SpecsView } from "./specs-view";

export const metadata: Metadata = { title: "Reel weights & prices" };

export default async function SpecsPage() {
  const specs = Object.values(await getSpoolSpecs());
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/spools">
          <ArrowLeft /> Spools
        </Link>
      </Button>
      <PageHeader
        title="Reel weights & prices"
        description={`Each brand + type has its own empty reel, roll size, density and filament2go price per kg. Leave the lend price empty to charge the roll's sell price per kg × ${LEND_MARKUP}. Changes apply to new loans only.`}
      />
      <SpecsView specs={specs} />
    </>
  );
}
