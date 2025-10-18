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
        message: `Template placeholders mismatch: got ${schemas.length} schemas for ${schemas.length} literals`,
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
        let pos = 0;
        const errors: DecodeError[] = [];

        for (const seg of segments) {

          if (!input.startsWith(seg.literal, pos)) {
            return yield* Effect.fail(
              new ExpectedLiteralError({
                message: `Expected "${seg.literal}" at position ${pos}`,
              })
            );
          }
          pos += seg.literal.length;
          const nextPos = seg.nextLiteral
            ? input.indexOf(seg.nextLiteral, pos)
            : input.length;
          if (nextPos === -1) {
            return yield* Effect.fail(
              new CouldNotFindLiteralError({
                message: `Could not find "${seg.nextLiteral}" after position ${pos}`,
              })
            );
          }

          const raw = input.slice(pos, nextPos);
          const _ = yield* Schema.decodeUnknown(seg.schema)(raw).pipe(
            Effect.catchTags({
              ParseError: (cause) =>
                Effect.succeed(
                  errors.push(
                    new DecodeError({
                      index: seg.index,
                      raw,
                      cause,
                      message: `Failed to decode placeholder #${seg.index}`,
                    })
                  )
                )
            })
          );
          pos = nextPos;
        }

        const finalLiteral = strings[strings.length - 1];
        if (finalLiteral === undefined) {
          return yield* Effect.fail(
            new MissingTemplateSliceError({ index: strings.length - 1, which: "final", message: `Missing final literal` })
          );
        }
        if (!input.startsWith(finalLiteral, pos)) {
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Expected final "${finalLiteral}" at position ${pos}`,
            })
          );
        }
        pos += finalLiteral.length;

        if (pos !== input.length) {
          const trailing = input.slice(pos);
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Unexpected trailing content ${JSON.stringify(trailing)} at position ${pos}`,
            })
          );
        }

        if (errors.length > 0) {
          return yield* Effect.fail(
            new DecodeErrors({
              errors,
              message: `${errors.length} placeholder(s) failed to decode`,
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
