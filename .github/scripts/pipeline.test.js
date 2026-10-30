'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./pipeline.js');
const orchestrate = require('./orchestrate.js');

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

// ---------- Helpers for integration-style tests below ----------
//
// These exercise finishBuild() and orchestrate() end to end against a fake
// `github` client, instead of unit-testing extracted pure logic, so the
// real control flow (including the GitHub API calls it makes) is covered.

const OUT_DIR = path.join('.pipeline', 'out');
const OUT_FILES = ['verdict.txt', 'review.md', 'summary.md', 'checks.md', 'reverted.txt'];

function writeOut(files) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT_DIR, name), content);
  }
}

function clearOut() {
  for (const name of OUT_FILES) {
    const p = path.join(OUT_DIR, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/** Seeds a prior bot comment carrying encoded pipeline state, as readState() expects. */
function stateComment(state) {
  return { user: { login: P.BOT_LOGIN }, body: P.encodeState(state) };
}

/** Minimal fake of the octokit `github` object passed into pipeline functions. */
function fakeGithub({ comments = [], branchShas = {} } = {}) {
  const store = { comments: comments.slice(), dispatches: [], labelSets: [], issueLabels: [] };
  let nextId = 1000;

  const rest = {
    issues: {
      createComment: async ({ body }) => {
        const c = { id: nextId++, user: { login: P.BOT_LOGIN }, body };
        store.comments.push(c);
        return { data: c };
      },
      listComments: Symbol('listComments'),
      get: async () => ({ data: { labels: store.issueLabels.map((name) => ({ name })) } }),
      setLabels: async ({ labels }) => {
        store.issueLabels = labels;
        store.labelSets.push(labels);
      },
      createLabel: async () => ({}),
    },
    actions: {
      createWorkflowDispatch: async ({ workflow_id, ref, inputs }) => {
        store.dispatches.push({ workflow_id, ref, inputs });
      },
      listWorkflowRunsForRepo: Symbol('listWorkflowRunsForRepo'),
      cancelRun: async () => {},
    },
    repos: {
      getBranch: async ({ branch }) => {
        if (!(branch in branchShas)) {
          const e = new Error('Not Found');
          e.status = 404;
          throw e;
        }
        return { data: { commit: { sha: branchShas[branch] } } };
      },
    },
    pulls: { list: async () => ({ data: [] }) },
  };

  const paginate = async (fn) => {
    if (fn === rest.issues.listComments) return store.comments;
    if (fn === rest.actions.listWorkflowRunsForRepo) return [];
    return [];
  };

  return { github: { rest, paginate }, store };
}

/** Sets process.env for the duration of fn, then restores exactly what was there before. */
async function withEnv(vars, fn) {
  const keys = Object.keys(vars);
  const saved = {};
  for (const k of keys) saved[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const noopCore = { info: () => {} };

// ---------- finishBuild: the gate that decides what reaches staging ----------

test('finishBuild: advances to staging when checks pass and the review passes', async () => {
  const prev = { stage: 'build', status: 'running', branch: 'idea/7', round: 1 };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = { repo: { owner: 'acme', repo: 'app' } };
  writeOut({ 'verdict.txt': 'PASS', 'checks.md': '| Check | Result |\n|---|---|\n| lint | pass |', 'summary.md': 'Built the thing.' });
  try {
    await withEnv(
      { ISSUE: '7', APPROVER: 'acme', DEFAULT_BRANCH: 'main', BRANCH: 'idea/7', ROUND: '1', VERIFY_OUTCOME: 'success', MAX_REVIEW_ROUNDS: '3' },
      () => P.finishBuild({ github, context })
    );
  } finally {
    clearOut();
  }

  assert.equal(store.dispatches.length, 1);
  assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.staging);
  const state = P.decodeState(store.comments[store.comments.length - 1].body);
  assert.equal(state.stage, 'staging');
  assert.equal(state.status, 'running');
});

test('finishBuild: retries automatically when the review asks for changes and rounds remain', async () => {
  const prev = { stage: 'build', status: 'running', branch: 'idea/7', round: 1 };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = { repo: { owner: 'acme', repo: 'app' } };
  writeOut({
    'verdict.txt': 'CHANGES',
    'checks.md': '| Check | Result |\n|---|---|\n| lint | pass |',
    'review.md': 'Fix the off-by-one in T3.',
    'summary.md': 'Built the thing.',
  });
  try {
    await withEnv(
      { ISSUE: '7', APPROVER: 'acme', DEFAULT_BRANCH: 'main', BRANCH: 'idea/7', ROUND: '1', VERIFY_OUTCOME: 'success', MAX_REVIEW_ROUNDS: '3' },
      () => P.finishBuild({ github, context })
    );
  } finally {
    clearOut();
  }

  assert.equal(store.dispatches.length, 1);
  assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.build);
  assert.equal(store.dispatches[0].inputs.round, '2');
  const state = P.decodeState(store.comments[store.comments.length - 1].body);
  assert.equal(state.stage, 'build');
  assert.equal(state.status, 'running');
  assert.equal(state.round, 2);
});

test('finishBuild: escalates to the owner after the max rounds, instead of retrying forever', async () => {
  const prev = { stage: 'build', status: 'running', branch: 'idea/7', round: 3 };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)], branchShas: { 'idea/7': 'sha-final' } });
  const context = { repo: { owner: 'acme', repo: 'app' } };
  writeOut({
    'verdict.txt': 'CHANGES',
    'checks.md': '| Check | Result |\n|---|---|\n| lint | FAIL |',
    'review.md': 'Still broken.',
    'summary.md': 'Tried again.',
  });
  try {
    await withEnv(
      { ISSUE: '7', APPROVER: 'acme', DEFAULT_BRANCH: 'main', BRANCH: 'idea/7', ROUND: '3', VERIFY_OUTCOME: 'failure', MAX_REVIEW_ROUNDS: '3' },
      () => P.finishBuild({ github, context })
    );
  } finally {
    clearOut();
  }

  assert.equal(store.dispatches.length, 0, 'no further automatic round is dispatched');
  const comment = store.comments[store.comments.length - 1];
  const state = P.decodeState(comment.body);
  assert.equal(state.status, 'awaiting');
  assert.equal(state.bound, 'sha-final');
  assert.match(comment.body, /Reply APPROVED to deploy to staging anyway/);
});

