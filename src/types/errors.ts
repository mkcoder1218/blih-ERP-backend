export type AppError = Error & {
  statusCode?: number;
  status?: number;
  details?: unknown;
};

