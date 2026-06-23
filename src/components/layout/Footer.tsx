import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <span className="text-lg font-bold text-gray-900">
              Tender<span className="text-sa-green">Intel</span>
            </span>
            <p className="mt-2 text-sm text-gray-600">
              Helping South African SMEs find, understand and win government tenders.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Platform</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link href="/workspace" className="hover:text-sa-green">My Workspace</Link></li>
              <li><Link href="/tenders" className="hover:text-sa-green">Browse Tenders</Link></li>
              <li><Link href="/wiki" className="hover:text-sa-green">Tender Wiki</Link></li>
              <li><Link href="/learn" className="hover:text-sa-green">Learning Hub</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Resources</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link href="/wiki/csd-registration" className="hover:text-sa-green">CSD Registration</Link></li>
              <li><Link href="/wiki/bbbee-guide" className="hover:text-sa-green">B-BBEE Guide</Link></li>
              <li><Link href="/wiki/how-tenders-work" className="hover:text-sa-green">How Tenders Work</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Data</h4>
            <p className="mt-3 text-sm text-gray-600">
              Tender data sourced from the National Treasury eTenders portal and OCDS API.
            </p>
          </div>
        </div>
        <div className="mt-8 space-y-2 border-t border-gray-200 pt-6 text-xs text-gray-500">
          <p>
            Tender match scores and AI summaries are decision-support only — they do not
            guarantee eligibility or award. Tender data shared with National Treasury may not be a
            complete record of all procurement processes. Always verify every detail against the
            official eTenders documents before bidding.
          </p>
          <p>
            © {new Date().getFullYear()} TenderIntel by GrowYourBiz. Not affiliated with the
            Government of South Africa.
          </p>
        </div>
      </div>
    </footer>
  );
}
