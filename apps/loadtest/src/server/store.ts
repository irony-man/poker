import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeReport, type RunReport, type RunSummaryRow } from '../report/build.js';
import { renderReportHtml } from '../report/html.js';

const RUN_ID_RE = /^[a-z0-9-]{6,48}$/;

export function isRunId(id: string): boolean {
  return RUN_ID_RE.test(id);
}

/** Reports on disk: `<dir>/runs/<id>.json` + `<id>.html`, with an in-memory summary index. */
export class ReportStore {
  private readonly runsDir: string;
  private readonly index = new Map<string, RunSummaryRow>();

  constructor(dir: string) {
    this.runsDir = path.join(dir, 'runs');
  }

  async init(): Promise<void> {
    await mkdir(this.runsDir, { recursive: true });
    for (const file of await readdir(this.runsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const report = JSON.parse(await readFile(path.join(this.runsDir, file), 'utf8')) as RunReport;
        if (report?.version === 1 && isRunId(report.id)) this.index.set(report.id, summarizeReport(report));
      } catch {
        // Skip unreadable reports.
      }
    }
  }

  private async writeAtomic(file: string, data: string): Promise<void> {
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
  }

  async save(report: RunReport): Promise<void> {
    if (!isRunId(report.id)) throw new Error(`invalid run id: ${report.id}`);
    await mkdir(this.runsDir, { recursive: true });
    await this.writeAtomic(path.join(this.runsDir, `${report.id}.json`), JSON.stringify(report, null, 2));
    await this.writeAtomic(path.join(this.runsDir, `${report.id}.html`), renderReportHtml(report));
    this.index.set(report.id, summarizeReport(report));
  }

  list(limit = 100): RunSummaryRow[] {
    return [...this.index.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  get(id: string): RunSummaryRow | undefined {
    return this.index.get(id);
  }

  async read(id: string, ext: 'json' | 'html'): Promise<string | null> {
    if (!isRunId(id) || !this.index.has(id)) return null;
    try {
      return await readFile(path.join(this.runsDir, `${id}.${ext}`), 'utf8');
    } catch {
      return null;
    }
  }
}
