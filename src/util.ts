import { readFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import type { ChangelogJson, ChangelogJsonEntry, ChangeType } from 'beachball';

export interface IParseGitTagResult {
  name: string;
  version: string;
}
export function parseGitTag(tag: string): undefined | IParseGitTagResult {
  // @scope/package_v1.0.0
  // package_v1.0.0
  const beachballTagPattern =
    /^(?<name>(?:@[\w\-.]+\/)?[\w\-.]+)_v(?<version>\d+\.\d+\.\d+.*)$/;

  const match = tag.match(beachballTagPattern);
  if (match) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { name, version } = match.groups!;
    return { name, version };
  }
  return undefined;
}

/**
 * TODO: make this configurable?
 */
export function generateReleaseNotes({
  changelogJsonEntry,
  changelogJsonPath,
  repoUrl,
}: {
  changelogJsonEntry: ChangelogJsonEntry | null;
  changelogJsonPath: string;
  repoUrl: string;
}): string {
  const repoBlobUrl: string = `${repoUrl}/blob/-`;

  const changeTypes: ChangeType[] = ['major', 'minor', 'patch', 'none'];

  if (!changelogJsonEntry) {
    return `## What's Changed

Version bump only for package.

**Full Changelog**: ${repoBlobUrl}/${relative(
      process.cwd(),
      dirname(changelogJsonPath),
    )}/CHANGELOG.md`;
  }

  return `## What's Changed

${changeTypes
  .map((changeType) => {
    const entryList = changelogJsonEntry.comments[changeType];
    if (entryList) {
      return entryList
        .map((changelogEntry) => {
          const { commit, comment } = changelogEntry;
          const commitLink =
            commit === 'not available'
              ? ''
              : ` [${commit.substring(0, 8)}](${repoUrl}/commit/${commit}) `;
          return `* ${commitLink}${comment}`;
        })
        .join('\n');
    }
    return '';
  })
  .join('\n\n')}

**Full Changelog**: ${repoBlobUrl}/${relative(
    process.cwd(),
    dirname(changelogJsonPath),
  )}/CHANGELOG.md`;
}

export interface IGetChangelogJsonResult {
  changelogJsonEntry: ChangelogJsonEntry | null;
  changelogJsonPath: string;
}
/**
 * @returns undefined if cannot find changelog for the package, we consider it's a version bump only release
 */
export async function getChangelogJson({
  name,
  version,
}: {
  name: string;
  version: string;
}): Promise<IGetChangelogJsonResult> {
  const globber = await glob.create(`**/CHANGELOG.json`, {
    followSymbolicLinks: false,
  });

  let resolvedChangelogJsonPath: string | undefined;
  for await (const changelogJsonPath of globber.globGenerator()) {
    const changelogJson = JSON.parse(
      await readFile(changelogJsonPath, 'utf8'),
    ) as ChangelogJson;

    if (changelogJson.name !== name) {
      // eslint-disable-next-line no-continue
      continue;
    }
    resolvedChangelogJsonPath = changelogJsonPath;

    core.info(`Found changelog for package ${name} at ${changelogJsonPath}`);
    const currentChangelog = changelogJson.entries.find(
      (entry) => entry.version === version,
    );

    if (!currentChangelog) {
      core.info(`Cannot find changelog for version ${version}, try next...`);
      // eslint-disable-next-line no-continue
      continue;
    }

    return { changelogJsonEntry: currentChangelog, changelogJsonPath };
  }
  if (!resolvedChangelogJsonPath) {
    throw new Error(`Cannot find changelog for package ${name}`);
  }

  /**
   * if we reach here, we assume it's a version bump only release for a package
   * since beachball doesn't generate CHANGELOG.json entry for this case
   * @see https://github.com/microsoft/beachball/issues/252
   */
  core.info(
    `Cannot find changelog for package ${name}@${version}, assuming it's a version bump only release`,
  );
  return {
    changelogJsonEntry: null,
    changelogJsonPath: resolvedChangelogJsonPath,
  };
}
