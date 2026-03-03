export default interface AuthTokenValidator {
  validate: (accessToken: string) => Promise<boolean>;
}
