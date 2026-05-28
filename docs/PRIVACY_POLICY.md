# Privacy Policy

**Effective Date:** May 28, 2026
**Last Updated:** May 28, 2026

This Privacy Policy describes how 2747902 Alberta Ltd. ("**Represent**," "**we**," "**us**," or "**our**") collects, uses, shares, and protects personal information when you use our mobile application "Represent Vote" (the "**App**"), the website at representportal.com (the "**Site**"), and related services (collectively, the "**Service**").

We are based in Alberta, Canada. The Service is operated in compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA), Alberta's Personal Information Protection Act (PIPA), the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA/CPRA), and other applicable privacy laws.

If you do not agree with any part of this Policy, do not use the Service.

---

## 1. Information We Collect

### 1.1 Information You Provide Directly

| Category | Examples | Purpose |
|---|---|---|
| Account information | Name, email, password (hashed), profile photo | Account creation, sign-in, communication |
| Authentication credentials | Google or Apple ID tokens (when using social sign-in) | OAuth login |
| Identity verification data | Government-issued ID image, passport, proof-of-address document, selfie, date of birth, document expiry, document number | Identity verification and citizenship verification through our KYC provider Didit |
| Geographic information | Country, state/province, city (derived from verification documents) | Geo-restricted proposal eligibility |
| User-generated content | Proposals you create (title, description, images), votes you cast, comments, reports | Core service functionality |
| Payment information | Apple In-App Purchase receipts, Stripe payment tokens, billing address | Processing subscriptions and one-time purchases |
| Communications | Support emails, in-app reports, feedback | Customer support and moderation |
| Organization data | Organization name, member roster, invite codes, voting records (for organization administrators) | Org subscription management |

### 1.2 Information Collected Automatically

| Category | Examples | Purpose |
|---|---|---|
| Device information | Device model, OS version, app version, language, time zone | Compatibility, debugging, fraud prevention |
| Usage data | Pages viewed, features used, voting activity, session duration | Service improvement, analytics |
| Diagnostic data | Crash logs, error traces, performance metrics | Bug detection (via Sentry) |
| Approximate location | Inferred from IP address | Regional service delivery, fraud detection |
| Cookies and similar technologies (web only) | Session cookies, authentication tokens | Maintaining your sign-in session |

The App does **not** include third-party analytics or advertising SDKs. We do not track you across other companies' apps or websites. No Apple App Tracking Transparency (ATT) prompt is required.

### 1.3 Information From Third Parties

| Source | Information | Purpose |
|---|---|---|
| Didit (KYC provider) | Verification decision, extracted document fields (name, address, document type, citizenship country, date of birth) | Verification status, geographic eligibility, citizen-only proposal eligibility |
| Apple App Store / Google Play | In-app purchase receipts, subscription status | Subscription entitlement |
| Stripe | Payment status, refund events | Subscription management on web/Android |
| Resend | Email delivery status | Reliable transactional email |

### 1.4 Children's Information

The Service is not directed at children under the age of 17. We do not knowingly collect personal information from anyone under 17. Identity verification requires a government-issued ID, which functionally restricts use to adults. If you believe a child has provided information to us, contact privacy@representvote.com and we will delete it promptly.

---

## 2. How We Use Your Information

We use personal information for the following purposes:

- **To provide the Service:** account creation, authentication, voting, proposal creation, organization management, identity verification, subscription processing.
- **To verify your identity and eligibility:** confirm you are a real, unique adult; determine your geographic eligibility for region-restricted proposals; determine citizenship for citizens-only proposals.
- **To process payments:** charge Apple IAP and Stripe subscriptions, handle refunds and disputes, prevent fraud.
- **To enable AI-assisted features:** Our "Sentinel" feature submits user-provided policy or governance document text to OpenAI's API for analysis. We do not retain Sentinel inputs beyond the immediate request unless you explicitly save the analysis result.
- **To moderate user-generated content:** review reports, apply the profanity filter, auto-hide proposals that meet the report threshold, enforce our Terms of Service.
- **To communicate with you:** send transactional emails (verification, receipts, invite confirmations, organization notifications), respond to support requests, send service announcements.
- **To send push notifications** (with your permission): notify you of new proposals in your region, voting deadlines, and organization activity.
- **To improve the Service:** understand which features are used, debug issues, plan new features.
- **To protect the Service and our users:** detect and prevent fraud, abuse, spam, multi-account registration, and violations of our Terms of Service.
- **To comply with legal obligations:** retain records required by tax, KYC, and dispute-resolution laws; respond to lawful requests from government and law enforcement.

