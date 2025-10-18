import { Console, Schema, Effect } from "effect";
import {
  ExpectedLiteralError,
  CouldNotFindLiteralError,
  DecodeError,
  DecodeErrors,
} from "./errors.ts";

type StringSchema = Schema.Schema<any, string, never>;
type InferA<X> = X extends Schema.Schema<infer A, any, any> ? A : never;
type OutTuple<S extends readonly Schema.Schema<any, any, any>[]> = {
  readonly [K in keyof S]: InferA<S[K]>;
};

export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    (input: string) =>
      Effect.gen(function* () {
        // only in case higher order function is not called with template literal in the argument
        if (schemas.length !== strings.length - 1) {
          return yield* Effect.fail(
            new CouldNotFindLiteralError({
              message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
            })
          );
        }

        const segments = schemas.map((schema, i) => ({
          literal: strings[i]!,
          schema,
          nextLiteral: strings[i + 1]!,
          index: i,
        }));

        let pos = 0;
        const results: unknown[] = [];
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

        const finalLiteral = strings[strings.length - 1]!;
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

        return results as Readonly<OutTuple<Schemas>>;
      });
}

const matcher = typedString()`example/${Schema.NumberFromString}what&${Schema.NumberFromString}/end`;

const program = Effect.gen(function* () {
  const result = yield* matcher("example/whatwhat&stick/end");
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
