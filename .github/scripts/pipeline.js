'use strict';
/**
 * Shared pipeline logic, loaded by actions/github-script steps.
 *
 * State lives in a hidden marker inside each bot comment on the idea issue.
 * The newest marker from github-actions[bot] wins. Labels mirror the state so
 * the issue list works as a dashboard. Only two keywords exist: APPROVED and
 * STOP. Any other comment from the approver is feedback.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOT_LOGIN = 'github-actions[bot]';
const CTX_DIR = '.pipeline/ctx';
const OUT_DIR = '.pipeline/out';
const MARKER_RE = /<!-- pipeline-state:([A-Za-z0-9+/=]+) -->/;

const LABEL = {
  review: 'Idea review',
  plan: 'Plan',
  build: 'Build',
  staging: 'Staging',
  production: 'Production',
  done: 'Done',
};
const NEXT = { review: 'plan', plan: 'build', build: 'staging', staging: 'production' };
const WORKFLOW = {
  review: 'stage-review.yml',
  plan: 'stage-plan.yml',
  build: 'stage-build.yml',
  staging: 'stage-staging.yml',
  production: 'stage-production.yml',
};
const PIPELINE_LABELS = [
  { name: 'idea', color: '0e8a16', description: 'Starts the pipeline' },
  { name: 'needs-you', color: 'd93f0b', description: 'Waiting for your reply' },
  { name: 'stage:review', color: 'c5def5', description: 'Pipeline stage' },
  { name: 'stage:plan', color: 'c5def5', description: 'Pipeline stage' },
  { name: 'stage:build', color: 'c5def5', description: 'Pipeline stage' },
  { name: 'stage:staging', color: 'c5def5', description: 'Pipeline stage' },
  { name: 'stage:production', color: 'c5def5', description: 'Pipeline stage' },
  { name: 'stage:done', color: '0e8a16', description: 'Pipeline finished' },
  { name: 'stage:stopped', color: 'b60205', description: 'Pipeline paused' },
];

function maxRounds() {
  const n = Number(process.env.MAX_REVIEW_ROUNDS);
  return Number.isInteger(n) && n > 0 ? n : 3;
}

// ---------- Pure helpers (unit tested) ----------

/** Exact keyword match. Case-insensitive; ignores surrounding whitespace, punctuation and markdown emphasis. */
function parseKeyword(body) {
  const t = String(body || '')
    .trim()
    .replace(/^[\s*_`]+/, '')
    .replace(/[\s.!,;:*_`]+$/, '')
    .toUpperCase();
  if (t === 'APPROVED') return 'APPROVED';
  if (t === 'STOP') return 'STOP';
  return null;
}

/** "approved, but change X" style replies: treated as feedback, with a note. */
function looksLikeApproval(body) {
  return parseKeyword(body) === null && /^[\W_]*approved?\b/i.test(String(body || ''));
}

function encodeState(state) {
  return `<!-- pipeline-state:${Buffer.from(JSON.stringify(state)).toString('base64')} -->`;
}

