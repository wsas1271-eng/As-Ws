# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Isolation & PII Protection**: Users in `/users/{userId}` can only read or modify their own profile (`request.auth.uid == userId`), unless the requester is the verified Admin (`wsas1271@gmail.com` or exists in `/admins/{uid}`).
2. **Privilege Escalation Prevention**: Regular users can NEVER create or update their `role` to `'admin'`. Regular users creating their profile must start with `balance == 0` (or up to 50 welcome bonus only if allowed, here strictly `balance == 0` on creation so all real Birr comes from Admin-approved deposits!).
3. **Transaction Integrity**: A transaction in `/transactions/{txId}` must belong to `request.auth.uid`, start in `status == 'pending'`, have a positive `amount` between 10 and 100000 ETB, and can ONLY have its `status` transitioned to `'approved'` or `'rejected'` by an Admin. Once `'approved'` or `'rejected'` (terminal states), standard users cannot alter it.
4. **Game Record Integrity**: A game record in `/games/{gameId}` must reference an existing user document (`exists(/databases/$(database)/documents/users/$(request.auth.uid))`) and strictly match `userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on User Create**: `{ uid: "u1", displayName: "Abebe", ..., isSuperAdmin: true }` -> Rejected by `hasOnly`.
2. **Self-Assigned Admin Role**: `{ uid: "u1", ..., role: "admin" }` by non-admin email -> Rejected by role check.
3. **Initial Balance Manipulation**: `{ uid: "u1", ..., balance: 999999 }` on user create -> Rejected (`balance == 0` enforced on create).
4. **Unverified Email Spoofing**: Admin email with `email_verified: false` -> Rejected by `request.auth.token.email_verified == true`.
5. **Cross-User PII Read**: User `u2` attempting `get(/users/u1)` -> Rejected by `isOwner(userId) || isAdmin()`.
6. **Blanket User List Scraping**: User `u2` attempting `list(/users)` without admin privileges -> Rejected (`allow list: if isAdmin()`).
7. **Self-Approving Deposit**: User `u1` creating or updating `/transactions/tx1` with `status: "approved"` -> Rejected (create requires `status == 'pending'`, only admin can update `/transactions`).
8. **Terminal State Reversal**: Attempting to update a transaction whose existing status is already `'approved'` or `'rejected'` without admin override -> Rejected.
9. **Resource Poisoning (1MB String)**: Submitting `referenceCode` with 10,000 characters -> Rejected by `.size() <= 80`.
10. **Path ID Poisoning**: Document ID with spaces or special characters -> Rejected by `isValidId()`.
11. **Timestamp Forgery**: Client passing arbitrary past/future `createdAt` or `updatedAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
12. **Orphaned Game Record**: Creating `/games/g1` when `/users/$(request.auth.uid)` does not exist -> Rejected by `exists()` check.