### Legal Bases (GDPR / EEA / UK users)

We rely on the following legal bases under the GDPR:

- **Contract:** to deliver the Service you signed up for (Art. 6(1)(b)).
- **Consent:** for push notifications, AI document analysis (Sentinel), and optional features you explicitly enable (Art. 6(1)(a)).
- **Legitimate interests:** for fraud prevention, security, debugging, and service improvement, balanced against your privacy rights (Art. 6(1)(f)).
- **Legal obligation:** for tax records, KYC retention, and lawful disclosure (Art. 6(1)(c)).

For identity verification data (a special category under some laws when it includes biometric matching), we rely on your **explicit consent** at the time you initiate verification.

---

## 3. How We Share Your Information

We **do not sell** your personal information. We do not share it for cross-context behavioral advertising. We share it only in the following limited circumstances:

### 3.1 Service Providers

| Provider | Purpose | Data shared | Location |
|---|---|---|---|
| Didit | Identity and citizenship verification | Name, photo of ID, selfie, proof of address, document number | Spain / EU |
| Stripe | Payment processing (web/Android subscriptions) | Payment token, billing info, email | United States |
| Apple | In-App Purchase processing | Apple ID, transaction data | United States |
| OpenAI | Sentinel AI document analysis | Document text you submit for analysis | United States |
| Resend | Transactional email delivery | Recipient email, message content | United States |
| Replit (hosting) | Web app and API hosting | All Service data we hold | United States |
| Neon (database) | PostgreSQL database hosting | All Service data we hold | United States |
| Sentry (errors) | Crash and error reporting | Diagnostic logs, partial request data | United States |
| Base / Coinbase (blockchain) | Smart wallet and vote-token transactions | Public wallet addresses, transaction hashes | Public blockchain |

Each provider is bound by contractual data protection terms and processes data only on our instructions.

### 3.2 Organizations You Join

If you join an organization on the Service, the organization's administrators can see your name, email, verification status, citizenship status, votes you cast within that organization, and roster membership. Organizations on the Plus tier and above can request a tamper-evident audit log export which may include your voter identity unless you have opted into anonymous voting.

### 3.3 On-Chain Voting (Public Blockchain)

Yes/no votes on global proposals are recorded as token transactions on the Base blockchain. Blockchain transactions are public and permanent. They reference your smart-wallet address (a pseudonymous identifier generated by us at sign-up) and do not directly include your name, email, or document data. However, sophisticated analysis can sometimes correlate wallet activity with off-chain identity, so do not assume blockchain participation is anonymous.

### 3.4 Legal and Safety

We may disclose information when we reasonably believe disclosure is required by law, necessary to enforce our Terms of Service, or necessary to protect the rights, property, or safety of Represent, our users, or the public.

### 3.5 Business Transfers

If we are involved in a merger, acquisition, sale of assets, or bankruptcy, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.

### 3.6 With Your Consent

We may share information for purposes beyond those listed above only with your express consent.

---

## 4. International Data Transfers

We are based in Canada, but our service providers operate in the United States, the European Economic Area, and other regions. By using the Service, you understand that your personal information may be transferred to and processed in countries with privacy laws that differ from your home country.

For transfers from the EEA, UK, or Switzerland, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, or other lawful transfer mechanisms.

---

## 5. Data Retention

We retain personal information for as long as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements.

