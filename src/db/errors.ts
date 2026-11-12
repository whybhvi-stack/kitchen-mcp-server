export class DatabaseError extends Error {
  readonly filePath?: string;

  constructor(message: string, filePath?: string) {
    super(filePath ? `${message} (${filePath})` : message);
    this.name = "DatabaseError";
    this.filePath = filePath;
  }
}
