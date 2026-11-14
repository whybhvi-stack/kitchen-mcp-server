export class DatabaseError extends Error {
  readonly filePath?: string;

  constructor(message: string, filePath?: string) {
    super(message);
    this.name = "DatabaseError";
    this.filePath = filePath;
  }
}

/** An expected problem the user can fix (bad name, item not found, limit reached). The message is shown to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
