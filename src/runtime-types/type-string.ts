import { Schema, Effect } from "effect";

export function typedString() {
  return <const Schemas extends readonly Schema.Schema<any, any, never>[]>(
    strings: TemplateStringsArray,
    ...schemas: Schemas
  ) =>
    (input: string) =>
      Effect.gen(function* () {
        let pos = 0;
        const results: unknown[] = [];

        for (let i = 0; i < strings.length; i++) {
          const literal = strings[i]!;

          if (!input.startsWith(literal, pos)) {
            return yield* Effect.fail(
              new Error(`Expected "${literal}" at position ${pos}`)
            );
          }
          pos += literal.length;

          if (i < schemas.length) {
            const nextLiteral = strings[i + 1]!;
            const nextPos = nextLiteral ? input.indexOf(nextLiteral, pos) : input.length;

            if (nextPos === -1) {
              return yield* Effect.fail(
                new Error(`Could not find "${nextLiteral}" after position ${pos}`)
              );
            }

            const raw = input.slice(pos, nextPos);
            const decoded = yield* Schema.decodeUnknown(schemas[i]!)(raw);
            results.push(decoded);
            pos = nextPos;
          }
        }

        return results;
      });
}

// Usage - exactly like Effect's pattern
const matcher = typedString()`example/${Schema.NumberFromString}what&${Schema.NumberFromString}`;

Effect.runPromise(matcher("example/34what&3")).then(console.log).catch(console.error);