import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildAutonomousPlan, formatAutonomousPlanMarkdown } from '../out/autonomous/autonomousPlanner.js';
import { analyzeProject } from '../out/autonomous/projectAnalyzer.js';

const SENSITIVE = [/\.env$/i, /credentials/i];

function isSensitiveFile(filePath) {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  return SENSITIVE.some((p) => p.test(base) || p.test(filePath));
}

describe('autonomous planner', () => {
  it('genera plan con objetivo y pasos', () => {
    const understanding = {
      summary: 'Proyecto React',
      framework: 'React',
      dependencies: ['react'],
      folderStructure: ['src/'],
      envFiles: [],
      apis: [],
      components: ['src/'],
      risks: [],
      recommendations: [],
    };
    const plan = buildAutonomousPlan('Agregar login', understanding);
    assert.ok(plan.steps.length >= 5);
    assert.ok(plan.objective.includes('login'));
    const md = formatAutonomousPlanMarkdown(plan);
    assert.ok(md.includes('## Objetivo'));
    assert.ok(md.includes('## Pruebas'));
  });
});

describe('project analyzer', () => {
  it('analiza repo EDITCORE', async () => {
    const root = 'd:/EDITCORE';
    const u = await analyzeProject(root);
    assert.ok(u.summary.length > 0);
    assert.ok(u.components.length > 0);
  });
});

describe('autonomous security', () => {
  it('detecta archivos sensibles', () => {
    assert.ok(isSensitiveFile('.env'));
    assert.ok(isSensitiveFile('credentials.json'));
    assert.ok(!isSensitiveFile('src/index.ts'));
  });
});

describe('task store', () => {
  it('crea y persiste tareas', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ade-test-'));
    const { createPendingTask, loadTaskStore, saveTaskResult } = await import('../out/autonomous/taskStore.js');
    const pending = await createPendingTask(tmp, 'Test objetivo', 'copilot');
    assert.equal(pending.status, 'pending');
    const store = await loadTaskStore(tmp);
    assert.equal(store.tasks.length, 1);
    await saveTaskResult(tmp, {
      taskId: pending.id,
      startedAt: pending.createdAt,
      completedAt: new Date().toISOString(),
      objective: 'Test objetivo',
      workMode: 'copilot',
      phases: [],
      markdown: '# ok',
      success: true,
    });
    const updated = await loadTaskStore(tmp);
    assert.equal(updated.tasks[0].status, 'completed');
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
