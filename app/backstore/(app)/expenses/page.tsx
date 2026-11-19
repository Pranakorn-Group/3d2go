import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toLedgerEntry } from "@/lib/dto";
import { ExpensesView } from "./expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const entries = await prisma.ledgerEntry.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 200 });
  return <ExpensesView entries={entries.map(toLedgerEntry)} />;
}
