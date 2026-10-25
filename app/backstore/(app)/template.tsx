import { FadeIn } from "@/components/motion";

// Templates remount on every navigation, so each backstore page fades in as you move between them.
export default function BackstoreTemplate({ children }: { children: React.ReactNode }) {
  return <FadeIn>{children}</FadeIn>;
}
