import { Data } from "effect";

export class ExpectedLiteralError extends Data.TaggedError("ExpectedLiteralError")<{
    message?: string;
}> {}

export class CouldNotFindLiteralError extends Data.TaggedError("CouldNotFindLiteralError")<{
    message?: string;
}> {}
