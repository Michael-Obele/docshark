// src/jobs/manager.ts — Crawl job queue manager
import { nanoid } from 'nanoid';
import type { Database } from '../storage/db.js';
import type { EventBus } from './events.js';
import { CrawlWorker } from './worker.js';
import type { CrawlJob } from '../types.js';

export class JobManager {
    private activeJobs = new Map<string, CrawlWorker>();

    constructor(
        private db: Database,
        private eventBus: EventBus,
    ) { }

    /** Start a crawl job for a library */
    startCrawl(libraryId: string, opts?: { incremental?: boolean }): CrawlJob {
        const jobId = nanoid();
        const job = this.db.createJob({ id: jobId, libraryId });

        // Run crawl async (non-blocking)
        const worker = new CrawlWorker(this.db, this.eventBus);
        this.activeJobs.set(jobId, worker);

        // Fire and forget — runs in the background
        worker
            .crawl(libraryId, jobId)
            .catch((err: Error) => {
                console.error(`[DocShark] Crawl job ${jobId} failed:`, err);
            })
            .finally(() => {
                this.activeJobs.delete(jobId);
            });

        return job;
    }

    /** Get status of a specific job */
    getJob(jobId: string): CrawlJob | undefined {
        return this.db.getJob(jobId);
    }

    /** List all jobs, optionally filtered by library */
    listJobs(libraryId?: string): CrawlJob[] {
        return this.db.listJobs(libraryId);
    }

    /** Check if a crawl is currently running for a library */
    isRunning(libraryId: string): boolean {
        for (const [, worker] of this.activeJobs) {
            // Check by iterating active jobs
            const jobs = this.db.listJobs(libraryId);
            if (jobs.some((j) => j.status === 'running' || j.status === 'queued')) {
                return true;
            }
        }
        return false;
    }
}
