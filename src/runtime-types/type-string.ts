import { Console, Schema, Effect } from "effect";
import { ExpectedLiteralError, CouldNotFindLiteralError, DecodeError } from "./errors.ts";

type StringSchema = Schema.Schema<any, string, never>;
type InferA<X> = X extends Schema.Schema<infer A, any, any> ? A : never;
type OutTuple<S extends readonly Schema.Schema<any, any, any>[]> = {
  readonly [K in keyof S]: InferA<S[K]>
};

export function typedString() {
  return <const Schemas extends readonly StringSchema[]>(
      strings: TemplateStringsArray,
      ...schemas: Schemas
    ) =>
    (input: string) =>
      Effect.gen(function* () {
        // This only gets triggered if you directly call the function with no template literals
        if (schemas.length !== strings.length - 1) {
          return yield* Effect.fail(
            new CouldNotFindLiteralError({
              message: `Template placeholders mismatch: got ${schemas.length} schemas for ${strings.length} literals`,
            })
          );
        }

        let pos = 0;
        const results: unknown[] = [];

        for (let i = 0; i < strings.length; i++) {
          const literal = strings[i]!;

          if (!input.startsWith(literal, pos)) {
            return yield* Effect.fail(
              new ExpectedLiteralError({
                message: `Expected "${literal}" at position ${pos}`,
              })
            );
          }
          pos += literal.length;

          if (i < schemas.length) {
            const nextLiteral = strings[i + 1]!;
            const nextPos = nextLiteral ? input.indexOf(nextLiteral, pos) : input.length;

            // String.indexOf returns -1 if the substring is not found
            if (nextPos === -1) {
              return yield* Effect.fail(
                new CouldNotFindLiteralError({
                  message: `Could not find "${nextLiteral}" after position ${pos}`,
                })
              );
            }

            // Slice input from `pos` up to, but not including, `nextPos`
            const raw = input.slice(pos, nextPos);
            const decoded = yield* Schema
              .decodeUnknown(schemas[i]!)(raw)
              .pipe(
                Effect.catchTags({
                  ParseError: (cause) =>
                    Effect.fail(
                      new DecodeError({
                        index: i,
                        raw,
                        cause,
                        message: `Failed to decode placeholder #${i}`,
                      })
                    ),
                })
              );
            results.push(decoded);
            pos = nextPos;
          }
        }

        // strict end check: no trailing characters allowed
        if (pos !== input.length) {
          const trailing = input.slice(pos);
          return yield* Effect.fail(
            new ExpectedLiteralError({
              message: `Unexpected trailing content ${JSON.stringify(trailing)} at position ${pos}`,
            })
          );
        }

        return results as Readonly<OutTuple<Schemas>>;
      });
}

const matcher = typedString()`example/${Schema.NumberFromString}what&${Schema.NumberFromString}`;

const program = Effect.gen(function* () {
  const result = yield* matcher("example/4what&3");
  return result;
});

const main = program.pipe(
  Effect.catchTags({
    ExpectedLiteralError: (error: ExpectedLiteralError) =>
      Effect.succeed(error.message),
    CouldNotFindLiteralError: (error: CouldNotFindLiteralError) =>
      Effect.succeed(error.message),
    DecodeError: (error: DecodeError) =>
      Effect.succeed({ message: error.message, cause: error.cause }),
  }),
  Effect.tap(Console.log)
);

Effect.runPromise(main);
