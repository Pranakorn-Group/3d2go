"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArchiveRestore, CircleOff, Play, Scale, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, formatSGD } from "@/lib/money";
import { checkWeighIn, checkWeighOut, filamentCost, remainingG, sameType, usage } from "@/lib/spool";
import type { SpoolDTO } from "@/lib/types";
import { cancelJob, finishJob, setSpoolEmpty, startJob } from "../actions";

const ANY = "__any";

const weightInput = (id: string, value: string, onChange: (v: string) => void) => (
  <Input
    id={id}
    type="number"
    inputMode="numeric"
    min="0"
    step="1"
    autoFocus
    className="h-12 text-center text-2xl font-semibold tabular-nums"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required
  />
);

/** Weigh-in before a print, or weigh-out of the job on the printer. */
export function WeighPanel({ spool, types }: { spool: SpoolDTO; types: string[] }) {
  return spool.running ? <WeighOut spool={spool} /> : <WeighIn spool={spool} types={types} />;
}

function WeighIn({ spool, types }: { spool: SpoolDTO; types: string[] }) {
  const [beforeG, setBeforeG] = useState(String(spool.lastGrossG));
  const [slicerG, setSlicerG] = useState("");
  const [jobRef, setJobRef] = useState("");
  const [jobType, setJobType] = useState(ANY);
  const [pending, startTransition] = useTransition();

  const before = Number(beforeG);
  const problem = beforeG === "" ? null : checkWeighIn(spool, before);
  const mismatch = jobType !== ANY && !sameType(jobType, spool.product.type);
  const enough = slicerG !== "" && Number(slicerG) > remainingG(spool, before);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await startJob({
        spoolId: spool.id,
        beforeG,
        slicerG: slicerG === "" ? null : slicerG,
        jobRef,
        jobType: jobType === ANY ? null : jobType,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${spool.serial} weighed in at ${before} g`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Weigh in (before print)
        </CardTitle>
        <CardDescription>Put the spool on the scale with its reel. Last weighed {spool.lastGrossG} g.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="beforeG">Weight before (g)</FieldLabel>
              {weightInput("beforeG", beforeG, setBeforeG)}
              {problem ? (
                <FieldDescription className="text-destructive">{problem}</FieldDescription>
              ) : (
                beforeG !== "" && <FieldDescription>{remainingG(spool, before)} g of filament on the reel</FieldDescription>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="jobRef">Job / order</FieldLabel>
                <Input id="jobRef" value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="e.g. F2G-1042" />
              </Field>
              <Field>
                <FieldLabel htmlFor="slicerG">Slicer estimate (g)</FieldLabel>
                <Input id="slicerG" type="number" inputMode="numeric" min="0" step="1" value={slicerG} onChange={(e) => setSlicerG(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Job needs type</FieldLabel>
                <Select value={jobType} onValueChange={setJobType}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{jobType === ANY ? "Don't check" : jobType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Don&apos;t check</SelectItem>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {mismatch && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                This spool is <b>{spool.product.type}</b>, the job needs <b>{jobType}</b>. Use a {jobType} spool.
              </p>
            )}
            {enough && !mismatch && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                The slicer needs {slicerG} g but only {remainingG(spool, before)} g is left on this spool.
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending || beforeG === "" || Boolean(problem) || mismatch}>
              <Play /> {pending ? "Saving…" : "Start job"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function WeighOut({ spool }: { spool: SpoolDTO }) {
  const job = spool.running!;
  const [afterG, setAfterG] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const after = Number(afterG);
  const problem = afterG === "" ? null : checkWeighOut(spool, job.beforeG, after);
  const preview = afterG === "" || problem ? null : usage(job.beforeG, after, job.slicerG);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await finishJob({ usageId: job.id, afterG, note });
      if (!res.ok) return void toast.error(res.error);
      const d = res.data;
      toast.success(`Used ${d.usedG} g (${formatSGD(d.costSgd)}) · ${d.remainingG} g left`);
      if (d.nearlyEmpty) toast(`${spool.serial} is nearly empty — mark it empty when it's done`, { icon: "⚠️" });
      setAfterG("");
      setNote("");
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelJob(job.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Weigh-in dropped");
    });
  }

  return (
    <Card className="border-sky-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Weigh out (after print)
        </CardTitle>
        <CardDescription>
          {job.jobRef ? `${job.jobRef} · ` : ""}weighed in {job.beforeG} g at {formatDateTime(job.startedAt)}
          {job.slicerG != null && ` · slicer ${job.slicerG} g`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="afterG">Weight after (g)</FieldLabel>
              {weightInput("afterG", afterG, setAfterG)}
              {problem && <FieldDescription className="text-destructive">{problem}</FieldDescription>}
              {preview && (
                <FieldDescription>
                  Used <b className="text-foreground">{preview.usedG} g</b> ·{" "}
                  {formatSGD(filamentCost(preview.usedG, spool.unitCostSgd, spool.netG))}
                  {preview.overG != null && ` · ${preview.overG > 0 ? "+" : ""}${preview.overG} g vs slicer`} ·{" "}
                  {remainingG(spool, after)} g left
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="jobNote">Note (optional)</FieldLabel>
              <Input id="jobNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. failed at 40%, reprinted" />
            </Field>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="lg" disabled={pending}>
                    <X /> Drop
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Drop this weigh-in?</AlertDialogTitle>
                    <AlertDialogDescription>Only if the job never ran. Nothing is recorded as used.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={cancel}>
                      Drop weigh-in
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="submit" size="lg" className="flex-1" disabled={pending || afterG === "" || Boolean(problem)}>
                {pending ? "Saving…" : "Finish job"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function SpoolActions({ spool }: { spool: SpoolDTO }) {
  const [pending, startTransition] = useTransition();
  const empty = spool.status === "EMPTY";

  function toggle() {
    startTransition(async () => {
      const res = await setSpoolEmpty(spool.id, !empty);
      if (!res.ok) return void toast.error(res.error);
      toast.success(empty ? `${spool.serial} back in use` : `${spool.serial} marked empty`);
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {empty ? (
        <>
          <ArchiveRestore /> Back in use
        </>
      ) : (
        <>
          <CircleOff /> Mark empty
        </>
      )}
    </Button>
  );
}
