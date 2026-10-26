'use strict';

const ReactNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

/**
 * jest-expo's native environment plus `__setProcessTimezone(tz)`.
 *
 * Tests see a sandboxed copy of `process.env`, so assigning `process.env.TZ` inside a test
 * never reaches V8's timezone cache. This helper sets TZ on the real worker process, which
 * Node applies immediately to every `Date` in the sandbox.
 *
 * Opt in per file with a `@jest-environment ./jest/timezoneEnvironment.js` docblock.
 */
class TimezoneEnvironment extends ReactNativeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.__setProcessTimezone = (tz) => {
      process.env.TZ = tz;
    };
  }
}

module.exports = TimezoneEnvironment;
module.exports.TestEnvironment = TimezoneEnvironment;
