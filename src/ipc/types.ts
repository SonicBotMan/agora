/**
 * Generic IPC registration function type for the architecture-level facade.
 */
export type IpcHandlerRegistration<TDeps = unknown> = (deps: TDeps) => void;
