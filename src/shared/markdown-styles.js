// The README styles the visitor site can offer, as ids and names. The web app owns the stylesheets
// (src/markdown-styles/registry.js there); this list only lets the administrator pick a default, so keep the ids in
// step with it. The server checks the shape of an id, not this list.
export const MARKDOWN_STYLES = Object.freeze([
  { id: "github", name: "GitHub" },
  { id: "hf", name: "Hugging Face" },
  { id: "gitlab", name: "GitLab" },
  { id: "vitepress", name: "VitePress" },
  { id: "docusaurus", name: "Docusaurus" },
  { id: "prose", name: "Tailwind prose" },
  { id: "rtd", name: "Read the Docs" },
  { id: "mdn", name: "MDN" },
  { id: "ghost", name: "Ghost article" },
  { id: "tufte", name: "Tufte" },
]);
