/** Raised by the family module. Mirrors Report14Error: the router turns it into its status. */
export class FamilyError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FamilyError';
    this.status = status;
    this.code = code;
  }
}
