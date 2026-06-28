const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Tests puros sin vscode — lógica de reportes de evolución

function formatChangeReportMarkdown(git, sessionMeta) {
  const lines = [
    '# REPORTE_CAMBIOS_EDITCORE',
    '',
    git.available ? `**Rama:** ${git.branch ?? 'detached'}` : '_No git._',
  ];
  if (sessionMeta?.agents?.length) {
    lines.push(`Agentes: ${sessionMeta.agents.join(' -> ')}`);
  }
  return lines.join('\n');
}

function buildQaChecklistMarkdown(input) {
  const lines = ['# QA Checklist', '', `gitClean: ${input.gitClean}`];
  if (input.findings?.length) {
    lines.push(`findings: ${input.findings.length}`);
  }
  return lines.join('\n');
}

describe('formatChangeReportMarkdown', () => {
  it('incluye rama git', () => {
    const md = formatChangeReportMarkdown(
      { available: true, branch: 'main', staged: [], unstaged: [], untracked: [], diffStat: '', recentCommits: [] },
      { agents: ['Architect', 'Coder'] }
    );
    assert.ok(md.includes('main'));
    assert.ok(md.includes('Architect'));
  });
});

describe('buildQaChecklistMarkdown', () => {
  it('refleja estado git', () => {
    const md = buildQaChecklistMarkdown({ gitClean: true, findings: [] });
    assert.ok(md.includes('gitClean: true'));
  });
});

describe('agentPipeline roles', () => {
  const { AGENT_OS_REGISTRY } = require('../out/aos/agentRegistry.js');
  it('tiene 8 agentes AOS (Prompt 3)', () => {
    assert.equal(AGENT_OS_REGISTRY.length, 8);
    const ids = AGENT_OS_REGISTRY.map((a) => a.id);
    assert.ok(ids.includes('architect'));
    assert.ok(ids.includes('fullstack'));
    assert.ok(ids.includes('reviewer'));
    assert.ok(ids.includes('debug'));
    assert.ok(ids.includes('qa'));
    assert.ok(ids.includes('security'));
    assert.ok(ids.includes('documenter'));
    assert.ok(ids.includes('prompt_engineer'));
  });
});
