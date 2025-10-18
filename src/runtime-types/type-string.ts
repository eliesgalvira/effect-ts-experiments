import { Console, Schema, Effect } from "effect";
import {
  ExpectedLiteralError,
  CouldNotFindLiteralError,
  DecodeError,
  DecodeErrors,
  MissingTemplateSliceError,
  SegmentTemplateError,
} from "./errors.ts";

type StringSchema = Schema.Schema<any, string, never>;

export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    <CheckString extends string>(input: CheckString) =>
      Effect.gen(function* () {
        console.log(strings, schemas);
        // only in case higher order function is not called with template literal in the argument
        if (schemas.length !== strings.length - 1) {
          return yield* Effect.fail(
            new CouldNotFindLiteralError({
              message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
            })
          );
        }

        const segments = schemas.map((schema, i) => ({
          literal: strings[i],
          schema,
          nextLiteral: strings[i + 1],
          index: i,
        }));

        let pos = 0;
        const results: unknown[] = [];
        const errors: DecodeError[] = [];

        for (const seg of segments) {
          if (seg.literal === undefined || seg.nextLiteral === undefined) {
            const missing = seg.literal === undefined && seg.nextLiteral === undefined
              ? "both" as const
              : seg.literal === undefined ? "literal" as const : "next" as const;
            return yield* Effect.fail(
              new SegmentTemplateError({ index: seg.index, missing, message: `Segment ${seg.index} is missing ${missing}` })
            );
          }

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
          const decoded = yield* Schema.decodeUnknown(seg.schema)(raw).pipe(
            Effect.match({
              onFailure: (cause) =>
                new DecodeError({
                  index: seg.index,
                  raw,
                  cause,
                  message: `Failed to decode placeholder #${seg.index}`,
                }),
              onSuccess: (a) => a,
            })
          );

          if (decoded instanceof DecodeError) {
            errors.push(decoded);
            results.push(undefined);
          } else {
            results.push(decoded);
          }
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
}

const matcher = typedString()`${Schema.NumberFromString}/end`;

const program = Effect.gen(function* () {
  const result = yield* matcher("63/end");
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
