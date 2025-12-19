# Repository Guidelines

## Project Structure & Workflow
- Content lives in `content/posts/YYYY/slug.md`; keep filenames snake-case and year-based (e.g., `content/posts/2025/control-plane-basics.md`).
- Post assets go in `assets/images/<slug>/`; reference them as `/images/<slug>/file.png` (WITH leading slash) in frontmatter. See `content/posts/2025/claude-k8s-triage.md` as the reference format.
- Theme and config files (e.g., `hugo.yaml`, `themes/`) should be left untouched unless explicitly requested.

## Create or Edit Posts
- Generate a draft with `hugo new posts/YYYY/your-title.md`; use ISO dates and fill required front matter (`title`, `date`, `author`, `description`, `draft`).
- Keep `draft: true` until ready; flip to `false` for publication.
- Use clear headings, short paragraphs, and fenced code blocks with language hints (`bash`, `yaml`, `python`).
- **Footnotes**: Use proper Markdown footnote syntax with colon after the marker:
  - Reference in text: `some text[^1]`
  - Definition at bottom: `[^1]: Footnote content here` (note the colon!)
  - See `content/posts/2025/claude-k8s-triage.md` for examples

### Tag Conventions
- Keep tags simple and concise; the blog's context helps readers understand
- Prefer shorter, simpler versions of tags:
  - Use `skills` instead of `agent-skills`
  - Use `operations` instead of `it-operations`
  - Use `triage` instead of `incident-triage`
  - Conceptual tags like `ooda-loop` are fine
- **DO NOT** tag specific software or tools (e.g., avoid tags like `goose`, `claude-code`, `kubernetes-tool-name`)
- Focus tags on concepts, methodologies, and domains rather than specific implementations
- All tags should be lowercase with hyphens for multi-word tags (e.g., `aiops`, `cloud-native`)
- **IMPORTANT**: Tags and categories must never overlap. If a term is used as a category (e.g., `operations`, `engineering`), do not also use it as a tag. Keep the taxonomies separate and distinct.

## Assets & Images
- Create the directory for post images: `mkdir -p assets/images/<slug>/` where `<slug>` matches the post's slug or a descriptive name derived from the filename.
- Copy image files to `assets/images/<slug>/`; keep files under ~1 MB; prefer PNG for screenshots, JPG for photos.
- **IMPORTANT**: Reference the cover/featured image in front matter WITH a leading slash: `image: "/images/<slug>/filename.png"` (note: Hugo processes `assets/images/` and serves it at `/images/`). See `content/posts/2025/claude-k8s-triage.md` as the reference format.
- Set `slug: "<slug>"` in front matter to keep URLs stable across environments.
- Avoid using emoji shortcodes in posts as they may cause build failures if the theme doesn't support them.
- Example workflow:
  ```bash
  mkdir -p assets/images/anthropic-agent-skills-public-domain
  cp ~/Downloads/cover-image.png assets/images/anthropic-agent-skills-public-domain/
  # Then in frontmatter: image: "/images/anthropic-agent-skills-public-domain/cover-image.png"
  ```

## Preview & Build
- Local preview with live reload: `npm run dev` (runs Tailwind watch + Hugo server at `http://localhost:1313`).
- Hugo-only preview (faster when not changing CSS): `hugo server -D`.
- Production build: `npm run build` (minified Tailwind + Hugo).

## GitHub Actions & Deployment

### Tracking Deployments
After pushing commits, always verify the build and deployment:

1. **List recent workflow runs**:
   ```bash
   gh run list --limit 5
   ```
   This shows the status of recent builds (in_progress, completed success, completed failure).

2. **View specific run details**:
   ```bash
   gh run view <run-id>
   ```
   Use the run ID from the list to see detailed job information and logs.

3. **Watch a run in progress**:
   ```bash
   gh run watch <run-id>
   ```
   Monitor an active deployment in real-time.

4. **Check the preview site**:
   - Preview URL: https://randybias.github.io/t0-blog/
   - Verify your post appears correctly with images displaying properly
   - Test all links and formatting before creating a PR to production

### Deployment Workflow
1. Push commits to origin/main
2. Run `gh run list --limit 5` to get the latest run ID
3. Run `gh run view <run-id>` to verify build success
4. Visit preview URL to visually verify the post
5. Only create PR to production blog after successful preview verification

## Quality & Style
- Write in an instructional, engineering-focused tone; avoid marketing language.
- Use consistent casing: headings in Title Case; filenames in snake-case; tags/categories in lowercase.
- Check links, images, and code snippets render correctly; prefer concise examples over theory.

## Commit & PR Guidelines
- Commits: short imperative subject (e.g., `add post on aiops runbooks`); one logical change per commit.
- Pull requests: include a brief summary, linked issue (if any), and confirm the post-specific checklist (front matter complete, images in the correct directory, `draft` flipped when publishing).
- Do not modify theme/config unless the task explicitly requires it; note any deviations in the PR description.
