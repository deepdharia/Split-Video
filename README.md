# SplitVideo

A free, browser-based video splitter. Upload a video, split it into equal
clips by duration or part count, and download each clip automatically —
no server upload, no watermark, no signup.

## How it works

- Pure static site: HTML/CSS/JS, no build step, no framework.
- Video splitting happens client-side using [ffmpeg.wasm](https://ffmpegwasm.netlify.app/),
  loaded from a CDN (unpkg) the first time someone hits "Split video."
- File size is capped at 500MB in `js/splitter.js` (`MAX_FILE_MB`) — this is
  a browser memory limit, not a bandwidth one. Raise it only after real
  device testing; large files can crash the tab.

## File structure

```
/
├── index.html                # the tool itself (home page)
├── about.html
├── privacy-policy.html       # has [BRACKETED] placeholders — fill before launch
├── terms.html                # has [BRACKETED] placeholders — fill before launch
├── contact.html              # needs a Google Form embed URL — see comment in file
├── robots.txt
├── sitemap.xml
├── css/style.css
├── js/splitter.js            # all the splitting logic
└── blog/
    ├── index.html
    └── split-video-for-instagram-reels.html   # first SEO post
```

## Before you go live — checklist

1. **Fill placeholders**: search the project for `[YOUR` and `[DATE]` —
   these are in `about.html`, `privacy-policy.html`, `terms.html`,
   `contact.html`.
2. **Contact form**: create a Google Form (fields: Name, Email, Message),
   link it to a Google Sheet, grab its embed URL, paste into
   `contact.html` where it says `YOUR_GOOGLE_FORM_EMBED_URL`.
3. **Test on a real phone** — iPhone 12 Pro and a mid-range Android at
   minimum — with a video in the 200-400MB range before calling this done.
4. **Domain**: point splitvideo.in's DNS at Cloudflare once deployed
   (Cloudflare Pages settings → Custom domains).

## Deploying to Cloudflare Pages

1. Push this folder to a new GitHub repo.
2. In the Cloudflare dashboard: Workers & Pages → Create → Pages →
   Connect to Git → select the repo.
3. Build settings: **no build command needed**, output directory = `/`
   (this is a static site — leave the framework preset as "None").
4. Deploy. Cloudflare gives you a `*.pages.dev` URL immediately.
5. Add your custom domain: Pages project → Custom domains → add
   `splitvideo.in` (and `www.splitvideo.in` if you want both).

## After launch

- Add the site to **Google Search Console** (Search Console → Add property
  → HTML tag or DNS verification) so you can see what's actually ranking.
- Once you have some organic traffic, apply for **Google AdSense**.
- Add 3-4 more blog posts targeting specific search terms (WhatsApp Status,
  YouTube Shorts, podcast clipping) — the blog folder is set up to make
  this a copy-paste of the existing post's structure.

## Known limitations (be upfront about these with users)

- Files over ~500MB may fail or crash the browser tab — this is a
  fundamental ffmpeg.wasm/browser memory constraint, not a bug to "fix"
  without moving processing server-side.
- Processing speed depends entirely on the user's device — a modern
  laptop will be much faster than a budget phone.
- Auto-download of multiple clips may be blocked by the browser's popup/
  download permission on first use — some browsers ask the user to allow
  multiple downloads from the site.
