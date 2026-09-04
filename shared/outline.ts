/** The bench as Markdown, the export the workbench had (Copy outline). */
import { milestoneStatus, noteById, totalMinutes } from './bench';
import { fmtMin, wordCount } from './format';
import type { Bench, Note, Presentation } from './types';

function noteLine(bench: Bench, note: Note, number: number | null): string {
  const category = bench.categories.find((c) => c.id === note.type)?.label ?? note.type;
  const marks = `${note.star ? ' [STAR]' : ''}${note.x3 ? ' [x3]' : ''}${note.retired ? ' [retired]' : ''}`;
  const head = `${number === null ? '- ' : `${number}. `}[${category}] ${note.text}${marks}`;
  const more = note.more.trim();
  if (more === '') return head;
  const indent = number === null ? '  ' : '   ';
  return [head, ...more.split('\n').map((l) => `${indent}> ${l}`)].join('\n');
}

function lines(bench: Bench, ids: readonly string[], numbered: boolean): string[] {
  return ids.flatMap((id, i) => {
    const note = noteById(bench, id);
    return note ? [noteLine(bench, note, numbered ? i + 1 : null)] : [];
  });
}

function actBlock(bench: Bench, index: number): string[] {
  const act = bench.acts[index];
  const slides = act.slides === '' ? '' : `, slides ${act.slides}`;
  const out = [`### Act ${index + 1} · ${act.title} (${fmtMin(act.minutes)}${slides})`];
  out.push(...(act.run.length > 0 ? lines(bench, act.run, true) : ['- (nothing scheduled)']));
  if (act.pool.length > 0)
    out.push('', 'On the bench for this act:', ...lines(bench, act.pool, false));
  out.push('');
  return out;
}

function milestoneLine(bench: Bench): string[] {
  if (bench.milestones.length === 0) return [];
  const bits = milestoneStatus(bench).map(
    (m) => `${m.label}${m.at === null ? ' OFF THE RUN' : ` ≈${fmtMin(m.at)} (by ${fmtMin(m.by)})`}`,
  );
  return [`Milestones: ${bits.join(' · ')}`, ''];
}

export function outlineMarkdown(presentation: Presentation, bench: Bench, today: string): string {
  const { who, why, hook } = bench;
  const total = fmtMin(totalMinutes(bench));
  const when = presentation.date === null ? '' : `, ${presentation.date}`;
  const L = [
    `# ${presentation.title}: outline draft (bench export)`,
    '',
    `Exported ${today}. Slot: ${fmtMin(bench.target)}, content timed to ${total}. ${presentation.event}${when}.`,
    '',
    '## WHO: target audience',
    `- In the room: ${who.room}`,
    `- They already know: ${who.know}`,
    `- They expect: ${who.expect}`,
    '',
    '## WHY: goals and outcomes',
    `- Speaker goal: ${why.speakerGoal}`,
    `- Promise to the room: ${why.promise}`,
    `- Throughline (${wordCount(why.throughline)} words): ${why.throughline}`,
    '',
    '### Think, feel, do',
    `- Think, walking in: ${why.tfd.think.now}`,
    `- Think, walking out: ${why.tfd.think.after}`,
    `- Feel, walking in: ${why.tfd.feel.now}`,
    `- Feel, walking out: ${why.tfd.feel.after}`,
    `- Do, walking in: ${why.tfd.do.now}`,
    `- Do, walking out: ${why.tfd.do.after}`,
    '',
    `## The hook (${hook.selected})`,
    `> ${hook.texts[hook.selected]}`,
    '',
    `## The run: ${total} of content in ${bench.acts.length} acts, against a ${fmtMin(bench.target)} slot`,
    '',
    ...milestoneLine(bench),
    ...bench.acts.flatMap((_, i) => actBlock(bench, i)),
  ];
  if (bench.backstage.length > 0) {
    L.push('## Backstage', ...lines(bench, bench.backstage, false), '');
  }
  return L.join('\n');
}