| Data | Retention period |
|---|---|
| Active account data | While your account is active |
| Identity verification records | 7 years after account deletion (for KYC compliance) |
| Voting records | 7 years (for audit and dispute resolution) |
| Payment records | 7 years (for tax compliance) |
| Push notification opt-in | While your account is active |
| Crash and diagnostic logs | 90 days |
| Email support correspondence | 3 years |
| Soft-deleted account data | PII anonymized immediately on deletion; verification artifacts retained per KYC rules above |

When you delete your account through Profile → Settings & Privacy → Delete Account, we anonymize your personally identifying fields (name, email, document references, profile image) immediately. Verification records retained for legal purposes are de-linked from your account identifier where technically possible.

---

## 6. Your Privacy Rights

Depending on where you live, you may have the following rights regarding your personal information:

- **Access:** request a copy of the personal information we hold about you.
- **Correction:** request that we correct inaccurate or incomplete information.
- **Deletion:** request that we delete your personal information, subject to legal retention obligations described above. You can also delete your account directly in the App via Profile → Settings & Privacy → Delete Account.
- **Portability:** request a copy of your information in a portable, machine-readable format.
- **Objection / Restriction:** object to or restrict certain processing.
- **Withdraw consent:** withdraw consent for processing that relies on consent (e.g., disable push notifications in your device settings).
- **Lodge a complaint** with your local data protection authority. In Canada, this is the Office of the Privacy Commissioner of Canada (priv.gc.ca).

To exercise any of these rights, email privacy@representvote.com from the email address on your account. We will respond within 30 days (or sooner where required by law). We may require identity verification before fulfilling certain requests.

### California-Specific Rights (CCPA/CPRA)

California residents have additional rights including the right to know what categories of personal information we collect, the right to opt out of "sales" or "sharing" of personal information (we do neither), the right to limit the use of sensitive personal information, and the right to non-discrimination. To exercise these rights, contact privacy@representvote.com.

---

## 7. Data Security

We use industry-standard administrative, technical, and physical safeguards to protect your information, including:

- TLS 1.2+ encryption in transit for all API and web traffic
- Encryption at rest for our database (Neon Postgres)
- Hashed passwords (bcrypt or equivalent)
- HMAC-signed authentication tokens
- HMAC-signed organization audit log exports
- Role-based access controls on internal systems
- Apple In-App Purchase and Stripe handle payment card data on their PCI-compliant infrastructure; we never store full card numbers

No security system is perfect. We cannot guarantee absolute security. If we become aware of a security incident affecting your personal information, we will notify you and the appropriate authorities as required by law.

---

## 8. Cookies and Similar Technologies (Site Only)

Our Site uses essential first-party cookies to keep you signed in and to remember your preferences. We do not use third-party advertising cookies or cross-site tracking. The App does not use cookies; it stores authentication tokens in secure device storage.

---

## 9. Third-Party Links and Content

The Service may contain links to third-party websites, applications, or services (for example, links from a proposal description). We are not responsible for the privacy practices of those third parties. Review their policies before providing them any information.

---

## 10. Changes to This Policy

We may update this Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page. If the changes are material, we will notify you through the App or by email before the changes take effect. Your continued use of the Service after changes take effect constitutes acceptance of the updated Policy.

---

## 11. Contact Us

**Privacy questions, requests, or complaints:**
privacy@representvote.com

**General support:**
support@representvote.com

**Mailing address:**
2747902 Alberta Ltd.
[Insert street address]
Alberta, Canada
[Insert postal code]

**Data Protection Officer (for EEA/UK requests):**
[Insert DPO name and email if appointed; otherwise reference privacy@representvote.com]

---

## Appendix: Privacy Nutrition Labels (Apple App Store)

For the App Store's privacy questionnaire, the following data categories are collected and **linked to your identity** but **not used for tracking** across third-party apps or websites:

- Contact Info: email, name
- User Content: photos (ID documents, profile picture), audio (Sentinel voice-to-text if applicable), user-generated proposals
- Identifiers: user ID, device ID
- Location: coarse location (country/state/city from verification documents)
- Sensitive Info: government ID data, proof-of-address data
- Financial Info: purchase history
- Usage Data: product interaction
- Diagnostics: crash data, performance data
