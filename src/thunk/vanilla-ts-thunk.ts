// [From this Kit Langton video](https://www.youtube.com/watch?v=F5aWLtEdNjE)

// 2 BARRIERS TO ADOPTION OF EFFECT
// 1. Perceived Complexity (COST) -- TOO HIGH
// 2. Value Proposition (BENEFIT) -- TOO CONFUSING (TOO LOW)

// THUNK EFFECT

type Effect<A> = () => A;

const randomNumberEffect: () => number = () => Math.random();

const run = <A>(effect: Effect<A>) => console.log(effect());

// WHAT POWERS DOES THE EFFECT GIVE US?
const repeat =
  <A>(effect: Effect<A>, count: number): Effect<A[]> =>
  () => {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(effect());
    }
    return results;
};

run(repeat(repeat(randomNumberEffect, 2), 2));

console.log();

// RETRYABILITY

const failingEffect: Effect<number> = () => {
  const x = Math.random();
  if (x < 0.7) {
    console.log(`OOPS: ${x}`);
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

run(retry(failingEffect, 5));

console.log();
run(eventually(failingEffect));
