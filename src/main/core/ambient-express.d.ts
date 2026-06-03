// Ambient module declarations for libraries that lack bundled types
// in this checkout. Adding a real @types/* dependency would change
// the runtime dependency surface, so we declare just the symbols we use.

declare module 'express' {
  export interface Request {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  }
  export interface Response {
    statusCode: number;
    status(code: number): Response;
    setHeader(name: string, value: string | number | string[]): Response;
    end(chunk?: unknown): Response;
    send(body: unknown): Response;
    json(body: unknown): Response;
  }
}
