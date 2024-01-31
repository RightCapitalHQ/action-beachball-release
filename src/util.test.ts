import { describe, test } from 'vitest';
import { type IParseGitTagResult, parseGitTag } from './util';

describe.concurrent('parseGitTag', () => {
  for (const [tag, expected] of [
    ['@scope/package_v1.0.0', { name: '@scope/package', version: '1.0.0' }],
    [
      '@scope/package_v123.456.789',
      { name: '@scope/package', version: '123.456.789' },
    ],
    ['package_v1.0.0', { name: 'package', version: '1.0.0' }],
    ['package_v123.456.789', { name: 'package', version: '123.456.789' }],
  ] satisfies [string, IParseGitTagResult][]) {
    test(`should parse git tag ${tag}`, ({ expect }) => {
      expect(parseGitTag(tag)).toEqual(expected);
    });
  }
});
