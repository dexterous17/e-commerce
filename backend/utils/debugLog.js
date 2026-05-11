import debug from "debug";

/** Namespaced loggers — enable with DEBUG=ecom:* or DEBUG=ecom:server,ecom:error */
export const dbgServer = debug("ecom:server");
export const dbgDb = debug("ecom:db");
export const dbgError = debug("ecom:error");
export const dbgAuth = debug("ecom:auth");
