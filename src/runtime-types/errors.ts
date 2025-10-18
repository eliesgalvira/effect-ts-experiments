import { Data } from "effect";

export class ExpectedLiteralError extends Data.TaggedError("ExpectedLiteralError")<{
    message?: string;
}> {}

export class CouldNotFindLiteralError extends Data.TaggedError("CouldNotFindLiteralError")<{
    message?: string;
}> {}

export class DecodeError extends Data.TaggedError("DecodeError")<{
    index: number;
    raw: string;
    cause: unknown;
    message?: string;
}> {}

export class DecodeErrors extends Data.TaggedError("DecodeErrors")<{
    errors: ReadonlyArray<DecodeError>;
    message?: string;
}> {}

export class MissingTemplateSliceError extends Data.TaggedError("MissingTemplateSliceError")<{
    index: number;
    which: "literal" | "next" | "final";
    message?: string;
}> {}

export class SegmentTemplateError extends Data.TaggedError("SegmentTemplateError")<{
    index: number;
    missing: "literal" | "next" | "both";
    message?: string;
}> {}
