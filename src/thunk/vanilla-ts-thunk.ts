// [From this Kit Langton video](https://www.youtube.com/watch?v=F5aWLtEdNjE)

// 2 BARRIERS TO ADOPTION OF EFFECT
// 1. Perceived Complexity (COST) -- TOO HIGH
// 2. Value Proposition (BENEFIT) -- TOO CONFUSING (TOO LOW)

// THUNK EFFECT

type Effect<A> = () => A;

const randomNumberEffect: () => number = () => Math.random();

const run = <A>(effect: Effect<A>): A => {
  const result = effect();
  console.log("RESULT:");
  console.log(result);
  return result;
};

const runSafe = <A>(effect: Effect<A>): void => {
  try {
    const result = effect();
    console.log("RESULT:");
    console.log(result);
  } catch (error) {
    console.error("EFFECT FAILED");
    console.error(error);
  }
};

// WHAT POWERS DOES THE EFFECT GIVE US?

// REPEATABILITY
const repeat =
  <A>(effect: Effect<A>, count: number): Effect<A[]> =>
  () => {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(effect());
    }
    return results;
  };

console.log("COMPOSING REPEAT")
run(repeat(repeat(randomNumberEffect, 2), 2));
console.log();

// RETRYABILITY

const failingEffect: Effect<number> = () => {
  const x = Math.random();
  if (x < 0.99999) {
    //console.log(`OOPS: ${x}`);
    throw new Error("Failed");
  } else {
    return x;
  }
};

const retry =
  <A>(effect: Effect<A>, maxAttempts: number): Effect<A> =>
  () => {
    let remainingAttempts = maxAttempts;
    while (true) {
      try {
        return effect();
      } catch (err) {
        remainingAttempts -= 1;
        if (remainingAttempts === 0) {
          throw err;
        }
      }
    }
  };

const eventually =
  <A>(effect: Effect<A>): Effect<A> =>
  () => {
    while (true) {
      try {
        return effect();
      } catch (err) {}
    }
  };

console.log("RETRY");
runSafe(retry(failingEffect, 5));
console.log();

console.log("EVENTUALLY");
runSafe(eventually(failingEffect));
console.log();

// AROUNDABILITY / INSTRUMENTABILITY / DECORABILITY
// thunk = () => {before... thunk after...}

const timed =
  <A>(effect: Effect<A>): Effect<[duration: number, result: A]> =>
  () => {
    const start = Date.now();
    const result = effect();
    const end = Date.now();
    const duration = end - start;
    return [duration, result];
  };


const timedFailure = timed(eventually(failingEffect));
console.log("EVENTUALLY TIMED");
runSafe(timedFailure);
console.log();

// COMPOSITION OPERATORS

const log =
  (message: string): Effect<void> =>
  () => {
    console.log(message);
  };

// flatMap
const andThen =
  <A, B>(effect: Effect<A>, f: (value: A) => Effect<B>): Effect<B> =>
  () => {
    const a = effect();
    const effectB = f(a);
    return effectB();
  };

const composed = andThen(timedFailure, ([duration, result]) =>
  log(`DURATION: ${duration}ms and RESULT: ${result}`)
);

console.log("COMPOSED");
runSafe(composed);
console.log();

function gen<R>(makeIter: () => Generator<Effect<any>, R, any>): Effect<R> {
  return () => {
    const iter = makeIter();
    let next = iter.next(); // { value: Effect<any> | R, done: boolean }

    while (!next.done) {
      const eff = next.value as Effect<any>;
      const value = eff();

      next = iter.next(value);
    }

    return next.value as R;
  };
}

const composedGen = gen(function* () {
  const [duration, result] = yield timedFailure;
  yield log(`DURATION: ${duration}ms and RESULT: ${result}`);
  return "YAY";
});

console.log("COMPOSED GEN");
runSafe(composedGen);
