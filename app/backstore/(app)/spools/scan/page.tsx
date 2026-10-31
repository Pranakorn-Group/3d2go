import type { Metadata } from "next";
import { ScanView } from "./scan-view";

export const metadata: Metadata = { title: "Scan & weigh" };

export default function ScanPage() {
  return <ScanView />;
}
