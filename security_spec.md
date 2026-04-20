# ZoyaEdge Firestore Security Specification

## 1. Data Invariants
- Only a user can read or write their own profile (RBAC checks email/UID matched).
- Trades must belong to a valid user.
- Broker connections require a validated `syncKey`.
- `webhookSecret` is immutable via client-side updates once set (only server can generate).
- Subscription status is immutable via client-side; strictly managed by server/admins.
- Terminal trade states (archived) cannot be modified.

## 2. The "Dirty Dozen" Payloads (Deny-by-Default Tests)

| # | Attack Vector | Payload | Target Path | Expected Result |
|---|---------------|---------|-------------|-----------------|
| 1 | Identity Spoofing | `{ "userId": "victim_uid", "pair": "EURUSD", ... }` | `/users/attacker_uid/trades/T1` | **PERMISSION_DENIED** (userId must match path) |
| 2 | Privilege Escalation | `{ "role": "admin" }` | `/users/user_uid` | **PERMISSION_DENIED** (role immutable for clients) |
| 3 | Subscription Theft | `{ "subscription": "premium" }` | `/users/user_uid` | **PERMISSION_DENIED** (subscription immutable for clients) |
| 4 | Secret Injection | `{ "webhookSecret": "malicious_secret" }` | `/broker_connections/C1` | **PERMISSION_DENIED** (webhookSecret is server-managed) |
| 5 | Cross-User Read | `GET /users/victim_uid/trades` | `/users/victim_uid/trades` | **PERMISSION_DENIED** (Owner only) |
| 6 | Orphaned Write | `{ "pnl": 100 }` (missing strategy/userId) | `/users/u/trades/t` | **PERMISSION_DENIED** (Schema validation fail) |
| 7 | Buffer Poisoning | `{ "pair": "A".repeat(1024 * 1024) }` | `/users/u/trades/t` | **PERMISSION_DENIED** (Size limit exceeded) |
| 8 | Replay Attack | `{ "timestamp": now - 3601 }` | Webhook API | **PERMISSION_DENIED** (Timestamp check in server/rules) |
| 9 | Field Shadowing | `{ "originalPnl": 100, "hiddenField": "root_kit" }` | `/users/u/trades/t` | **PERMISSION_DENIED** (hasOnlyAllowedFields fail) |
| 10 | Unverified Access | Write trade as user with `email_verified: false` | `/users/u/trades/t` | **PERMISSION_DENIED** (Verified required) |
| 11 | ID Injection | Write trade to document ID `../../system/settings` | `/users/u/trades/t` | **PERMISSION_DENIED** (isValidId check) |
| 12 | State Shortcutting | Change connection status from `error` to `active` | `/broker_connections/C1` | **PERMISSION_DENIED** (Action-based logic fail) |

## 3. Implementation Blueprint
The rules will implement the **Master Gate** pattern with strict logic isolation.

### Key Helpers:
- `isValidUser()`
- `isValidTrade()`
- `isValidBrokerConnection()`
- `isOwner(userId)`
- `isAdmin()`
- `isVerified()`
