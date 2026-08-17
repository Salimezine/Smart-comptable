export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public issues?: unknown[],
  ) {
    super(message);
    this.name = "AppError";
  }
}
