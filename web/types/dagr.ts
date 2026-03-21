export type SourceMode = "example" | "upload";
export type MethodType = "iterative" | "exact";

export interface CreateJobInput {
    sourceMode: SourceMode;
    fileA: File | null;
    fileB: File | null;
    chainA: string;
    chainB: string;
    dcut: number;
    method: MethodType;
    maxDomains: number;
    nDomains: number;
    postprocess: boolean;
}

export interface CreateJobResponse {
    job_id: string;
    status?: string;
    job_url?: string;
    run_url?: string;
    result_url?: string;
    source_mode?: SourceMode;
}

export interface RunJobResponse {
    job_id?: string;
    status?: string;
    result_url?: string;
    summary?: {
        coverage_fraction?: number;
        overlap_fraction?: number;
        hinge_count?: number;
        uncovered_count?: number;
        [key: string]: unknown;
    };
}

export interface JobMetaResponse {
    job_id?: string;
    status?: string;
    source_mode?: SourceMode;
    cleanup_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    inputs?: {
        original_filename_a?: string;
        original_filename_b?: string;
        chain_a?: string | null;
        chain_b?: string | null;
        dcut?: number;
        method?: MethodType;
        max_domains?: number | null;
        n_domains?: number | null;
        postprocess?: boolean;
    };
    result_exists?: boolean;
    error?: string | null;
    [key: string]: unknown;
}

export interface DagrResult {
    dcut: number;
    n_residues: number;
    matched_labels_a: string[];
    matched_labels_b: string[];
    selected_domains: unknown[];
    hinge: unknown;
    uncovered: unknown;
    non_overlapping_parts?: unknown;
    coverage_fraction: number;
    overlap_fraction: number;
    hinge_count: number;
    uncovered_count: number;
    metadata?: Record<string, unknown>;
}