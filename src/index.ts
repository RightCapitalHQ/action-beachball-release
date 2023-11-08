import { readFile } from 'node:fs/promises';
import { relative, dirname } from 'node:path';
import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as glob from '@actions/glob';
import type { ChangelogJson, ChangelogJsonEntry, ChangeType } from 'beachball';

const token = core.getInput('token', { required: true });
core.setSecret(token);
const repoUrl = core.getInput('repo-url', { required: true });
const gitTag = core.getInput('tag', { required: true });
const repoBlobUrl: string = `${repoUrl}/blob/-`;

function parseGitTag(tag: string):
  | undefined
  | {
      name: string;
      version: string;
    } {
  // @scope/package_v1.0.0
  // package_v1.0.0
  const beachballTagPattern =
    /^(?<name>(?:@[\w\-.]+\/)?[\w\-.]+)_v(?<version>\d\.\d\.\d.*)$/;

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
function generateReleaseNotes(
  changelogJson: ChangelogJsonEntry,
  changelogJsonPath: string,
): string {
  const changeTypes: ChangeType[] = ['major', 'minor', 'patch', 'none'];
  const releaseNotes = `## What's Changed

${changeTypes
  .map((changeType) => {
    const entryList = changelogJson.comments[changeType];
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
async function getChangelogJson({
  name,
  version,
}: {
  name: string;
  version: string;
}): Promise<{
  changelogEntry: ChangelogJsonEntry;
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

    return { changelogEntry: currentChangelog, changelogJsonPath };
  }
  const message = `Cannot find changelog for package ${name} at ${gitTag}`;
  core.error(message);
  throw new Error(message);
}

async function main(): Promise<void> {
  const parsedTag = parseGitTag(gitTag);
  if (!parsedTag) {
    const message = `Cannot extract package name and version from git tag: ${gitTag}, exiting...`;
    core.error(message);
    throw new Error(message);
  }

  const { name, version } = parsedTag;
  core.info(`Detected package name: ${name}, version: ${version}`);

  const { changelogEntry, changelogJsonPath } = await getChangelogJson({
    name,
    version,
  });
  const releaseNotes = generateReleaseNotes(changelogEntry, changelogJsonPath);
  core.info(`Generated release notes:\n${releaseNotes}\n`);

  core.info(`Creating GitHub release...`);
  await exec(
    'gh',
    ['release', 'create', gitTag, '--title', gitTag, '--notes', releaseNotes],
    {
      env: {
        ...process.env,
        GH_TOKEN: token,
      },
    },
  );
}

void main().catch((e) => {
  if (e instanceof Error) {
    core.setFailed(e.message);
  } else {
    core.setFailed(`Unknown error: ${e}`);
  }
});
