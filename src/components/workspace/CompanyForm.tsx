import { saveCompany } from "@/app/workspace/actions";
import { Button } from "@/components/ui/Button";
import { SA_PROVINCES, INDUSTRY_CATEGORIES, TURNOVER_BANDS, TEAM_SIZES } from "@/lib/constants";
import type { Company } from "@/types/company";

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sa-green focus:outline-none focus:ring-1 focus:ring-sa-green";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-6 first:border-0 first:pt-0">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-gray-300 text-sa-green focus:ring-sa-green" />
      {label}
    </label>
  );
}

export function CompanyForm({ company }: { company: Company | null }) {
  const c = company;
  return (
    <form action={saveCompany} className="space-y-6">
      <Section title="About your business">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Company name *</label>
            <input name="name" required defaultValue={c?.name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">CIPC registration number</label>
            <input name="registration_number" defaultValue={c?.registration_number ?? ""} placeholder="e.g. 2020/123456/07" className={inputCls} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">What does your business do?</label>
          <textarea name="services_offered" rows={3} defaultValue={c?.services_offered ?? ""}
            placeholder="Describe your products / services in your own words — this sharpens matching."
            className={inputCls} />
        </div>
      </Section>

      <Section title="Where do you operate?" hint="Pick every province you can deliver in. Add National if you work countrywide.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SA_PROVINCES.map((p) => (
            <Check key={p} name="provinces" label={p} defaultChecked={c?.provinces?.includes(p)} />
          ))}
        </div>
      </Section>

      <Section title="Your industries" hint="Choose the categories that match your work.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INDUSTRY_CATEGORIES.map((ind) => (
            <Check key={ind} name="industries" label={ind} defaultChecked={c?.industries?.includes(ind)} />
          ))}
        </div>
      </Section>

      <Section title="Capacity">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Years in business</label>
            <input name="years_experience" type="number" min={0} max={100} defaultValue={c?.years_experience ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Annual turnover</label>
            <select name="annual_turnover_band" defaultValue={c?.annual_turnover_band ?? ""} className={inputCls}>
              <option value="">Prefer not to say</option>
              {TURNOVER_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Team size</label>
            <select name="team_size" defaultValue={c?.team_size ?? ""} className={inputCls}>
              <option value="">Select…</option>
              {TEAM_SIZES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Compliance & registrations" hint="Tick what you already have. We use this to score what you qualify for — and to help with the gaps.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Check name="csd_registered" label="CSD registered" defaultChecked={c?.csd_registered} />
          <Check name="tax_compliant" label="SARS Tax Compliance (TCS) valid" defaultChecked={c?.tax_compliant} />
          <Check name="coida_registered" label="COIDA / Letter of Good Standing" defaultChecked={c?.coida_registered} />
          <Check name="has_capability_statement" label="Company / capability statement ready" defaultChecked={c?.has_capability_statement} />
          <Check name="nhbrc_registered" label="NHBRC registered (home building)" defaultChecked={c?.nhbrc_registered} />
          <Check name="psira_registered" label="PSIRA registered (security)" defaultChecked={c?.psira_registered} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">B-BBEE level</label>
            <select name="bbbee_level" defaultValue={c?.bbbee_level?.toString() ?? ""} className={inputCls}>
              <option value="">None / unknown</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">CIDB grade (construction)</label>
            <input name="cidb_grade" defaultValue={c?.cidb_grade ?? ""} placeholder="e.g. 3GB" className={inputCls} />
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3 border-t border-gray-100 pt-6">
        <Button type="submit" variant="primary" size="lg">Save &amp; see my matches</Button>
        <span className="text-xs text-gray-500">You can update this any time.</span>
      </div>
    </form>
  );
}
