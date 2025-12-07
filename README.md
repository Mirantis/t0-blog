# Tzero Blog

The repository that powers the Tzero community blog static site. Built with Hugo and the pehtheme-hugo theme. If you can open a pull request, you can publish a post.

## Quick start

1. Create a new post:

   ```bash
   hugo new posts/YYYY/title-of-your-post.md
   ```

2. Open the generated file and fill in front matter (see below).

3. Create an image directory and add images:

   ```bash
   mkdir -p assets/images/$(basename -s .md content/posts/YYYY/title-of-your-post.md)
   ```

   Then place all images in `assets/images/<your-post-name>/` (replace `<your-post-name>` with your actual post filename without extension).

4. Preview locally:

   ```bash
   npm install
   npm run dev
   ```

5. When ready to publish, set `draft: false` and open a pull request.

## Front matter

When you create a new post with `hugo new`, it will include a template with all fields. Key fields:

```yaml
---
title: "Your Post Title"
date: 2025-01-15T00:00:00Z
author: "Your Name"
tags: ["automation", "kubernetes", "devops"]
categories: ["engineering", "operations", "tutorials"]
draft: true
description: "A brief description of your post"
slug: "custom-url-slug"
image: "images/your-post-name/featured-image.jpg"
---
```

**Required fields:**

- `title` - Post title
- `date` - ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
- `author` - Your name (displayed on the post)
- `description` - Brief summary for SEO and listings
- `draft` - Set to `false` when ready to publish

**Optional fields:**

- `tags` - Array of tags for categorization
- `categories` - Array of categories (e.g., "engineering", "operations", "tutorials")
- `slug` - Custom URL slug (see [URL slugs](#url-slugs) below)
- `image` - Featured image path

## URL slugs

By default, Hugo generates the URL from the **filename**. For example:

- File: `content/posts/2025/my-awesome-post.md`
- URL: `https://t0.mirantis.com/my-awesome-post/`

### Overriding the slug

To use a different URL than the filename, add the `slug` field to your front matter:

```yaml
---
title: "Everything You Ever Wanted to Know About Kubernetes Load Balancing"
slug: "k8s-load-balancing-guide"
---
```

This creates the URL: `https://t0.mirantis.com/k8s-load-balancing-guide/`

### When to use a custom slug

- Long titles: Keep URLs short while having descriptive titles
- SEO: Target specific keywords in the URL

### Slug best practices

- Use lowercase letters and hyphens only
- Keep slugs short but meaningful (3-5 words)
- Avoid special characters and spaces
- Slugs must be unique across all posts
- Once published, avoid changing slugs (breaks existing links)

## Images & media

**Important:** Always create a dedicated directory for your post's images.

1. **Create the directory:**

   ```bash
   mkdir -p assets/images/your-post-name
   ```

   Replace `your-post-name` with your post filename (without `.md` extension). For example, if your post is `control-plane-load-balancing-explained.md`, use `control-plane-load-balancing-explained`.

2. **Place all images** in `assets/images/<your-post-name>/`

3. **Reference images:**

   - Featured image in front matter:

     ```yaml
     image: "images/your-post-name/featured-image.jpg"
     ```

   - Inline images in markdown:

     ```markdown
     ![Alt text](/images/your-post-name/image-name.png)
     ```

4. **Best practices:**
   - Keep files under 1 MB
   - Use descriptive filenames
   - Add meaningful alt text
   - Use PNG for screenshots, JPG for photos

## Local development

Prerequisites:

- Git (for cloning the repository and its submodule)
- Hugo (standard version, not extended)
- Node.js (v16+) and npm

```bash
git clone https://github.com/mirantis/t0-blog.git
cd t0-blog
git submodule update --init --recursive
npm install
```

Start a live-reloading development server:

```bash
npm run dev
```

Visit <http://localhost:1313/> to preview the site.

For Hugo-only mode (faster, no CSS changes):

```bash
hugo server -D
```

## Pull request checklist

- `title`, `date`, `author`, `description` set
- `draft: false` for publishing
- URL slug: Consider if a custom `slug` is needed (long title? SEO keywords?)
- Images: All images placed in `assets/images/<your-post-name>/` directory
- Image paths: References use `/images/<your-post-name>/filename.ext` format
- Images load correctly
- Links/code blocks render correctly
- Post matches the tone and headings of existing posts

## Conventions

- **File name**: `kebab-case-title.md` in `content/posts/YYYY/` directory (e.g., `content/posts/2025/my-post-title.md`)
- **URL slug**: Flat URLs at root (e.g., `/my-post/`); defaults to filename, override with `slug` front matter
- **Date format**: ISO 8601 (`2025-01-15T00:00:00Z`)
- **Code blocks**: Use fenced blocks with language hints (`bash`, `yaml`, `python`, etc.)
- **Images**: Place in `assets/images/<post-name>/` and reference with `/images/<post-name>/file.png`
- **Author**: Always include your name in the `author` field (it will be displayed on the post)

## License

See [LICENSE](LICENSE) file for details.