test('finishBuild: does not advance to staging when an agent touched protected paths, even with passing checks', () => {
  const prev = { stage: 'build', status: 'running', branch: 'idea/7', round: 1 };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = { repo: { owner: 'acme', repo: 'app' } };
  writeOut({
    'verdict.txt': 'PASS',
    'checks.md': '| Check | Result |\n|---|---|\n| lint | pass |',
    'summary.md': 'Built the thing.',
    'reverted.txt': 'CLAUDE.md',
  });
  return withEnv(
    { ISSUE: '7', APPROVER: 'acme', DEFAULT_BRANCH: 'main', BRANCH: 'idea/7', ROUND: '1', VERIFY_OUTCOME: 'success', MAX_REVIEW_ROUNDS: '3' },
    () => P.finishBuild({ github, context })
  ).finally(() => {
    clearOut();
    assert.equal(store.dispatches.length, 1);
    assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.build, 'retried, not promoted to staging');
    const state = P.decodeState(store.comments[store.comments.length - 1].body);
    assert.notEqual(state.stage, 'staging');
  });
});

// ---------- orchestrate(): only the approver's comments move the pipeline ----------

test('orchestrate: ignores comments from anyone other than the approver', async () => {
  const prev = { stage: 'build', status: 'awaiting', branch: 'idea/9' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 9, pull_request: undefined },
      comment: { id: 1, user: { login: 'random-user', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.comments.length, 1, 'no new comment posted');
  assert.equal(store.dispatches.length, 0);
});

test('orchestrate: ignores comments from bots', async () => {
  const prev = { stage: 'build', status: 'awaiting', branch: 'idea/9' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 9, pull_request: undefined },
      comment: { id: 2, user: { login: 'acme', type: 'Bot' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.comments.length, 1, 'no new comment posted');
  assert.equal(store.dispatches.length, 0);
});

test('orchestrate: ignores comments posted on a pull request', async () => {
  const prev = { stage: 'build', status: 'awaiting', branch: 'idea/9' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 9, pull_request: { url: 'https://api.github.com/x' } },
      comment: { id: 3, user: { login: 'acme', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.comments.length, 1, 'no new comment posted');
  assert.equal(store.dispatches.length, 0);
});

test("orchestrate: processes the approver's comment case-insensitively and can stop the pipeline", async () => {
  const prev = { stage: 'build', status: 'running', branch: 'idea/9' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 9, pull_request: undefined },
      comment: { id: 4, user: { login: 'ACME', type: 'User' }, body: 'STOP' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.comments.length, 2);
  const state = P.decodeState(store.comments[1].body);
  assert.equal(state.status, 'stopped');
  assert.deepEqual(
    store.labelSets[store.labelSets.length - 1].filter((l) => l.startsWith('stage:')),
    ['stage:stopped']
  );
});

test('orchestrate: refuses to start a pipeline for an idea issue opened by someone other than the approver', async () => {
  const { github, store } = fakeGithub({});
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issues',
    payload: {
      issue: { number: 11, user: { login: 'random-user' }, labels: [{ name: 'idea' }], body: '### Idea\n\nDo a thing', title: 'My idea' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.comments.length, 1);
  assert.match(store.comments[0].body, /Only @acme can start the pipeline/);
  assert.equal(P.decodeState(store.comments[0].body), null, 'no pipeline state was created');
  assert.equal(store.dispatches.length, 0);
});

test('orchestrate: starts the review stage for an idea issue opened by the approver', async () => {
  const { github, store } = fakeGithub({});
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issues',
    payload: {
      issue: { number: 12, user: { login: 'ACME' }, labels: [{ name: 'idea' }], body: '### Idea\n\nDo a thing', title: 'My idea' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.dispatches.length, 1);
  assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.review);
  const state = P.decodeState(store.comments[store.comments.length - 1].body);
  assert.equal(state.stage, 'review');
  assert.equal(state.status, 'running');
});

// ---------- orchestrate(): APPROVED only applies to exactly what was shown ----------

test('orchestrate: re-prompts instead of advancing when the idea was edited after the review was posted', async () => {
  const issueAtReviewTime = { number: 20, title: 'Add a widget', body: '### Idea\n\nAdd a widget', labels: [{ name: 'idea' }] };
  const bound = P.issueHash(issueAtReviewTime);
  const prev = { stage: 'review', status: 'awaiting', bound };
  const editedIssue = { ...issueAtReviewTime, body: '### Idea\n\nAdd a widget, but bigger' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: editedIssue,
      comment: { id: 5, user: { login: 'acme', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.dispatches.length, 0, 'not advanced to plan');
  const comment = store.comments[store.comments.length - 1];
  const state = P.decodeState(comment.body);
  assert.equal(state.stage, 'review');
  assert.match(comment.body, /was edited after this was posted/);
});

test('orchestrate: advances to plan when APPROVED and the idea is unchanged since the review was posted', async () => {
  const issue = { number: 21, title: 'Add a widget', body: '### Idea\n\nAdd a widget', labels: [{ name: 'idea' }] };
  const bound = P.issueHash(issue);
  const prev = { stage: 'review', status: 'awaiting', bound };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)] });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue,
      comment: { id: 6, user: { login: 'acme', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.dispatches.length, 1);
  assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.plan);
  const state = P.decodeState(store.comments[store.comments.length - 1].body);
  assert.equal(state.stage, 'plan');
});

test('orchestrate: re-prompts instead of merging to production when staging got new commits after approval was requested', async () => {
  const prev = { stage: 'staging', status: 'awaiting', branch: 'idea/30', bound: 'sha-old' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)], branchShas: { 'idea/30': 'sha-new' } });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 30, pull_request: undefined },
      comment: { id: 7, user: { login: 'acme', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.dispatches.length, 0, 'not merged to production');
  const comment = store.comments[store.comments.length - 1];
  const state = P.decodeState(comment.body);
  assert.equal(state.stage, 'staging');
  assert.match(comment.body, /branch got new commits/);
});

test('orchestrate: dispatches production when APPROVED and staging has no new commits', async () => {
  const prev = { stage: 'staging', status: 'awaiting', branch: 'idea/31', bound: 'sha-same' };
  const { github, store } = fakeGithub({ comments: [stateComment(prev)], branchShas: { 'idea/31': 'sha-same' } });
  const context = {
    repo: { owner: 'acme', repo: 'app' },
    eventName: 'issue_comment',
    payload: {
      issue: { number: 31, pull_request: undefined },
      comment: { id: 8, user: { login: 'acme', type: 'User' }, body: 'APPROVED' },
      repository: { default_branch: 'main' },
    },
  };
  await withEnv({ APPROVER: 'acme' }, () => orchestrate({ github, context, core: noopCore }));

  assert.equal(store.dispatches.length, 1);
  assert.equal(store.dispatches[0].workflow_id, P.WORKFLOW.production);
});
