# Security Specification for IWA BOT Cloud Firestore

## 1. Data Invariants & Zero-Trust Architecture
1. **Server-Authoritative Game & Economy**: Direct client writes to `/balances/{userId}` and `/transactions/{txId}` are strictly forbidden. All balance updates must occur through validated backend API transactions with anti-cheat checks.
2. **Identity Integrity**: Normal users cannot manipulate their roles, balance amounts, tap counts, or level status via client SDKs.
3. **Admin Privilege Isolation**: Only authenticated Firebase users who have verified email and exist in `/admin_users/{uid}` (or bootstrapped superadmin `iwatech1285@gmail.com`) have administrative read and write privileges.
4. **Denial of Wallet Protection**: Path variables and strings must conform to strict length and regex guards (`isValidId`).
5. **PII and Ledger Isolation**: Public read access to user ledgers and withdrawal records is completely barred.

## 2. The "Dirty Dozen" Malicious Payloads Tested
1. Direct client increment of coins in `/balances/telegram_12345` with `{ coins: 999999 }`.
2. Direct client fabrication of a completed transaction in `/transactions/tx_fake`.
3. Client setting `role: "superadmin"` in `/admin_users/attacker_uid`.
4. Unauthorized client modification of `/settings/app_config` to alter energy regeneration rate.
5. Path poisoning attack with oversized document ID (`>128` characters) in `/users/`.
6. Unauthenticated read of user withdrawal records in `/withdrawals/`.
7. Client injection of shadow fields (`{ isSuperAdmin: true }`) into user profiles.
8. Unverified email claiming admin privileges without `email_verified == true`.
9. Client directly writing to `/task_completions/` to bypass verification.
10. Client deleting audit logs from `/audit_logs/`.
11. Client forging daily reward claim record in `/daily_rewards/`.
12. Blanket query scraping of user balances without ownership restrictions.

All 12 payloads are strictly evaluated to return `PERMISSION_DENIED`.
