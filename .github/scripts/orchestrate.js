'use strict';
/**
 * Routes issue and comment events. Runs from the default branch only.
 * Only the approver can start a pipeline or move one forward.
 */
const P = require('./pipeline.js');

module.exports = async function orchestrate({ github, context, core }) {
  const { owner, repo } = context.repo;
  const approver = (process.env.APPROVER || owner).toLowerCase();
  const api = P.client(github, owner, repo);
  const issue = context.payload.issue;
  const n = issue.number;
  const ref = context.payload.repository.default_branch;

  if (context.eventName === 'issues') {
    if (!P.isIdeaIssue(issue)) return core.info('Not an idea issue.');
    if (issue.user.login.toLowerCase() !== approver) {
      await api.comment(n, `Only @${approver} can start the pipeline, so this issue was not picked up.`);
      return;
    }
    if (await api.readState(n)) return core.info('Pipeline already started.');
    await api.ensureLabels();
    await P.startStage({ api, n, ref, stage: 'review', prev: {} });
    return;
  }

  if (context.eventName !== 'issue_comment') return;
  const c = context.payload.comment;
  if (issue.pull_request) return core.info('Comment is on a pull request; the issue thread is the control surface.');
  if (!c.user || c.user.type === 'Bot') return;
  if (c.user.login.toLowerCase() !== approver) return core.info('Comment is not from the approver.');

  const state = await api.readState(n);
  if (!state) return core.info('No pipeline on this issue.');

  const d = P.decide(state, c.body);
  core.info(`Decision: ${JSON.stringify(d)}`);

  switch (d.type) {
    case 'reply':
      await api.comment(n, d.text);
      return;

    case 'stop': {
      await api.cancelRuns(n);
      const s = { ...state, status: 'stopped', stoppedFrom: state.stage, stoppedStatus: state.status };
      await api.postState(
        n,
        `**Stage: Stopped**\n\nNothing will run until you reply. Reply with anything to resume from ${P.LABEL[state.stage]}. Your reply is passed along as feedback.`,
        s
      );
      await api.setLabels(n, state.stage, 'stopped');
      return;
    }

    case 'dispatch':
      await P.startStage({ api, n, ref, stage: d.stage, prev: state, feedbackId: c.id, note: d.note, round: 1 });
      return;

    case 'advance': {
      // Your APPROVED applies to exactly what you were shown. If it changed, ask again.
      const current = state.stage === 'review' ? P.issueHash(issue) : await api.branchSha(state.branch);
      if (state.bound && current && current !== state.bound) {
        const what = state.stage === 'review' ? 'The idea was edited' : 'The branch got new commits';
        await api.postState(
          n,
          P.formatPrompt(
            `${P.LABEL[state.stage]} changed`,
            `${what} after this was posted, so your APPROVED was not applied.`,
            'Reply APPROVED to continue with the latest version.'
          ),
          { ...state, bound: current }
        );
        return;
      }
      await P.startStage({ api, n, ref, stage: d.stage, prev: state, round: 1 });
      return;
    }
  }
};
