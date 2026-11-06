# Third-party services handling data, and data processing agreements

Technical facts versus legal classification (owner governance ruling, register
D-ar): the table below records which third-party service receives which data,
as the code shows. It does not assert that any of them is a "processor" in the
UK GDPR sense; that classification (processor, joint controller, independent
controller) and the adequacy of each agreement are legal determinations that
wait for the external legal and privacy review mandated before B9 launch
closure. "DPA status" below is a bookkeeping column for James, not a finding.

B7.8 (RENA-072). The processors the code uses, grouped by purpose. The first
three columns are read from the code (`src/lib/privacy/processors.ts`, checked
by its test against the environment variables the code reads, and against the
privacy page). Region, DPA status, renewal and the signed reference are facts
James enters; nothing here is asserted that the repository cannot prove. The
admin compliance page's DPA section holds the live record (`DpaAgreement`).

| Processor        | Purpose                                                                                       | Data categories                                              | Region                 | DPA status     | Signed ref | Renewal |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- | -------------- | ---------- | ------- |
| Stripe           | payments and cleaner payouts                                                                  | name, email, payment and payout details, booking amounts     | James to enter         | James to enter |            |         |
| Railway          | hosting and the application database (europe-west4, Amsterdam, per docs/campaign-handover.md) | all platform data                                            | Netherlands (database) | James to enter |            |         |
| Cloudflare       | network edge; encrypted document storage (R2)                                                 | request metadata; encrypted identity and insurance documents | James to enter         | James to enter |            |         |
| Resend           | transactional email                                                                           | email address, name, booking details in messages             | James to enter         | James to enter |            |         |
| Twilio           | SMS notifications                                                                             | phone number, booking reminders                              | James to enter         | James to enter |            |         |
| Expo             | push notifications to the apps                                                                | push tokens, notification titles                             | James to enter         | James to enter |            |         |
| Sentry           | error reporting (when enabled)                                                                | error traces with identifiers scrubbed                       | James to enter         | James to enter |            |         |
| Groq             | the website chat assistant                                                                    | the text typed to the assistant                              | James to enter         | James to enter |            |         |
| OpenRouteService | travel time and catchment calculation                                                         | postcodes and coordinates                                    | James to enter         | James to enter |            |         |
| Google Places    | area and competitor information for operations                                                | place names and locations, no customer data                  | James to enter         | James to enter |            |         |
| Xero             | accounting                                                                                    | booking amounts, fees and payouts                            | James to enter         | James to enter |            |         |

Review: each row is reviewed at renewal and whenever a processor is added or
removed in code (the test fails when the table and the code disagree).
