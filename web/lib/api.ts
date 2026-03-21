import type {
    CreateJobInput,
    CreateJobResponse,
    DagrResult,
    JobMetaResponse,
    RunJobResponse,
} from "@/types/dagr";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
    status: number;
    detail?: unknown;

    constructor(status: number, message: string, detail?: unknown) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}

async function parseError(res: Response): Promise<ApiError> {
    try {
        const data = await res.json();
        const detail = data?.detail;

        if (typeof detail === "string") {
            return new ApiError(res.status, detail, detail);
        }

        if (
            detail &&
            typeof detail === "object" &&
            "stderr" in detail &&
            typeof detail.stderr === "string"
        ) {
            return new ApiError(res.status, detail.stderr, detail);
        }

        return new ApiError(
            res.status,
            typeof data?.message === "string"
                ? data.message
                : `Request failed (${res.status})`,
            data
        );
    } catch {
        try {
            const text = await res.text();
            return new ApiError(
                res.status,
                text || `Request failed (${res.status})`,
                text
            );
        } catch {
            return new ApiError(res.status, `Request failed (${res.status})`);
        }
    }
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        throw await parseError(res);
    }
    return res.json() as Promise<T>;
}

export function getApiBaseUrl() {
    return API_BASE_URL;
}

export async function createJob(input: CreateJobInput): Promise<CreateJobResponse> {
    const formData = new FormData();

    formData.append("use_example", String(input.sourceMode === "example"));
    formData.append("chain_a", input.chainA.trim());
    formData.append("chain_b", input.chainB.trim());
    formData.append("dcut", String(input.dcut));
    formData.append("method", input.method);
    formData.append("postprocess", String(input.postprocess));

    if (input.method === "iterative") {
        formData.append("max_domains", String(input.maxDomains));
    } else {
        formData.append("n_domains", String(input.nDomains));
    }

    if (input.sourceMode === "upload") {
        if (input.fileA) formData.append("pdb_a", input.fileA);
        if (input.fileB) formData.append("pdb_b", input.fileB);
    }

    const res = await fetch(`${API_BASE_URL}/v1/jobs`, {
        method: "POST",
        body: formData,
    });

    return handleResponse<CreateJobResponse>(res);
}

export async function runJob(jobId: string): Promise<RunJobResponse> {
    const res = await fetch(`${API_BASE_URL}/v1/jobs/${jobId}/run`, {
        method: "POST",
    });

    return handleResponse<RunJobResponse>(res);
}

export async function getJobMeta(jobId: string): Promise<JobMetaResponse> {
    const res = await fetch(`${API_BASE_URL}/v1/jobs/${jobId}`, {
        cache: "no-store",
    });

    return handleResponse<JobMetaResponse>(res);
}

export async function getJobResult(jobId: string): Promise<DagrResult> {
    const res = await fetch(`${API_BASE_URL}/v1/jobs/${jobId}/result`, {
        cache: "no-store",
    });

    return handleResponse<DagrResult>(res);
}

export function getJobInputUrl(jobId: string, which: "a" | "b") {
    return `${API_BASE_URL}/v1/jobs/${jobId}/input/${which}`;
}