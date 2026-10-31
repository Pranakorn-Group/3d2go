import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { getSpoolSpecs } from "@/lib/spools";
import { SpecsView } from "./specs-view";

export const metadata: Metadata = { title: "Reel weights" };

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
        title="Reel weights"
        description="Each brand + type has its own empty reel, roll size and density. New spools start from these; changing them doesn't touch spools already open."
      />
      <SpecsView specs={specs} />
    </>
  );
}
