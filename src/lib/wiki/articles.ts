import type { WikiCategory } from "@/types/wiki";

export interface SeedArticle {
  slug: string;
  title: string;
  category: WikiCategory;
  form_code?: string;
  related_forms?: string[];
  tags: string[];
  summary: string;
  content: string;
}

export const WIKI_ARTICLES: SeedArticle[] = [
  {
    slug: "sbd-1",
    title: "SBD 1 — Invitation to Bid",
    category: "form",
    form_code: "SBD 1",
    related_forms: ["SBD 4", "SBD 6.1", "SBD 8", "SBD 9"],
    tags: ["sbd", "invitation to bid", "bidding", "scm"],
    summary:
      "The cover form of every South African government bid — it captures the bidder's identity, contact details and declares the bid as a formal offer.",
    content: `# SBD 1 — Invitation to Bid

## What it is
The **SBD 1 (Standard Bidding Document 1)** is the official cover sheet and invitation to bid issued by an organ of state. It is the first form in almost every government tender pack and it formally invites suppliers to submit an offer for the goods, services or works being procured. When you complete and sign it, you are making a binding offer to the state.

## When it is required
SBD 1 is required for **every formal competitive bid** advertised by national departments, provincial departments, municipalities and most public entities. If a tender has been advertised on the eTenders portal, it will almost always include an SBD 1 in the bid pack. It is not used for low-value quotations below the formal bid threshold (those use SBD 1 variants or simple quotation forms).

## What information it captures
The SBD 1 collects the core identity and contact information the state needs to evaluate and, if successful, contract with you:

- **Bidder's name** and trading name
- **Company registration number** (CIPC) and VAT registration number
- **Physical and postal address**
- **Contact person**, telephone, cellphone and email
- **Central Supplier Database (CSD) registration number** — now mandatory
- **B-BBEE status level** and whether you are an EME or QSE
- **Tax compliance status** / SARS reference
- A declaration that the bid is valid for the stated validity period (often 90 days)

## Common mistakes
1. **Leaving the CSD number blank.** All suppliers to the state must be registered on the Central Supplier Database. A missing or invalid CSD number can disqualify your bid.
2. **Signature mismatches.** The person who signs must be authorised to bind the bidder. Use a company resolution where needed.
3. **Expired validity.** If you alter the bid validity period or your offer lapses, the organ of state may not be able to award to you.
4. **Inconsistent details.** The company name, registration number and banking details on SBD 1 must match your CSD record and other SBD forms exactly.

## How it fits the bigger picture
SBD 1 is the anchor form. The other SBD forms (declarations of interest, independent bid determination, past SCM practices, preference points) attach to it. Get the SBD 1 right and consistent with your CSD profile, and the rest of the pack becomes far easier to complete correctly.`,
  },
  {
    slug: "sbd-4",
    title: "SBD 4 — Declaration of Interest",
    category: "form",
    form_code: "SBD 4",
    related_forms: ["SBD 1", "SBD 8", "SBD 9"],
    tags: ["sbd", "declaration of interest", "conflict of interest", "ethics"],
    summary:
      "The conflict-of-interest declaration: bidders must disclose any relationship with employees of the state that could create bias.",
    content: `# SBD 4 — Declaration of Interest

## What it is
The **SBD 4** is the **Declaration of Interest** form. Its purpose is to surface any relationship between the bidder (or its directors and shareholders) and people employed by the state, so that the procuring department can manage conflicts of interest before awarding a contract.

## Why conflicts of interest matter in procurement
Government procurement must be **fair, equitable, transparent, competitive and cost-effective** (section 217 of the Constitution). If a bidder is connected to an official who can influence the award, the process is no longer fair. The SBD 4 does not automatically disqualify connected bidders, but it forces disclosure so that the conflicted official can recuse themselves and the bid can be evaluated cleanly.

## Who must sign and what must be disclosed
The authorised representative of the bidder signs the SBD 4 and must disclose:

- Whether any of the bidder's directors, managers, principal shareholders or stakeholders is **employed by the state**.
- Whether any **spouse, child or parent** of a director/shareholder is employed by the state.
- The **name, position and department** of any such person.
- Whether the bidder, its directors or shareholders have any **relationship (family, friend, other)** with anyone involved in the evaluation or award of the bid.

## Family member rules
The form specifically reaches **immediate family** — spouses, life partners, children and parents — because these relationships are the most common channel for undue influence. You must disclose even if you believe the relationship has no bearing on the bid. Non-disclosure that is later discovered is treated as a material misrepresentation and can lead to cancellation of the award, blacklisting, and even criminal liability under the PFMA/MFMA.

## Common mistakes
- **Assuming a distant connection doesn't count.** When in doubt, disclose.
- **Forgetting state-owned entity employment.** Employment by an organ of state includes SOEs and municipalities, not just national departments.
- **Inconsistent director lists.** The directors named here should match your CIPC and CSD records.

## Practical tip
Keep an up-to-date register of your directors and shareholders and their immediate family members who work in the public sector. Completing SBD 4 then becomes a quick, accurate exercise rather than a guess under deadline pressure.`,
  },
  {
    slug: "sbd-6-1",
    title: "SBD 6.1 — Certificate of Independent Bid Determination",
    category: "form",
    form_code: "SBD 6.1",
    related_forms: ["SBD 1", "SBD 9"],
    tags: ["sbd", "collusion", "bid rigging", "competition", "pfma"],
    summary:
      "An anti-collusion declaration: the bidder certifies it arrived at its bid independently, without coordinating prices with competitors.",
    content: `# SBD 6.1 — Certificate of Independent Bid Determination

## What it is
The **SBD 6.1** is the **Certificate of Independent Bid Determination**. By signing it, the bidder certifies that its bid was arrived at **independently** and was not the product of collusion with competitors. It is one of the state's main tools against bid rigging.

## What bid rigging means
**Bid rigging** (collusive tendering) happens when competitors secretly agree to manipulate the outcome of a tender instead of competing honestly. Common forms include:

- **Cover bidding** — a competitor submits a deliberately high or non-compliant bid to create the illusion of competition.
- **Bid suppression** — a competitor agrees not to bid, or withdraws, so another can win.
- **Bid rotation** — competitors take turns winning contracts.
- **Market allocation** — competitors carve up customers or geographic areas.
- **Price coordination** — sharing or agreeing prices before submission.

All of these are prohibited under the **Competition Act 89 of 1998** and can attract administrative penalties of up to 10% of turnover, plus criminal liability for individuals.

## Why the PFMA and SCM rules require it
The Public Finance Management Act (PFMA) and the supply chain management regulations require value for money and genuine competition. The SBD 6.1 puts the bidder on record, in writing, that:

- The prices were determined **without consultation, communication, agreement or arrangement** with any competitor.
- The prices were **not disclosed** to any competitor before bid closing.
- No attempt was made to **induce** another firm to submit or not submit a bid.

## Who signs
An authorised representative who has personal knowledge of the facts, or who has made reasonable enquiry, signs on behalf of the bidder. Signing falsely is a serious offence and grounds for disqualification, cancellation and referral to the Competition Commission.

## Common mistakes
- **Group/associated companies.** If related entities submit separate bids, the relationship must be disclosed; pretending they are wholly independent invites a collusion finding.
- **Sharing a consultant or estimator.** Using the same third party who also prices a competitor's bid can compromise independence.
- **Casual pre-bid chats** about pricing with competitors at site briefings — keep these strictly to clarification questions directed at the procuring official.

## Bottom line
Treat the SBD 6.1 as a genuine compliance commitment, not a formality. Competition authorities actively pursue collusion in public procurement, and a signed SBD 6.1 is the evidence used against firms that rig bids.`,
  },
  {
    slug: "sbd-7-2",
    title: "SBD 7.2 — Contract Form (Rendering of Services)",
    category: "form",
    form_code: "SBD 7.2",
    related_forms: ["SBD 1", "SBD 7.1"],
    tags: ["sbd", "contract", "services", "award"],
    summary:
      "The formal contract form executed when a services tender is awarded — it turns the accepted bid into a binding agreement.",
    content: `# SBD 7.2 — Contract Form (Rendering of Services)

## What it is
The **SBD 7.2** is the **Contract Form for the Rendering of Services**. (Its sibling, SBD 7.1, covers the purchase of goods.) It is the document that converts an accepted bid into a binding contract between the bidder and the organ of state once the tender has been awarded.

## When it is executed vs SBD 1
This is the key distinction many bidders miss:

- **SBD 1 (Invitation to Bid)** is completed **at the start**, when you submit your offer. It is your *offer* to the state.
- **SBD 7.2 (Contract Form)** is executed **at the end**, when the state *accepts* your offer and awards the contract. It is the *acceptance and agreement* that creates the contract.

In contract-law terms: SBD 1 is the offer, the award letter is the acceptance, and SBD 7.2 is the signed record of the resulting agreement.

## What it captures
The SBD 7.2 sets out the essential terms of the services contract:

- The **parties** — the supplier and the procuring organ of state.
- A reference to the **bid number** and the accepted bid.
- The **services to be rendered**, the **period** of the contract, and the **contract price**.
- The **terms and conditions** that govern the relationship (often incorporating the General Conditions of Contract, the special conditions, and the bid specifications by reference).
- **Signature blocks** for both the supplier's authorised representative and the accounting officer/authority (or delegate).

## Why it matters
Until the SBD 7.2 (or an equivalent signed agreement / official order) is in place, there may be no enforceable contract — only an offer and a notification of intention to award. The signed contract form:

1. Fixes the **scope and price**, preventing later disputes about what was agreed.
2. Establishes the **start and end dates** and any milestones.
3. Incorporates the **conditions of contract**, including performance, payment and termination provisions.

## Common mistakes
- **Treating the award letter as the whole contract.** The award notifies you; the SBD 7.2 (and supporting conditions) is the binding instrument.
- **Signing without checking incorporated documents.** The General and Special Conditions of Contract, the specification, and your priced bid usually form part of the contract — read them.
- **Authority to sign.** Ensure the signatory on your side can bind the company, and that the state signatory holds the necessary delegation.

## Practical tip
Before signing, reconcile the SBD 7.2 against your original bid: the price, scope and period must match what you offered. Any deviation should be queried and corrected before signature, not after.`,
  },
  {
    slug: "sbd-8",
    title: "SBD 8 — Declaration of Bidder's Past SCM Practices",
    category: "form",
    form_code: "SBD 8",
    related_forms: ["SBD 1", "SBD 4", "SBD 9"],
    tags: ["sbd", "blacklisting", "debarment", "scm history", "integrity"],
    summary:
      "A declaration of the bidder's procurement track record — including any blacklisting, debarment or prior findings of misconduct.",
    content: `# SBD 8 — Declaration of Bidder's Past Supply Chain Management Practices

## What it is
The **SBD 8** is the **Declaration of the Bidder's Past Supply Chain Management Practices**. It requires bidders to disclose whether they (or their directors) have a history of misconduct in dealings with the state — most importantly whether they have been **blacklisted, debarred, or found to have acted dishonestly** in previous tenders.

## Blacklisting and debarment explained
The National Treasury maintains a **Database of Restricted Suppliers** and a **Register for Tender Defaulters**. A supplier can be **restricted (blacklisted)** from doing business with the state for a period — typically up to 10 years — for conduct such as:

- Submitting **fraudulent or false information** in a bid.
- **Abandoning** or failing to perform an awarded contract.
- Engaging in **corrupt or collusive** practices.
- Being convicted of an offence involving **fraud or corruption**.

If you are on the Restricted Suppliers database, you cannot be awarded state contracts during the restriction period. The SBD 8 forces you to declare this up front.

## What you must declare
On the SBD 8 you answer, truthfully:

- Whether the **bidder or any of its directors** is listed on the Register for Tender Defaulters or the Restricted Suppliers database.
- Whether the bidder has been **convicted** of fraud or corruption in the last five years.
- Whether the bidder has **wilfully neglected, reneged on or failed to comply** with a government contract in the past five years.
- Whether any contract with the state was **terminated** for failure to perform.

## Why honesty is non-negotiable
False declarations on the SBD 8 are themselves grounds for restriction. The state cross-checks declarations against the official databases. If you declare "no" but appear on the register, your bid is disqualified and you risk being restricted further for the misrepresentation — a compounding penalty.

## Common mistakes
- **Forgetting a director's history.** The declaration covers the company *and* its directors. A director restricted through another entity can taint your bid.
- **Confusing a dispute with a default.** Not every contract problem is a "default" — but if a contract was formally terminated for non-performance, disclose it and be ready to explain the context.
- **Assuming old matters have lapsed.** Check the actual restriction period; it can run for several years.

## Practical tip
Before bidding, check your status (and your directors') against the National Treasury Restricted Suppliers database and Register for Tender Defaulters. Knowing where you stand lets you complete the SBD 8 accurately and address any issues proactively.`,
  },
  {
    slug: "sbd-9",
    title: "SBD 9 — Certificate of Independent Bid Determination (Sworn)",
    category: "form",
    form_code: "SBD 9",
    related_forms: ["SBD 1", "SBD 6.1", "SBD 8"],
    tags: ["sbd", "collusion", "affidavit", "commissioner of oaths"],
    summary:
      "A sworn version of the independent bid determination certificate, often commissioned before a commissioner of oaths.",
    content: `# SBD 9 — Certificate of Independent Bid Determination

## What it is
The **SBD 9** is a **Certificate of Independent Bid Determination**. Like the SBD 6.1, it is an anti-collusion instrument: the bidder certifies that its bid was prepared **independently**, without coordinating prices or strategy with competitors. In many bid packs the SBD 9 functions as the formal, declared version of the independent-bid commitment, signed by an authorised person who attests to its truth.

## How it relates to the SBD 6.1
The SBD 6.1 and SBD 9 cover the **same anti-collusion principle**. Different bid packs and different eras of the SCM forms use these numbers, and some procuring entities require the certificate to be **signed before a Commissioner of Oaths** to add the weight of a sworn declaration. Where a commissioner is required, the signatory swears that the contents are true, and the commissioner stamps and signs the form. Always submit the exact form(s) the bid pack asks for — if both SBD 6.1 and SBD 9 are included, complete both.

## What you certify
By signing the SBD 9 the authorised representative certifies, in substance, that:

- The prices in the bid were **arrived at independently**, without consultation, communication, agreement or arrangement with any competitor.
- The prices were **not disclosed** to a competitor before the bid closing date.
- There was **no attempt to induce** any other firm to submit, or refrain from submitting, a bid.
- The bidder has **no knowledge of any collusion** affecting the bid.

## Role of the Commissioner of Oaths
Where the form is sworn, a **Commissioner of Oaths** (for example, a police officer of a certain rank, an attorney, or other authorised official) administers the oath or affirmation and certifies that the deponent:

- Acknowledged that they **understood** the contents.
- Had **no objection** to taking the oath.
- Considered the oath **binding** on their conscience.

This converts the certificate into a sworn statement, making a false declaration not only a procurement offence but potentially **perjury**.

## Common mistakes
- **Unsigned or uncommissioned forms** where the bid pack required a sworn declaration — this is an instant compliance failure.
- **Stale commissioning** — some entities require the commissioning to be recent; an old date can be rejected.
- **Signatory without authority or knowledge** — the person swearing should genuinely understand how the bid was priced.

## Bottom line
The SBD 9 raises the integrity stakes of the bid. Treat it as a sworn promise of fair competition; the consequences of a false sworn certificate are severe, spanning competition law, criminal law and procurement restriction.`,
  },
  {
    slug: "mbd-6-2",
    title: "MBD 6.2 — Preference Points Claim Form (B-BBEE)",
    category: "form",
    form_code: "MBD 6.2",
    related_forms: ["SBD 6.1", "SBD 1"],
    tags: ["mbd", "bbbee", "preference points", "80/20", "90/10", "pppfa"],
    summary:
      "The form bidders use to claim B-BBEE preference points under the 80/20 or 90/10 scoring systems of the Preferential Procurement Policy Framework Act.",
    content: `# MBD 6.2 — Preference Points Claim Form

## What it is
The **MBD 6.2 (Municipal Bidding Document 6.2)** — and its national equivalent **SBD 6.2** — is the **Preference Points Claim Form** used to claim points for **Broad-Based Black Economic Empowerment (B-BBEE)**. It implements the **Preferential Procurement Policy Framework Act (PPPFA)** and its regulations, which require organs of state to award a portion of the evaluation score for transformation, not just price.

## How preference points work
Bids are scored out of **100 points**, split between **price** and **B-BBEE**:

- **80/20 system** — used for lower-value tenders. **80 points** for price, up to **20 points** for B-BBEE status.
- **90/10 system** — used for higher-value tenders. **90 points** for price, up to **10 points** for B-BBEE status.

The applicable system and the rand threshold that triggers it are stated in the bid documents. The price points are calculated by a formula that gives the lowest acceptable price the maximum price points and scales others down proportionally.

## B-BBEE scoring on the form
You claim B-BBEE points according to your **B-BBEE Status Level of Contributor**. As a guide, under the regulations the points scale roughly as follows (90/10 in brackets):

| B-BBEE Level | 80/20 points | 90/10 points |
|---|---|---|
| 1 | 20 | 10 |
| 2 | 18 | 9 |
| 3 | 14 | 6 |
| 4 | 12 | 5 |
| 5 | 8 | 4 |
| 6 | 6 | 3 |
| 7 | 4 | 2 |
| 8 | 2 | 1 |
| Non-compliant | 0 | 0 |

## How to claim
On the MBD 6.2 you:

1. State the **points system** that applies (80/20 or 90/10).
2. Enter your **B-BBEE Status Level** and the number of points claimed.
3. Attach **proof**: a valid **B-BBEE certificate** from a SANAS-accredited verification agency, or a **sworn affidavit** for an EME/QSE, or a **CIPC B-BBEE certificate** for an EME.
4. Declare that the information is correct and that you accept that points may be re-assessed if it is wrong.

## Common mistakes
- **Claiming a level without valid proof.** Without an acceptable certificate or affidavit, you score **zero** B-BBEE points — you are not disqualified, but you lose the preference.
- **Expired certificates.** The B-BBEE certificate must be valid on the bid closing date.
- **Misreading the threshold.** Claiming 80/20 points on a 90/10 tender (or vice versa) leads to re-scoring.
- **Subcontracting conditions.** Some tenders impose pre-qualifying subcontracting requirements under the regulations — read these carefully.

## Practical tip
Keep a valid B-BBEE certificate or affidavit on hand and diarise its expiry. Because preference points often decide close tenders, an out-of-date certificate can cost you the award even when your price is competitive.`,
  },
  {
    slug: "bbbee-guide",
    title: "B-BBEE Certificate Guide",
    category: "guide",
    related_forms: ["MBD 6.2"],
    tags: ["bbbee", "transformation", "eme", "qse", "verification"],
    summary:
      "Understand B-BBEE levels 1–8, what each level scores, EME/QSE affidavit exemptions, and how verification works.",
    content: `# B-BBEE Certificate Guide

## What B-BBEE is
**Broad-Based Black Economic Empowerment (B-BBEE)** is South Africa's framework for transforming the economy by increasing black participation in ownership, management and skills. In government procurement, your B-BBEE status directly affects the **preference points** you can claim (see MBD/SBD 6.2), and it can be decisive in close tenders.

## The levels (1–8) and what they mean
Your business is measured against a **B-BBEE scorecard** and given a **Status Level of Contributor** from 1 to 8 (or "Non-compliant"). A **lower level number is better** because it reflects a higher B-BBEE recognition:

- **Level 1** — the strongest status; full (and on some scorecards enhanced) recognition.
- **Levels 2–4** — strong to good contributors; most established compliant firms sit here.
- **Levels 5–8** — partial recognition; fewer preference points.
- **Non-compliant** — no recognition and zero preference points.

The exact scorecard thresholds depend on which **sector code** applies (Generic Codes or a sector charter such as construction, ICT, tourism, etc.).

## EME and QSE exemptions
The scorecard burden scales with turnover:

- **EME (Exempted Micro Enterprise)** — annual turnover **below R10 million**. EMEs are **automatically deemed compliant** and can qualify for a high level (often **Level 4, or Level 1/2 if black-owned**) on the strength of a simple **sworn affidavit**, with no formal verification needed.
- **QSE (Qualifying Small Enterprise)** — annual turnover **R10 million to R50 million**. A **black-owned QSE (51%+)** can also use a **sworn affidavit**; otherwise a QSE is verified against the QSE scorecard.
- **Generic enterprise** — turnover **above R50 million** — must be **verified** against the full scorecard by an accredited agency.

A black-owned EME or QSE with **100% black ownership** typically qualifies as **Level 1**, and **51%+ black ownership** as **Level 2**, via affidavit.

## How verification works
For QSEs and generic enterprises that need formal verification:

1. A **SANAS-accredited verification agency** assesses your business against the scorecard elements — **ownership, management control, skills development, enterprise and supplier development, and socio-economic development**.
2. The agency issues a **B-BBEE verification certificate** stating your level and black-ownership percentages.
3. The certificate is typically **valid for 12 months** from date of issue.

For EMEs and qualifying QSEs, a **sworn affidavit** (on the prescribed template) or a **CIPC-issued B-BBEE certificate** replaces verification.

## Using your certificate in tenders
- Attach a **valid** certificate or affidavit to your **MBD/SBD 6.2** claim.
- Ensure it is **valid on the bid closing date** — an expired certificate means **zero preference points**.
- Make sure the **legal entity name** on the certificate matches your CSD and bid documents.

## Common mistakes
- Letting the certificate **expire** just before a big tender closes.
- Using an **affidavit when verification was required** (turnover above the EME/QSE threshold).
- **Ownership changes** not reflected on the certificate, creating mismatches during evaluation.

## Practical tip
Treat B-BBEE as an ongoing programme, not a once-a-year certificate run. Improving genuine ownership, skills development and supplier development raises your level — and your competitiveness on every future tender.`,
  },
  {
    slug: "csd-registration",
    title: "CSD Registration Guide",
    category: "guide",
    tags: ["csd", "central supplier database", "registration", "mandatory"],
    summary:
      "How to register on the Central Supplier Database (CSD), what information you need, and why CSD registration is mandatory for all state suppliers.",
    content: `# Central Supplier Database (CSD) Registration Guide

## What the CSD is
The **Central Supplier Database (CSD)** is the National Treasury's single, national database of all organisations and individuals who want to do business with the South African government. Since **1 April 2016**, suppliers must be registered on the CSD to be awarded state contracts. It replaced the dozens of separate supplier databases that departments and municipalities used to keep.

## Why it is mandatory
The CSD exists to make procurement **cleaner, faster and verifiable**. When you register, the CSD automatically verifies your details against authoritative sources:

- **CIPC** for company registration and director information,
- **SARS** for tax compliance status,
- **The banking system** for bank account verification,
- **Government payroll and other databases** to flag conflicts of interest.

Because the state can trust verified CSD data, you no longer submit the same documents to every department. A valid CSD registration (and the resulting **supplier number**, e.g. *MAAA0123456*) is required on the SBD 1 and throughout the bid pack.

## What information you need to register
Before you start, have the following ready:

- **Identity / company details** — ID number(s) of directors/owners, and the **CIPC registration number** for companies.
- **Tax reference number** — so SARS tax compliance can be verified.
- **Bank account details** — account number, branch and type, in the legal entity's name, for verification.
- **B-BBEE information** — level and certificate/affidavit details.
- **Contact details** — email and cellphone (used for the one-time pin and notifications).
- **Industry / commodity classifications** — what you supply.

## How to register (step by step)
1. Go to the CSD website (**secure.csd.gov.za**) and create a **user account** using your email and cellphone.
2. Capture the **supplier identity** — individual, company, trust, etc.
3. Enter **tax, banking, address, contact, director and B-BBEE** information.
4. Submit. The CSD runs **automated verifications** (CIPC, SARS, bank).
5. Once verifications pass, your registration is **active** and you receive a **unique CSD supplier number**.

## Keeping it valid
- The CSD revalidates your **tax compliance** periodically; resolve SARS issues promptly or your status will show as non-compliant.
- **Update your details** whenever directors, banking or contact information change — mismatches cause bids to be queried or rejected.
- Some buyers also require a **provincial/municipal "self-service" registration** linked to your CSD number.

## Common mistakes
- **Bank details in the wrong name** — verification fails if the account is not in the legal entity's name.
- **Letting tax compliance lapse** — your CSD report will flag it and weaken your bids.
- **Stale director information** — out-of-date directors create conflict-of-interest and SBD 4/8 inconsistencies.

## Practical tip
Print your **CSD supplier report** before each bid and check it: it shows your tax status, banking validity, directors and B-BBEE level exactly as evaluators will see them. Fixing problems on the CSD before you submit saves you from avoidable disqualification.`,
  },
  {
    slug: "tax-clearance",
    title: "Tax Clearance / SARS Tax Compliance Status (TCS) PIN Guide",
    category: "guide",
    tags: ["tax clearance", "sars", "tcs pin", "compliance"],
    summary:
      "How to obtain a SARS Tax Compliance Status (TCS) PIN, how long it stays valid, and what makes you non-compliant.",
    content: `# Tax Clearance / SARS Tax Compliance Status (TCS) PIN Guide

## What it is
To win government tenders you must prove that your tax affairs are in order. SARS no longer issues the old paper **Tax Clearance Certificate**. Instead it provides a **Tax Compliance Status (TCS) PIN** — a secure code that lets a third party (such as a procuring department) verify your real-time tax compliance directly with SARS.

## Why tenders require it
The PPPFA and SCM rules require bidders to be **tax compliant**. A live TCS PIN means the organ of state can confirm, at the moment of evaluation, that you are compliant — rather than relying on a certificate that may be months out of date. Your tax compliance is also revalidated automatically through your **CSD** profile.

## How to get a TCS PIN (step by step)
1. Log in to **SARS eFiling** (or visit a SARS branch / use the SARS MobiApp).
2. Activate the **Tax Compliance Status** service under "Tax Status".
3. Select the **"Good Standing"** TCS type (for general compliance) — there is also a separate "Tender" type on older systems, but "Good Standing" is the common request.
4. SARS assesses your status across all tax types and, if you are compliant, issues a **TCS PIN**.
5. Provide the **PIN (and your tax reference number)** to the organ of state, who uses it to verify your status on the SARS portal.

## Validity period
The TCS PIN itself does **not** carry a fixed "expiry like a certificate". Instead, it gives the verifier a **live view** of your status that updates as your compliance changes. In practice:

- A PIN can be issued with a **validity window** (commonly up to **12 months**) during which a third party can query it.
- But the **status it reveals is real-time** — if you fall out of compliance after issuing the PIN, the verifier will see **non-compliant** when they check.

So you cannot rely on an old PIN if your tax affairs have since slipped.

## What makes you non-compliant
SARS flags you as non-compliant if:

- You have **outstanding returns** (income tax, VAT, PAYE, etc.) that have not been submitted.
- You have **outstanding debt** to SARS that is not under a payment arrangement or suspension.
- You are **not registered** for a tax you should be registered for.
- Your **registered particulars** (e.g. address, bank, public officer) are outdated.

## Common mistakes
- **Assuming a once-compliant PIN stays valid.** Compliance is checked live; stay compliant for the whole bid period.
- **Forgetting a dormant tax type.** An unfiled VAT or PAYE return on an old registration can make you non-compliant overall.
- **Mismatched details** between SARS, CIPC and CSD that prevent verification.

## Practical tip
Run a **"My Compliance Profile"** check on eFiling regularly. It shows exactly which returns or debts are causing non-compliance, so you can fix them before they cost you a tender. Keep all returns filed and any SARS debt under an arrangement, and your TCS will stay green.`,
  },
  {
    slug: "how-tenders-work",
    title: "How South African Government Tenders Work",
    category: "process",
    tags: ["process", "lifecycle", "bidding", "award", "scm"],
    summary:
      "The full lifecycle of a government tender, from advertisement and briefing through submission, adjudication, award and contract.",
    content: `# How South African Government Tenders Work

Government procurement in South Africa follows a structured, legally governed process designed to be **fair, equitable, transparent, competitive and cost-effective** (section 217 of the Constitution). Here is the full lifecycle of a typical formal tender.

## 1. Identification and specification
A department, municipality or public entity identifies a need and develops a **specification** (for goods/services) or **terms of reference** (for consulting). This defines exactly what is required, the evaluation criteria, and whether the **80/20 or 90/10** preference system applies.

## 2. Advertisement
The tender is **advertised** — primarily on the **National Treasury eTenders portal (etenders.gov.za)**, and sometimes in the Government Tender Bulletin and other media. The advert states the **bid number, description, closing date and time, contact person**, and where to obtain the bid documents. Most tenders are advertised for a **minimum of about 21 days**.

## 3. Compulsory briefing session (if applicable)
Many tenders include a **briefing session** (sometimes compulsory). Here the procuring entity explains the requirements, bidders inspect the site if relevant, and questions are answered. If the briefing is **compulsory**, failing to attend (and sign the register) disqualifies your bid. Questions and answers are usually circulated to all bidders to keep the process fair.

## 4. Preparation and submission
Bidders prepare their response: pricing, technical proposal, and all **SBD/MBD forms** (SBD 1, 4, 6.1, 8, 9, MBD 6.2, etc.), plus supporting documents (CSD report, B-BBEE certificate, tax status, company registration). The bid must be **submitted before the closing date and time** in the manner specified (physical tender box or electronic portal). **Late bids are not accepted** — there is zero tolerance on timing.

## 5. Opening
At closing, bids are **opened in public** (or recorded electronically) and a register of bidders and, where applicable, prices is recorded. This transparency step lets bidders see who participated.

## 6. Evaluation
Evaluation usually proceeds in stages:

- **Administrative compliance** — are all mandatory forms and documents present and the bidder eligible (CSD-registered, tax compliant, not blacklisted)?
- **Functionality/technical** — where a minimum functionality threshold applies, bids are scored against quality criteria and must meet the minimum to proceed.
- **Price and preference** — qualifying bids are scored on **price plus B-BBEE preference points** under the 80/20 or 90/10 system.

## 7. Adjudication
A **Bid Adjudication Committee (BAC)** reviews the evaluation committee's recommendation, checks compliance and value for money, and decides on (or recommends) the award. Larger contracts may need additional approvals.

## 8. Award and notification
The successful bidder is notified, and the award is **published** (the eTenders portal lists awarded tenders, including the supplier and amount). Unsuccessful bidders may request reasons and, in some cases, lodge objections.

## 9. Contract and delivery
The award is formalised through a **contract** (e.g. SBD 7.1/7.2) or an **official order**, incorporating the conditions of contract, specification and priced bid. The supplier then delivers, and the entity manages performance, payment and close-out.

## Key takeaways for SMEs
- **Read the whole bid pack** and build a checklist of every required form and document.
- **Register on the CSD** and keep your **tax and B-BBEE** status current — these are gating requirements.
- **Never miss the closing time or a compulsory briefing.**
- **Be consistent** across all forms (names, registration numbers, banking).

Mastering this lifecycle — and the forms that attach to each stage — is the difference between a bid that is disqualified on a technicality and one that competes on its merits.`,
  },
  {
    slug: "evaluation-criteria",
    title: "Understanding Tender Evaluation Criteria",
    category: "process",
    related_forms: ["MBD 6.2"],
    tags: ["evaluation", "functionality", "price", "bbbee", "adjudication"],
    summary:
      "How bids are scored — functionality (quality) thresholds, the price formula, B-BBEE preference points, and how adjudication committees decide.",
    content: `# Understanding Tender Evaluation Criteria

Winning a government tender is not simply about the lowest price. Bids are scored against defined criteria in a set order, and understanding that order helps you target your effort where it counts.

## Stage 1: Administrative compliance (pass/fail)
Before any scoring, evaluators check that your bid is **complete and eligible**:

- All mandatory **SBD/MBD forms** signed and submitted.
- **CSD registration**, **tax compliance**, valid **B-BBEE** proof.
- Not listed as **restricted/blacklisted** (SBD 8).
- Attendance at a **compulsory briefing**, if required.

Fail any mandatory requirement and your bid is **disqualified** here — regardless of how good your price or proposal is. Most SME bids that lose, lose at this stage on technicalities.

## Stage 2: Functionality (quality) scoring
Where the bid documents set a **functionality** (technical merit) evaluation, bids are scored against published criteria such as **experience, methodology, capacity, qualifications of key personnel, and similar past projects**. Each criterion has a **weight**, and you are scored (often out of 100). The documents state a **minimum threshold** — commonly **60, 70 or 80 points**.

**Crucial rule:** if you score below the functionality threshold, you are **eliminated** and your price is never even considered. Only bids that meet the threshold proceed.

## Stage 3: Price scoring
Qualifying bids are scored on **price** using the PPPFA formula. The lowest acceptable bid gets the **maximum price points** (80 or 90), and other bids are scaled down proportionally:

> Ps = Pmax × (1 − (Bid − Bmin) / Bmin)

where **Pmax** is the maximum price points (80 or 90), **Bid** is the bid being scored and **Bmin** is the lowest acceptable bid. The bigger the gap above the lowest price, the more price points you lose.

## Stage 4: B-BBEE preference points
The remaining points (**20 or 10**) are awarded for **B-BBEE status level**, claimed on the **MBD/SBD 6.2** (Level 1 earns the maximum).

- **80/20 system** — lower-value tenders: 80 price + 20 B-BBEE.
- **90/10 system** — higher-value tenders: 90 price + 10 B-BBEE.

Your **total score = price points + B-BBEE points** (out of 100).

## Stage 5: Award decision and adjudication
The **Bid Evaluation Committee (BEC)** compiles the scores and recommends the **highest-scoring acceptable bidder**. The **Bid Adjudication Committee (BAC)** then independently reviews the recommendation for compliance, fairness and value for money before awarding (or referring upward for approval).

Importantly, the highest score does **not guarantee** the award: the adjudicators may verify that the bidder is **capable and that pricing is realistic**, and there are limited grounds on which a lower-scoring bid can be preferred (which must be **justified objectively** in writing).

## How to use this to win
1. **Clear the compliance gate first.** Build a checklist; missing one form costs you everything.
2. **Beat the functionality threshold convincingly** — address every scored criterion explicitly and provide evidence.
3. **Price sharply but realistically** — unrealistically low prices can be questioned at adjudication.
4. **Maximise B-BBEE** — a better level is "free" points that decide close races.

Knowing exactly how points are allocated lets you invest your bid-writing time where it moves the score — and avoid the technical traps that eliminate most competitors before scoring even begins.`,
  },
];
