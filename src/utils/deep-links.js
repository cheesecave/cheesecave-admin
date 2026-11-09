// Links that open one thing instead of a list, so that a search result, a quota table or another page can say "that user",
// "that repository". The pages read the same query names back: Users `open`, Repositories `q` and `open`, Commits `repo`.
// A repository is written type:owner/name because the same owner/name can exist as a model and as a dataset.

export const userLink = (username) => ({ path: "/users", query: { open: username } });

export const repoRef = (repoType, fullId) => `${repoType}:${fullId}`;

export const repoLink = (repoType, fullId) => ({
  path: "/repositories",
  query: { q: fullId, open: repoRef(repoType, fullId) },
});

export const commitsLink = (repoType, fullId) =>
  repoType && fullId ? { path: "/commits", query: { repo: repoRef(repoType, fullId) } } : { path: "/commits" };

const REPO_TYPES = new Set(["model", "dataset", "space"]);
// The Hub's repository names: ASCII letters, digits, _ - and . inside, and a letter, digit or _ first (so never "." or "..").
const REPO_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,95}$/;
// A user or organization name has no format of its own on the server, so this only keeps it a single, plain path segment.
const NAMESPACE = /^[^/\\?#%]+$/;

/**
 * "dataset:owner/name" -> {repo_type, full_id, namespace, name}, or null.
 * A reference comes from a link, so it is read strictly: a type the Hub has, a plain namespace and a valid repository name.
 * Anything else (a dot segment, a slash, an encoded or query character) is not a repository and opens nothing.
 */
export function parseRepoRef(ref) {
  if (typeof ref !== "string") return null;
  const colon = ref.indexOf(":");
  const repo_type = ref.slice(0, colon);
  const full_id = ref.slice(colon + 1);
  const slash = full_id.indexOf("/");
  const namespace = full_id.slice(0, slash);
  const name = full_id.slice(slash + 1);
  if (colon < 0 || slash < 0) return null;
  if (!REPO_TYPES.has(repo_type) || !REPO_NAME.test(name)) return null;
  if (!NAMESPACE.test(namespace) || /^\.+$/.test(namespace)) return null;
  return { repo_type, full_id, namespace, name };
}
