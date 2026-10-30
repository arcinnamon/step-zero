'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./pipeline.js');

test('keywords match exactly', () => {
  for (const s of ['APPROVED', 'approved', ' Approved! ', 'APPROVED.', '**APPROVED**']) {
    assert.equal(P.parseKeyword(s), 'APPROVED', s);
  }
  for (const s of ['stop', 'STOP', 'Stop.']) assert.equal(P.parseKeyword(s), 'STOP', s);
  for (const s of ['approved, thanks', 'approved but change X', 'not approved', 'stop it', '']) {
    assert.equal(P.parseKeyword(s), null, s);
  }
});

test('near-miss approvals are flagged', () => {
  assert.equal(P.looksLikeApproval('approved but rename it'), true);
  assert.equal(P.looksLikeApproval('Approve, with one change'), true);
  assert.equal(P.looksLikeApproval('APPROVED'), false);
  assert.equal(P.looksLikeApproval('please change the title'), false);
});

test('state round-trips through a comment', () => {
  const s = { stage: 'plan', status: 'awaiting', summary: 'has --> and <!-- inside' };
  const body = `hello\n\n${P.encodeState(s)}`;
  assert.deepEqual(P.decodeState(body), s);
  assert.equal(P.stripMarker(body), 'hello');
});

test('awaiting: APPROVED advances, anything else revises', () => {
  assert.deepEqual(P.decide({ stage: 'review', status: 'awaiting' }, 'approved'), { type: 'advance', stage: 'plan' });
  assert.deepEqual(P.decide({ stage: 'staging', status: 'awaiting' }, 'APPROVED'), { type: 'advance', stage: 'production' });
  assert.equal(P.decide({ stage: 'plan', status: 'awaiting' }, 'drop the CSV export').stage, 'plan');
  assert.equal(P.decide({ stage: 'staging', status: 'awaiting' }, 'button is too small').stage, 'build');
  assert.match(P.decide({ stage: 'plan', status: 'awaiting' }, 'approved but X').note, /Treated as feedback/);
});

test('running: only STOP does anything', () => {
  assert.equal(P.decide({ stage: 'build', status: 'running' }, 'APPROVED').type, 'reply');
  assert.equal(P.decide({ stage: 'build', status: 'running' }, 'feedback').type, 'reply');
  assert.equal(P.decide({ stage: 'build', status: 'running' }, 'STOP').type, 'stop');
});

test('stopped: feedback resumes, APPROVED explains', () => {
  const fromAwaiting = { stage: 'staging', status: 'stopped', stoppedFrom: 'staging', stoppedStatus: 'awaiting' };
  assert.deepEqual(P.decide(fromAwaiting, 'make it blue'), { type: 'dispatch', stage: 'build' });
  const fromFailure = { stage: 'staging', status: 'stopped', stoppedFrom: 'staging', stoppedStatus: 'failed' };
  assert.deepEqual(P.decide(fromFailure, 'retry'), { type: 'dispatch', stage: 'staging' });
  assert.equal(P.decide(fromFailure, 'APPROVED').type, 'reply');
  assert.equal(P.decide(fromFailure, 'STOP').type, 'reply');
});

test('done ignores everything', () => {
  assert.equal(P.decide({ stage: 'done', status: 'done' }, 'APPROVED').type, 'reply');
});

test('idea issues are detected by label or template heading', () => {
  assert.equal(P.isIdeaIssue({ labels: [{ name: 'idea' }], body: '' }), true);
  assert.equal(P.isIdeaIssue({ labels: [], body: '### Idea\n\nA thing' }), true);
  assert.equal(P.isIdeaIssue({ labels: [], body: 'bug report' }), false);
});
