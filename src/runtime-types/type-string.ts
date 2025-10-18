import { Console, Schema, Effect } from "effect";
import {
  ExpectedLiteralError,
  CouldNotFindLiteralError,
  DecodeError,
  DecodeErrors,
  MissingTemplateSliceError,
  SegmentTemplateError,
  TemplateAmbiguityError,
} from "./errors.ts";

type StringSchema = Schema.Schema<any, string, never>;

export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) => Effect.gen(function* () {
    // Definition-time checks
    if (schemas.length !== strings.length - 1) {
      return yield* Effect.fail(new CouldNotFindLiteralError({
        message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
      }));
    }

    // Build segments once and validate while building
    const segments: Array<{
      readonly literal: string;
      readonly schema: StringSchema;
      readonly nextLiteral: string;
      readonly index: number;
    }> = [];

    for (let i = 0; i < schemas.length; i++) {
      const literal = strings[i];
      const nextLiteral = strings[i + 1];
      if (literal === undefined || nextLiteral === undefined) {
        const missing = literal === undefined && nextLiteral === undefined
          ? "both" as const
          : literal === undefined ? "literal" as const : "next" as const;
        return yield* Effect.fail(new SegmentTemplateError({ index: i, missing, message: `Segment ${i} is missing ${missing}` }));
      }
      if (i >= 1 && i < strings.length - 1 && strings[i] === "") {
        return yield* Effect.fail(new TemplateAmbiguityError({ index: i, message: `Ambiguous template: empty internal slice at index ${i}` }));
      }
      segments.push({
        literal,
        schema: schemas[i] as StringSchema,
        nextLiteral,
        index: i,
      });
    }

    return <CheckString extends string>(input: CheckString) =>
      Effect.gen(function* () {
        let currentPosition = 0;
        const decodeErrors: DecodeError[] = [];

        for (const segment of segments) {

          if (!input.startsWith(segment.literal, currentPosition)) {
            return yield* Effect.fail(
              new ExpectedLiteralError({
                message: `Expected "${segment.literal}" at position ${currentPosition}`,
              })
            );
          }
          currentPosition += segment.literal.length;
          const nextLiteralPosition = segment.nextLiteral
            ? input.indexOf(segment.nextLiteral, currentPosition)
            : input.length;
          if (nextLiteralPosition === -1) {
            return yield* Effect.fail(
              new CouldNotFindLiteralError({
                message: `Could not find "${segment.nextLiteral}" after position ${currentPosition}`,
              })
            );
          }

          const rawInputForPlaceholder = input.slice(currentPosition, nextLiteralPosition);
          yield* Schema.decodeUnknown(segment.schema)(rawInputForPlaceholder).pipe(
            Effect.catchTags({
              ParseError: (parseError) =>
                Effect.succeed(
                  decodeErrors.push(
                    new DecodeError({
                      index: segment.index,
                      raw: rawInputForPlaceholder,
                      cause: parseError,
                      message: `Failed to decode placeholder #${segment.index}`,
                    })
                  )
                )
            })
          );
          currentPosition = nextLiteralPosition;
        }

        const finalLiteral = strings[strings.length - 1];
        if (finalLiteral === undefined) {
          return yield* Effect.fail(
            new MissingTemplateSliceError({ index: strings.length - 1, which: "final", message: `Missing final literal` })
          );
        }
        if (!input.startsWith(finalLiteral, currentPosition)) {
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Expected final "${finalLiteral}" at position ${currentPosition}`,
            })
          );
        }
        currentPosition += finalLiteral.length;

        if (currentPosition !== input.length) {
          const trailingContent = input.slice(currentPosition);
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Unexpected trailing content ${JSON.stringify(trailingContent)} at position ${currentPosition}`,
            })
          );
        }

        if (decodeErrors.length > 0) {
          return yield* Effect.fail(
            new DecodeErrors({
              errors: decodeErrors,
              message: `${decodeErrors.length} placeholder(s) failed to decode`,
            })
          );
        }

        return input;
      });
  });
}

const matcherEffect = typedString()`route/${Schema.NumberFromString}/end`;

const program = Effect.gen(function* () {
  const matcher = yield* matcherEffect;
  const result = yield* matcher("route/3/end");
  return result;
});

const main = program.pipe(
  Effect.catchTags({
    ExpectedLiteralError: (error: ExpectedLiteralError) =>
      Effect.succeed(error.message),
    CouldNotFindLiteralError: (error: CouldNotFindLiteralError) =>
      Effect.succeed(error.message),
    DecodeErrors: (error: DecodeErrors) =>
      Effect.succeed({ message: error.message, errors: error.errors }),
    SegmentTemplateError: (error: SegmentTemplateError) =>
      Effect.succeed({ message: error.message, index: error.index, missing: error.missing }),
    TemplateAmbiguityError: (error: TemplateAmbiguityError) =>
      Effect.succeed({ message: error.message, index: error.index }),
    MissingTemplateSliceError: (error: MissingTemplateSliceError) =>
      Effect.succeed({ message: error.message, index: error.index, which: error.which }),
  } as const),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
