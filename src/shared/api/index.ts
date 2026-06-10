type ApiJsonInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  initDataRaw?: string;
};

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

export const fetchApiJson = async <T>(url: string, init: ApiJsonInit = {}) => {
  const { initDataRaw, headers, ...requestInit } = init;
  const response = await fetch(url, {
    ...requestInit,
    headers: createTelegramHeaders(initDataRaw, headers)
  });

  if (!response.ok) {
    throw new ApiError(`Request failed: ${url}`, response.status);
  }

  return (await response.json()) as T;
};
