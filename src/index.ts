import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { generateReleaseNotes, getChangelogJson, parseGitTag } from './util';

const token = core.getInput('token', { required: true });
core.setSecret(token);
const repoUrl = core.getInput('repo-url', { required: true });
const gitTag = core.getInput('tag', { required: true });

async function main(): Promise<void> {
  const parsedTag = parseGitTag(gitTag);
  if (!parsedTag) {
    const message = `Cannot extract package name and version from git tag: ${gitTag}, exiting...`;
    core.error(message);
    throw new Error(message);
  }

  const { name, version } = parsedTag;
  core.info(`Detected package name: ${name}, version: ${version}`);

  const { changelogJsonEntry, changelogJsonPath } = await getChangelogJson({
    name,
    version,
  });
  const releaseNotes = generateReleaseNotes({
    changelogJsonEntry,
    changelogJsonPath,
    repoUrl,
  });
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
