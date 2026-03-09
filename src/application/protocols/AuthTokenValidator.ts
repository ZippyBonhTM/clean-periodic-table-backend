export type AuthenticatedUser = {
  userId: string;
};

export default interface AuthTokenValidator {
  validate: (accessToken: string) => Promise<AuthenticatedUser | null>;
}
