# B5 preview publishes (James's batch run, 23 Oct, item 4)

Every shell piece is published to the PREVIEW channel only, each on its own
EAS branch `preview-<piece>`, from exactly its commit on main. Nothing is on
a production channel. The preview channel of each app points at one branch at
a time; the device session repoints it per walk (`eas channel:edit preview
--branch <branch>` or the expo.dev dashboard, Channels, preview).

The one change to each commit's tree: `extra.baseUrl` in that app's
`app.json`, `https://www.renacleaning.co.uk` to
`https://rena-web-staging-staging.up.railway.app` (staging). EAS records the
commit with a `*` for that edit and the untracked packages symlink.

| Piece | App | From | EAS branch | Update group |
|---|---|---|---|---|
| Pro-1 | rena-pro 1.0.3 | 792f878 | preview-pro-1 | 4691c572-1c00-434e-887b-7cfb63bb4334 |
| Pro-2 | rena-pro 1.0.3 | 26d505c | preview-pro-2 | c63ac560-d7ab-42b1-86f8-8c92a15c04c7 |
| Pro-3 | rena-pro 1.0.3 | 1e3bd67 | preview-pro-3 | 8276a423-7d5f-4fd7-920f-c51a07f6582a |
| Pro-4 | rena-pro 1.0.3 | 5c63713 (Pro-4 with its nav core) | preview-pro-4 | 27ff372d-d9b3-48e4-8556-fa42ca047a47 |
| Pro-5 | rena-pro 1.0.3 | 958f34c | preview-pro-5 | f9addf6d-745e-4cea-95cc-2b4632e2c35d |
| Pro-4 final (main) | rena-pro 1.0.3 | 5b4ae89 (shells identical to main 930cfa7) | preview-pro-4-final | e95422bc-560d-4855-8ec0-26ccec0faed1 |
| Customer-1 | rena 1.0.1 | 77e0af2 | preview-customer-1 | bb729430-d364-4816-8019-d6f520097b13 |
| Customer-2 | rena 1.0.1 | 74a6afb | preview-customer-2 | 5152cf84-14cd-4f69-bb50-570390761d03 |
| Customer-3 | rena 1.0.1 | 19f76d0 | preview-customer-3 | 421d57a4-2dd5-4bba-a083-a159385c80e6 |
| Customer-4 | rena 1.0.1 | 5c63713 | preview-customer-4 | 64115d0c-996d-4f51-9c94-dab79b1e5a48 |
| Customer-5 | rena 1.0.1 | 1814367 | preview-customer-5 | 8d812781-225c-4a71-a9c5-a58ebf49e2ba |
| Customer-4 final (main) | rena 1.0.1 | 5b4ae89 | preview-customer-4-final | 340a6a22-410f-41af-afb6-0e5b32e67654 |

Ordering note: the Pro-4 and Customer-4 amendments (the capability token,
e066f3b, and the redemption state, 5b4ae89) landed after Pro-5 and
Customer-5 in history, so "4 final" is published last, from the commit whose
shells equal main.

Evidence per piece (packs/<piece>.txt, produced by publish-piece.sh at that
exact commit): shell-nav tests, the app's typecheck, the STRING-LAW
cooked-parse of the delivered injection (cooked-proof.ts: the literals
cooked by the TypeScript compiler, concatenated as the shell does, parsed by
new Function, lone backslash sweep), the version and runtime, the config
difference, the EAS update group.

Owed at the device session, by name:
- Pro-2 and Customer-2: the injection timing proof (the dressed-arrival
  timing table for the onOpenWindow injection), on the device.
- Pro-4 and Customer-4: the measured redemption timeout (D-aj item 3), set
  from the device timing walk, timeout to FAILED and native login.
- Customer-1 notification taps: owed at Customer-5 (customer push is off
  until Customer-5).
- Every piece: its device walk on both platforms (iOS needs the internal
  preview build, blocked on the Apple signing step).
