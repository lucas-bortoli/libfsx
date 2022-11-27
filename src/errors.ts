export class InvalidOperationError extends Error {
  constructor(message: string = "") {
    super(message);

    if (message) {
      this.message = "Invalid operation: " + message;
    } else {
      this.message = "Invalid operation";
    }

    this.name = "InvalidOperationError";
  }
}

export class InvalidNameError extends Error {
  constructor(name: string) {
    super(`Invalid file name: ${name}`);

    this.name = "InvalidNameError";
  }
}

export class ForbiddenCharactersError extends InvalidNameError {
  constructor(name: string) {
    super(name);

    this.message += `\n\nThe following characters are illegal in a name:\n  < > : " / \\ | ? *`;
    this.name = "ForbiddenCharactersError";
  }
}
