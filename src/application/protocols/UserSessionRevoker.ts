export type RevokeUserSessionsInput = {
  actorUserId: string;
  targetUserId: string;
  reason: string;
  mode: "all" | "except-current";
  accessToken: string;
};

export default interface UserSessionRevoker {
  isAvailable(): boolean;
  revoke(input: RevokeUserSessionsInput): Promise<number>;
}
