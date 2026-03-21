import type {
    CreateJobResponse,
    DagrResult,
    JobMetaResponse,
    RunJobResponse,
} from "@/types/dagr";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function parseError(res: Response): Promise<string> {
    try {
        const data = await res.json();
        if (typeof data?.detail === "string") return data.detail;
        return JSON.stringify(data);
    } catch {
        try {
            return await res.text();
        } catch {
            return `Request failed with status ${res.status}`;
        }
    }
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const message = await parseError(res);
        throw new Error(message || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
}

export function getApiBaseUrl() {
    return API_BASE_URL;
}

export async function createJob(formData: FormData): Promise<CreateJobResponse> {
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