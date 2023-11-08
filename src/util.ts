import { readFile } from 'node:fs/promises';
import { relative, dirname } from 'node:path';
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
  changelogJsonEntry: ChangelogJsonEntry;
  changelogJsonPath: string;
  repoUrl: string;
}): string {
  const repoBlobUrl: string = `${repoUrl}/blob/-`;

  const changeTypes: ChangeType[] = ['major', 'minor', 'patch', 'none'];
  const releaseNotes = `## What's Changed

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

  return releaseNotes;
}

/**
 * @throws {Error} if cannot find changelog for package
 */
export async function getChangelogJson({
  name,
  version,
}: {
  name: string;
  version: string;
}): Promise<{
  changelogJsonEntry: ChangelogJsonEntry;
  changelogJsonPath: string;
}> {
  const globber = await glob.create(`**/CHANGELOG.json`, {
    followSymbolicLinks: false,
  });
  for await (const changelogJsonPath of globber.globGenerator()) {
    const changelogJson = JSON.parse(
      await readFile(changelogJsonPath, 'utf-8'),
    ) as ChangelogJson;

    if (changelogJson.name !== name) {
      // eslint-disable-next-line no-continue
      continue;
    }

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
  const message = `Cannot find changelog for package ${name}@${version}`;
  core.error(message);
  throw new Error(message);
}
