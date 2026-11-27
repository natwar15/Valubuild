import test from 'node:test';
import assert from 'node:assert/strict';
import { READINESS_CHECKLIST, checklistEmail } from '../src/server/leadEmail.ts';

test('checklist has the 12 points the sign-up form promises', () => {
  assert.equal(READINESS_CHECKLIST.length, 12);
  const { subject, html, text } = checklistEmail();
  assert.match(subject, /12-point/);
  for (const item of READINESS_CHECKLIST) {
    assert.ok(text.includes(item.title));
  }
  assert.equal((html.match(/<li /g) || []).length, 12);
});
