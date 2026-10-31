"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Check, Ruler } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gramsToMetres } from "@/lib/spool";
import type { SpoolSpecDTO } from "@/lib/types";
import { saveSpoolSpec } from "../actions";

function SpecRow({ spec }: { spec: SpoolSpecDTO }) {
  const [netG, setNetG] = useState(String(spec.netG));
  const [tareG, setTareG] = useState(spec.saved ? String(spec.tareG) : "");
  const [density, setDensity] = useState(String(spec.densityGcm3));
  const [pending, startTransition] = useTransition();
  const dirty = !spec.saved || netG !== String(spec.netG) || tareG !== String(spec.tareG) || density !== String(spec.densityGcm3);

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSpoolSpec({ brand: spec.brand, type: spec.type, netG, tareG, densityGcm3: density });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Saved ${spec.brand} ${spec.type}`);
    });
  }

  const input = (value: string, set: (v: string) => void, label: string, step = "1") => (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label={`${label} for ${spec.brand} ${spec.type}`}
      className="w-24 tabular-nums"
      form={`spec-${spec.brand}-${spec.type}`}
      required
    />
  );

  return (
    <TableRow>
      <TableCell className="pl-4">
        <div className="font-medium">
          {spec.brand} {spec.type}
        </div>
        {!spec.saved && <Badge variant="secondary">Not set</Badge>}
      </TableCell>
      <TableCell>{input(tareG, setTareG, "Empty reel")}</TableCell>
      <TableCell>{input(netG, setNetG, "Full roll")}</TableCell>
      <TableCell>{input(density, setDensity, "Density", "0.01")}</TableCell>
      <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
        ≈ {Math.round(gramsToMetres(Number(netG), Number(density)))} m
      </TableCell>
      <TableCell className="pr-4 text-right">
        <form id={`spec-${spec.brand}-${spec.type}`} onSubmit={save}>
          <Button type="submit" size="sm" variant={dirty ? "default" : "ghost"} disabled={pending || !dirty || tareG === ""}>
            <Check /> Save
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function SpecsView({ specs }: { specs: SpoolSpecDTO[] }) {
  if (!specs.length) return <EmptyState icon={Ruler} title="No filament yet">Add filament on the Stock page first.</EmptyState>;
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Brand + type</TableHead>
            <TableHead>Empty reel (g)</TableHead>
            <TableHead>Full roll (g)</TableHead>
            <TableHead>Density (g/cm³)</TableHead>
            <TableHead className="hidden md:table-cell">Length (1.75 mm)</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {specs.map((s) => (
            <SpecRow key={`${s.brand}:${s.type}:${s.saved}`} spec={s} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
