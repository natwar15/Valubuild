# Valubuild Firestore Security Specification

## Collections & Access Boundaries
1. `/leads/{leadId}`
   - Public `create` only with strict email format, bounded strings, and server timestamp validation.
   - `read`, `update`, `delete`: denied for all clients.
2. `/users/{userId}`
   - Authenticated owner (`request.auth.uid == userId` with verified email) may `get`, `create`, `update`.
   - `list` and `delete`: denied.
   - Immutable `uid`; strict `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)` validation.
3. `/users/{userId}/snapshots/{snapshotId}`
   - Authenticated owner (`request.auth.uid == userId` with verified email) may `get`, `list`, `create`, `update`, `delete`.
   - `list` verifies `resource.data.userId == request.auth.uid`.
   - Strictly validates `snapshotMonth` (`YYYY-MM`), `buyerReadinessScore` (`0..100`), `mv1GoodwillGbp` (`>= 0`), `ypMultiple` (`0..20`), and `updatedAt == request.time`.
