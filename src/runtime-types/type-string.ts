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
    ) => {
    // Definition-time checks
    if (schemas.length !== strings.length - 1) {
      throw new CouldNotFindLiteralError({
        message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
      });
    }

    // Build segments once and validate while building
    const segments = Array.from({ length: schemas.length }, (_, i) => {
      const literal = strings[i];
      const nextLiteral = strings[i + 1];
      if (literal === undefined || nextLiteral === undefined) {
        const missing = literal === undefined && nextLiteral === undefined
          ? "both" as const
          : literal === undefined ? "literal" as const : "next" as const;
        throw new SegmentTemplateError({ index: i, missing, message: `Segment ${i} is missing ${missing}` });
      }
      if (i >= 1 && i < strings.length - 1 && strings[i] === "") {
        throw new TemplateAmbiguityError({ index: i, message: `Ambiguous template: empty internal slice at index ${i}` });
      }
      return {
        literal,
        schema: schemas[i] as StringSchema,
        nextLiteral,
        index: i,
      } as const;
    });

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
  };
}

const matcher = typedString()`${Schema.NumberFromString}${Schema.NumberFromString}`;

const program = Effect.gen(function* () {
  const result = yield* matcher("63");
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
  }),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
