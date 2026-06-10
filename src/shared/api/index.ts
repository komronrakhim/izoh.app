const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()?.replace(/\/+$/, "");

type ApiRequestInput = RequestInfo | URL;
type ApiJsonInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  initDataRaw?: string;
};

const isRelativeApiPath = (url: ApiRequestInput) => {
  if (typeof url === "string") {
    return url.startsWith("/api/");
  }

  return url.pathname.startsWith("/api/");
};

const resolveApiUrl = (url: ApiRequestInput) => {
  if (!apiBaseUrl || !isRelativeApiPath(url)) {
    return url;
  }

  if (typeof url === "string") {
    return `${apiBaseUrl}${url}`;
  }

  return new URL(`${apiBaseUrl}${url.pathname}${url.search}${url.hash}`);
};

const rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const createTelegramHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

export const fetchApi = async (input: ApiRequestInput, init: RequestInit = {}) => {
  return rawFetch(resolveApiUrl(input), init);
};

let isApiFetchPatched = false;

export const installApiFetchShim = () => {
  if (isApiFetchPatched) {
    return;
  }

  isApiFetchPatched = true;

  globalThis.fetch = ((input: ApiRequestInput, init?: RequestInit) =>
    fetchApi(input, init ?? {})) as typeof fetch;
};

export const fetchApiJson = async <T>(url: string, init: ApiJsonInit = {}) => {
  const { initDataRaw, headers, ...requestInit } = init;
  const response = await fetchApi(url, {
    ...requestInit,
    headers: createTelegramHeaders(initDataRaw, headers)
  });

  if (!response.ok) {
    throw new ApiError(`Request failed: ${url}`, response.status);
  }

  return (await response.json()) as T;
};
