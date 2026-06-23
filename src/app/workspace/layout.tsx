import { redirect } from "next/navigation";
import { getCurrentUser, ensureProfile } from "@/lib/company/profile";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Tender Workspace" };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?redirect=/workspace");
  await ensureProfile(user);

  return (
    <div>
      <WorkspaceNav email={user.email} />
      <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
    </div>
  );
}
