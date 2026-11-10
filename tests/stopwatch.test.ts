import { describe, expect, it } from 'vitest';
import { createStopwatch } from '../src/engine/stopwatch';

/** A controllable clock so timing tests never sleep. */
function fakeClock() {
  let t = 1000;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

describe('stopwatch', () => {
  it('reads zero before the first key', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    clock.advance(5000);
    expect(watch.elapsed()).toBe(0);
    expect(watch.started).toBe(false);
  });

  it('starts on the first key, not on creation', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    clock.advance(3000);
    watch.start();
    clock.advance(250);
    expect(watch.elapsed()).toBe(250);
  });

  it('ignores repeated start calls', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(100);
    watch.start();
    clock.advance(100);
    expect(watch.elapsed()).toBe(200);
  });

  it('freezes the time when stopped', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(1234);
    expect(watch.stop()).toBe(1234);
    clock.advance(9999);
    expect(watch.elapsed()).toBe(1234);
    expect(watch.stop()).toBe(1234);
    expect(watch.stopped).toBe(true);
  });

  it('reports zero if stopped before it started', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    expect(watch.stop()).toBe(0);
    expect(watch.elapsed()).toBe(0);
  });

  it('resets back to the pre-start state', () => {
    const clock = fakeClock();
    const watch = createStopwatch(clock.now);
    watch.start();
    clock.advance(500);
    watch.stop();
    watch.reset();
    expect(watch.started).toBe(false);
    expect(watch.stopped).toBe(false);
    expect(watch.elapsed()).toBe(0);

    watch.start();
    clock.advance(42);
    expect(watch.elapsed()).toBe(42);
  });

  it('never returns a negative duration if the clock jumps backwards', () => {
    let t = 1000;
    const watch = createStopwatch(() => t);
    watch.start();
    t = 500;
    expect(watch.elapsed()).toBe(0);
    expect(watch.stop()).toBe(0);
  });
});
