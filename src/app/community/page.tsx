"use client";

import Link from "next/link";
import { EncouragementDashboard } from "@/components/EncouragementDashboard";
import { DemoLogin } from "@/components/DemoLogin";
import { DesktopBuddy } from "@/components/DesktopBuddy";
import { useDemoAuth } from "@/lib/demo-auth";

export default function CommunityPage() {
  const { currentUser } = useDemoAuth();
  if (!currentUser) return <DemoLogin />;
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"><header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Incline community</p><h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Grow better, together<span className="text-moss">.</span></h1><p className="mt-2 text-sm text-muted sm:text-base">Share encouragement and celebrate your community’s momentum.</p></div><Link href="/" className="w-fit rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted hover:border-moss/40 hover:text-ink">Back to focus dashboard</Link></header><EncouragementDashboard /><DesktopBuddy /><footer className="mt-8 border-t border-line-soft py-5 text-center text-xs text-faint">Small encouragements. Meaningful momentum.</footer></main>;
}
