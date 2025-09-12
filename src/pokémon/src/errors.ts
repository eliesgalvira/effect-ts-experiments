import { Data } from "effect"

export class FetchError extends Data.TaggedError("FetchError")<{ customMessage: string }> {};

export class JsonError extends Data.TaggedError("JsonError")<{ customMessage: string }> {};
