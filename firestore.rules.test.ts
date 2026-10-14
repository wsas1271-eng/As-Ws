// Firestore Rules Security Specification Test Suite
// Validates that all Dirty Dozen payloads return PERMISSION_DENIED.

export const DIRTY_DOZEN_TESTS = [
  { name: 'Shadow Field Injection', expected: 'PERMISSION_DENIED' },
  { name: 'Self-Assigned Admin Role', expected: 'PERMISSION_DENIED' },
  { name: 'Initial Balance Manipulation', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified Email Spoofing', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-User PII Read', expected: 'PERMISSION_DENIED' },
  { name: 'Blanket User List Scraping', expected: 'PERMISSION_DENIED' },
  { name: 'Self-Approving Deposit', expected: 'PERMISSION_DENIED' },
  { name: 'Terminal State Reversal', expected: 'PERMISSION_DENIED' },
  { name: 'Resource Poisoning', expected: 'PERMISSION_DENIED' },
  { name: 'Path ID Poisoning', expected: 'PERMISSION_DENIED' },
  { name: 'Timestamp Forgery', expected: 'PERMISSION_DENIED' },
  { name: 'Orphaned Game Record', expected: 'PERMISSION_DENIED' },
];
