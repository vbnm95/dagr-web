export interface CreateJobResponse {
    job_id: string;
    status?: string;
    job_url?: string;
    run_url?: string;
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
    method?: string;
    postprocess?: boolean;
    dcut?: number;
    chain_a?: string | null;
    chain_b?: string | null;
    [key: string]: unknown;
}

export interface DagrResult {
    dcut: number;
    n_residues: number;
    matched_labels_a: string[];
    matched_labels_b: string[];

    // 실제 구조가 number[] / [start,end] / {start,end} / nested object 일 수 있으므로
    // 프론트에서는 unknown으로 받고 normalize해서 사용
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