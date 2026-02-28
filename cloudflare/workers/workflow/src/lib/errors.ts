export class WorkflowHandlerError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = "WorkflowHandlerError";
    this.code = options?.code ?? "handler_error";
    this.status = options?.status ?? 500;
    this.details = options?.details;
  }
}

export function errorContract(error: unknown) {
  if (error instanceof WorkflowHandlerError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      code: "handler_error",
      message: error.message,
      details: undefined as unknown
    };
  }

  return {
    status: 500,
    code: "handler_error",
    message: String(error),
    details: undefined as unknown
  };
}

