import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { CompanyForm } from "@/components/workspace/CompanyForm";
import { getCurrentUser, getCompany } from "@/lib/company/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "Company Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?redirect=/workspace/profile");
  const company = await getCompany(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Company profile</h1>
      <p className="mt-1 text-sm text-gray-600">
        This is your Tender Matching Profile. The more accurate it is, the better your matches.
      </p>

      {searchParams.error === "name" && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          Company name is required.
        </p>
      )}

      <Card className="mt-6">
        <CardBody>
          <CompanyForm company={company} />
        </CardBody>
      </Card>
    </div>
  );
}
