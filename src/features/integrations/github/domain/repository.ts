const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Accept either owner/repository or a repository URL copied from GitHub. */
export function normalizeGitHubRepoTarget(value?: string): string | undefined | null {
  const input = value?.trim();
  if (!input) return undefined;

  let repository = input;
  const isGitHubUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(input);
  if (isGitHubUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      return null;
    }

    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) return null;

    try {
      repository = segments.map(segment => decodeURIComponent(segment)).join("/");
    } catch {
      return null;
    }
  }

  repository = repository.replace(/\.git$/i, "");
  return REPOSITORY_NAME.test(repository) ? repository : null;
}
