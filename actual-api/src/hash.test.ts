import { describe, expect, test } from 'vitest';

import { stableJson } from './hash.js';

describe('stableJson', () => {
  test('writes valid JSON when values contain undefined', () => {
    const text = stableJson({
      keep: true,
      skip: undefined,
      nested: { alsoSkip: undefined, value: 'ok' },
      array: [1, undefined, 3]
    });

    expect(text).toBe('{"array":[1,null,3],"keep":true,"nested":{"value":"ok"}}');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