function decodeState(body) {
  const m = String(body || '').match(MARKER_RE);
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function stripMarker(body) {
  return String(body || '').replace(MARKER_RE, '').trim();
}

function feedbackTarget(stage) {
  // Feedback on staging means "change the code", so it goes back to build.
  return stage === 'staging' ? 'build' : stage;
}

function resumeTarget(state) {
  return state.stoppedStatus === 'awaiting' ? feedbackTarget(state.stoppedFrom) : state.stoppedFrom;
}

/** Decide what an approver comment means, given the current state. */
function decide(state, body) {
  const kw = parseKeyword(body);
  const label = LABEL[state.stage] || state.stage;

  if (state.status === 'done') {
    return { type: 'reply', text: 'This idea is finished. Open a new Idea issue for anything else.' };
  }
  if (kw === 'STOP') {
    if (state.status === 'stopped') {
      return { type: 'reply', text: 'Already stopped. Reply with anything else to resume.' };
    }
    return { type: 'stop' };
  }
  if (state.status === 'stopped') {
    if (kw === 'APPROVED') {
      return {
        type: 'reply',
        text: 'The pipeline is stopped. Reply with anything other than APPROVED or STOP to resume. Your reply is passed along as feedback.',
      };
    }
    return { type: 'dispatch', stage: resumeTarget(state) };
  }
  if (state.status === 'running') {
    return {
      type: 'reply',
      text: `Still working on ${label}. I'll post here when it's ready. Reply STOP to pause.`,
    };
  }
  // awaiting
  if (kw === 'APPROVED') {
    return { type: 'advance', stage: NEXT[state.stage] };
  }
  return {
    type: 'dispatch',
    stage: feedbackTarget(state.stage),
    note: looksLikeApproval(body)
      ? 'Treated as feedback, not approval. Reply APPROVED alone to proceed.'
      : null,
  };
}

function runningText(stage, round) {
  const what = {
    review: 'Reviewing the idea.',
    plan: 'Writing the plan.',
    build: `Building, round ${round} of ${maxRounds()}.`,
    staging: 'Deploying to staging.',
    production:
      'Merging and deploying to production. If GitHub asks you to approve the production deployment, tap Approve.',
  }[stage];
  return `${what} I'll post here when it's ready. Reply STOP to pause.`;
}

function formatPrompt(title, body, action) {
  return [
    `**Stage: ${title}**`,
    String(body || '').trim(),
    `${action}\nReply with anything else to revise, or STOP to pause.`,
  ].join('\n\n');
}

function truncate(s, n) {
  s = String(s || '').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function issueHash(issue) {
  return crypto
    .createHash('sha256')
    .update(`${issue.title}\n${issue.body || ''}`)
    .digest('hex')
    .slice(0, 16);
}

function readOut(name) {
  const p = path.join(OUT_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
}

function isIdeaIssue(issue) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  return labels.includes('idea') || /^###\s+Idea\s*$/m.test(issue.body || '');
}

// ---------- GitHub client wrapper ----------

function client(github, owner, repo) {
  const r = { owner, repo };
  return {
    async comment(n, body) {
      const { data } = await github.rest.issues.createComment({ ...r, issue_number: n, body });
      return data;
    },
    async postState(n, text, state) {
      const s = { ...state, updatedAt: new Date().toISOString() };
      return this.comment(n, `${text}\n\n${encodeState(s)}`);
    },
    async listComments(n) {
      return github.paginate(github.rest.issues.listComments, { ...r, issue_number: n, per_page: 100 });
    },
    async readState(n) {
      const comments = await this.listComments(n);
      for (let i = comments.length - 1; i >= 0; i--) {
        const c = comments[i];
        if (c.user && c.user.login === BOT_LOGIN) {
          const s = decodeState(c.body);
          if (s) return s;
        }
      }
      return null;
    },
    async thread(n, approver) {
      const comments = await this.listComments(n);
      const parts = [];
      for (const c of comments) {
        const login = (c.user && c.user.login) || '';
        if (login === BOT_LOGIN) parts.push(`**Pipeline:**\n${stripMarker(c.body)}`);
        else if (login.toLowerCase() === approver) parts.push(`**Owner:**\n${c.body}`);
      }
      return parts.join('\n\n---\n\n') || 'No comments yet.';
    },
    async ensureLabels() {
      for (const l of PIPELINE_LABELS) {
        try {
          await github.rest.issues.createLabel({ ...r, ...l });
        } catch (e) {
          if (e.status !== 422) throw e; // 422 = already exists
        }
      }
    },
    async setLabels(n, stage, status) {
      const { data: issue } = await github.rest.issues.get({ ...r, issue_number: n });
      const keep = issue.labels
        .map((l) => l.name)
        .filter((name) => !name.startsWith('stage:') && name !== 'needs-you');
      const stageLabel = status === 'stopped' ? 'stage:stopped' : `stage:${stage}`;
      const add = [stageLabel];
      if (status === 'awaiting' || status === 'stopped') add.push('needs-you');
      await github.rest.issues.setLabels({ ...r, issue_number: n, labels: [...keep, ...add] });
    },
    async dispatch(workflow, ref, inputs) {
      await github.rest.actions.createWorkflowDispatch({ ...r, workflow_id: workflow, ref, inputs });
    },
    async cancelRuns(n) {
      const title = new RegExp(`#${n}$`);
      for (const status of ['queued', 'in_progress', 'waiting', 'pending', 'requested']) {
        const runs = await github.paginate(github.rest.actions.listWorkflowRunsForRepo, {
          ...r,
          status,
          per_page: 100,
        });
        for (const run of runs) {
          if (/\.github\/workflows\/stage-/.test(run.path || '') && title.test(run.display_title || '')) {
            await github.rest.actions.cancelRun({ ...r, run_id: run.id }).catch(() => {});
          }
        }
      }
    },
    async branchSha(branch) {
      try {
        const { data } = await github.rest.repos.getBranch({ ...r, branch });
        return data.commit.sha;
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
    async findPr(branch) {
      const { data } = await github.rest.pulls.list({ ...r, head: `${owner}:${branch}`, state: 'all' });
      return data[0] || null;
    },
  };
}

// ---------- Stage helpers used by workflows ----------

function env(context) {
  const { owner, repo } = context.repo;
  return {
    owner,
    repo,
    n: Number(process.env.ISSUE),
    approver: (process.env.APPROVER || owner).toLowerCase(),
    defaultBranch: process.env.DEFAULT_BRANCH || 'main',
    branch: process.env.BRANCH || `idea/${process.env.ISSUE}`,
  };
}

function stopped(state) {
  return state && state.status === 'stopped';
}

async function startStage({ api, n, ref, stage, prev, feedbackId, note, round }) {
  const state = { ...prev, stage, status: 'running', round: round || 1 };
  delete state.stoppedFrom;
  delete state.stoppedStatus;
  const text = [note, `**Stage: ${LABEL[stage]}**`, runningText(stage, state.round)]
    .filter(Boolean)
    .join('\n\n');
  await api.postState(n, text, state);
  await api.setLabels(n, stage, 'running');
  const inputs = { issue: String(n), feedback_comment_id: feedbackId ? String(feedbackId) : '' };
  if (stage === 'build') inputs.round = String(state.round);
  await api.dispatch(WORKFLOW[stage], ref, inputs);
}

async function prepareContext({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  fs.mkdirSync(CTX_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (f, s) => fs.writeFileSync(path.join(CTX_DIR, f), s);

  const { data: issue } = await github.rest.issues.get({ owner: e.owner, repo: e.repo, issue_number: e.n });
  write('issue.txt', String(e.n));
  write('default_branch.txt', e.defaultBranch);
  write('idea.md', `# ${issue.title}\n\n${issue.body || ''}`);
  write('thread.md', await api.thread(e.n, e.approver));

  let feedback = 'None.';
  if (process.env.FEEDBACK_ID) {
    const { data: c } = await github.rest.issues.getComment({
      owner: e.owner,
      repo: e.repo,
      comment_id: Number(process.env.FEEDBACK_ID),
    });
    const login = c.user.login;
    // Only the approver's words or the pipeline's own notes ever reach an agent.
    if (login.toLowerCase() === e.approver || login === BOT_LOGIN) feedback = stripMarker(c.body);
  }
  write('feedback.md', feedback);

  const state = await api.readState(e.n);
  write('state.json', JSON.stringify(state || {}, null, 2));
  return state;
}

async function finishReview({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  if (stopped(prev)) return;
  const summary = readOut('summary.md');
  if (!summary) throw new Error('Reviewer wrote no summary.');
  const { data: issue } = await github.rest.issues.get({ owner: e.owner, repo: e.repo, issue_number: e.n });
  const state = { ...prev, stage: 'review', status: 'awaiting', bound: issueHash(issue) };
  await api.postState(e.n, formatPrompt('Idea review done', summary, 'Reply APPROVED to start planning.'), state);
  await api.setLabels(e.n, 'review', 'awaiting');
}

async function finishPlan({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  if (stopped(prev)) return;
  const summary = readOut('summary.md');
  if (!summary) throw new Error('Planner wrote no summary.');

  let pr = await api.findPr(e.branch);
  if (!pr) {
    const title = truncate((readOut('pr-title.txt') || `Idea #${e.n}`).split('\n')[0], 80);
    const params = {
      owner: e.owner,
      repo: e.repo,
      head: e.branch,
      base: e.defaultBranch,
      title,
      body: `Part of #${e.n}. Built by the pipeline.\n\nPlan: \`docs/ideas/${e.n}/plan.md\``,
    };
    try {
      pr = (await github.rest.pulls.create({ ...params, draft: true })).data;
    } catch {
      pr = (await github.rest.pulls.create(params)).data; // drafts unavailable on some plans
    }
  }
  const sha = await api.branchSha(e.branch);
  const reverted = readOut('reverted.txt');
  const body = [
    summary,
    `Full plan: docs/ideas/${e.n}/plan.md in #${pr.number}`,
    reverted ? `Note: undid edits to protected paths (${reverted}).` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const state = { ...prev, stage: 'plan', status: 'awaiting', branch: e.branch, pr: pr.number, bound: sha };
  await api.postState(e.n, formatPrompt('Plan ready', body, 'Reply APPROVED to start building.'), state);
  await api.setLabels(e.n, 'plan', 'awaiting');
}

async function finishBuild({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  if (stopped(prev)) return;

  const round = Number(process.env.ROUND || 1);
  const verifyOk = process.env.VERIFY_OUTCOME === 'success';
  const verdict = readOut('verdict.txt').toUpperCase().startsWith('PASS') ? 'PASS' : 'CHANGES';
  const review = readOut('review.md') || 'The reviewer left no notes.';
  const summary = readOut('summary.md') || 'No build summary was written.';
  const checks = readOut('checks.md');
  const reverted = readOut('reverted.txt');

  const base = { ...prev, stage: 'build', branch: e.branch, summary: truncate(summary, 1200), checks, round };

  if (verdict === 'PASS' && verifyOk && !reverted) {
    await startStage({
      api,
      n: e.n,
      ref: e.defaultBranch,
      stage: 'staging',
      prev: base,
      note: `Build passed checks and review in round ${round}.`,
    });
    return;
  }

  const reasons = [];
  if (!verifyOk) reasons.push('checks failed');
  if (verdict !== 'PASS') reasons.push('the reviewer asked for changes');
  if (reverted) reasons.push(`edits to protected paths were undone (${reverted})`);
  const notes = `<details><summary>Review notes</summary>\n\n${checks}\n\n${review}\n\n</details>`;

  if (round < maxRounds()) {
    const text = `**Stage: Build**\n\nRound ${round} of ${maxRounds()}: ${reasons.join(', ')}. Fixing automatically.\n\n${notes}`;
    const state = { ...base, status: 'running', round: round + 1 };
    const c = await api.postState(e.n, text, state);
    await api.setLabels(e.n, 'build', 'running');
    await api.dispatch(WORKFLOW.build, e.defaultBranch, {
      issue: String(e.n),
      feedback_comment_id: String(c.id),
      round: String(round + 1),
    });
    return;
  }

  const sha = await api.branchSha(e.branch);
  const reviewOnly = `<details><summary>Review notes</summary>\n\n${review}\n\n</details>`;
  const body = `After ${round} rounds: ${reasons.join(', ')}.\n\n${checks}\n\n${reviewOnly}`;
  const state = { ...base, status: 'awaiting', bound: sha };
  await api.postState(
    e.n,
    formatPrompt('Build needs you', body, 'Reply APPROVED to deploy to staging anyway.'),
    state
  );
  await api.setLabels(e.n, 'build', 'awaiting');
}

async function finishStaging({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  if (stopped(prev)) return;

  const e2e = { success: 'pass', failure: 'FAIL' }[process.env.E2E] || 'did not run';
  const checks = (prev.checks || '').trim();
  const table = checks
    ? `${checks}\n| e2e (staging) | ${e2e} |`
    : `| Check | Result |\n|---|---|\n| e2e (staging) | ${e2e} |`;
  const body = [
    truncate(prev.summary, 600),
    table,
    `Preview: ${process.env.URL}\nDatabase: ${process.env.MIGRATIONS || 'unknown'}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const state = { ...prev, stage: 'staging', status: 'awaiting', bound: process.env.SHA, previewUrl: process.env.URL };
  await api.postState(
    e.n,
    formatPrompt('Staging ready', body, 'Reply APPROVED to merge and deploy to production.'),
    state
  );
  await api.setLabels(e.n, 'staging', 'awaiting');
}

async function mergeForProduction({ github, context, core }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = await api.readState(e.n);
  if (!prev || !prev.pr) throw new Error('No pull request recorded for this issue.');
  const { data: pr } = await github.rest.pulls.get({ owner: e.owner, repo: e.repo, pull_number: prev.pr });
  if (pr.merged) {
    core.setOutput('sha', pr.merge_commit_sha);
    return;
  }
  if (pr.draft) {
    await github.graphql(
      'mutation($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { clientMutationId } }',
      { id: pr.node_id }
    );
  }
  // `sha` makes GitHub refuse the merge if the branch moved since you approved.
  const { data: m } = await github.rest.pulls.merge({
    owner: e.owner,
    repo: e.repo,
    pull_number: pr.number,
    merge_method: 'squash',
    sha: prev.bound,
    commit_title: `${pr.title} (#${pr.number})`,
  });
  core.setOutput('sha', m.sha);
  await github.rest.git.deleteRef({ owner: e.owner, repo: e.repo, ref: `heads/${pr.head.ref}` }).catch(() => {});
}

async function finishProduction({ github, context }) {
  const e = env(context);
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  const state = { ...prev, stage: 'done', status: 'done' };
  const text = `**Stage: Done**\n\nLive: ${process.env.URL}\nMerged #${prev.pr}. Closing this issue.`;
  await api.postState(e.n, text, state);
  await api.setLabels(e.n, 'done', 'done');
  await github.rest.issues.update({
    owner: e.owner,
    repo: e.repo,
    issue_number: e.n,
    state: 'closed',
    state_reason: 'completed',
  });
}

async function failStage({ github, context, stage }) {
  const e = env(context);
  if (!e.n) return;
  const api = client(github, e.owner, e.repo);
  const prev = (await api.readState(e.n)) || {};
  if (stopped(prev)) return;
  const runUrl = `${context.serverUrl}/${e.owner}/${e.repo}/actions/runs/${context.runId}`;
  const state = { ...prev, stage, status: 'stopped', stoppedFrom: stage, stoppedStatus: 'failed' };
  const text = `**Stage: ${LABEL[stage]} failed**\n\nLog: ${runUrl}\n\nReply with anything to retry. Your reply is passed along as feedback.`;
  await api.postState(e.n, text, state);
  await api.setLabels(e.n, stage, 'stopped');
}

module.exports = {
  BOT_LOGIN,
  LABEL,
  NEXT,
  WORKFLOW,
  parseKeyword,
  looksLikeApproval,
  encodeState,
  decodeState,
  stripMarker,
  decide,
  formatPrompt,
  issueHash,
  isIdeaIssue,
  client,
  startStage,
  prepareContext,
  finishReview,
  finishPlan,
  finishBuild,
  finishStaging,
  mergeForProduction,
  finishProduction,
  failStage,
};
