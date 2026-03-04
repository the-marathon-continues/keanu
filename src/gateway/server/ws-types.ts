import type { WebSocket } from "ws";
import type { ConnectParams } from "../protocol/index.js";

export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  clientIp?: string;
  canvasCapability?: string;
  canvasCapabilityExpiresAtMs?: number;
  /** Authenticated user identity from gateway auth (e.g. Cognito email via trusted-proxy). */
  authUser?: string;
  /** Auth method that resolved the identity. */
  authMethod?: string;
};
