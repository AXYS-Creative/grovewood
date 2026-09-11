#!/usr/bin/env node
/**
 * Scaffolds the mechanical parts of a new section-stack page (page njk,
 * admin/config.yml collection, admin/index.njk preview registrations) by
 * cloning the field schema of the existing `page_talk_therapy` entries,
 * since that page currently covers every section kind we reuse.
 *
 * This only handles structure — it never touches the actual copy in
 * src/_data/page_<slug>/*.yaml. Write that content by hand afterward.
 *
 * Usage:
 *   node scripts/scaffold-section-page.js <slug> <section1,section2,...>
 *
 * Example:
 *   node scripts/scaffold-section-page.js medication-management \
 *     hero,text_stack,carousel_full,text_invite,common_questions,testimonial_carousel,stats
 *
 * Section kinds: hero, text_stack, text_invite, carousel_full, image_grid,
 * testimonial_carousel, stats, common_questions
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "src/admin/config.yml");
const INDEX_PATH = path.join(ROOT, "src/admin/index.njk");

const SOURCE_SLUG_UNDERSCORE = "talk_therapy";
const SOURCE_SLUG_DASH = "talk-therapy";

const SECTION_KINDS = {
  hero: {
    sourceName: "talk_therapy_hero",
    njkVar: "hero_simple",
    include: "./_includes/sections/hero-simple.njk",
    preview: "HeroSimplePreview",
  },
  text_stack: {
    sourceName: "talk_therapy_text_stack",
    njkVar: "text_stack",
    include: "./_includes/sections/text-stack.njk",
    preview: "TextStackPreview",
  },
  text_invite: {
    sourceName: "talk_therapy_text_invite",
    njkVar: "text_stack",
    include: "./_includes/sections/text-stack.njk",
    preview: "TextStackPreview",
  },
  carousel_full: {
    sourceName: "talk_therapy_carousel_full",
    njkVar: "carousel_full",
    include: "./_includes/sections/carousel-full.njk",
    preview: "CarouselFullPreview",
  },
  image_grid: {
    sourceName: "talk_therapy_image_grid",
    njkVar: "image_grid",
    include: "./_includes/sections/image-grid.njk",
    preview: "ImageGridPreview",
  },
  testimonial_carousel: {
    sourceName: "talk_therapy_testimonial_carousel",
    njkVar: "testimonial_carousel",
    include: "./_includes/sections/testimonial-carousel.njk",
    preview: "TestimonialCarouselPreview",
  },
  stats: {
    sourceName: "talk_therapy_stats",
    njkVar: "stats",
    include: "./_includes/sections/stats.njk",
    preview: "StatsPreview",
  },
  common_questions: {
    sourceName: "talk_therapy_common_questions",
    njkVar: "common_questions",
    include: "./_includes/sections/common-questions.njk",
    preview: "CommonQuestionsPreview",
  },
};

function titleCase(slugDash) {
  return slugDash
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function extractConfigBlock(lines, sourceName) {
  const startPattern = new RegExp(`^      - name: ${sourceName}$`);
  const startIdx = lines.findIndex((l) => startPattern.test(l));
  if (startIdx === -1) {
    throw new Error(`Could not find config.yml block for "${sourceName}"`);
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^      - name: /.test(lines[i]) || /^  - name: /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

function renameBlock(blockLines, toSlugUnderscore, toSlugDash) {
  return blockLines.map((line) =>
    line
      .split(SOURCE_SLUG_UNDERSCORE)
      .join(toSlugUnderscore)
      .split(SOURCE_SLUG_DASH)
      .join(toSlugDash),
  );
}

function main() {
  const [slugDash, sectionsArg] = process.argv.slice(2);
  if (!slugDash || !sectionsArg) {
    console.error(
      "Usage: node scripts/scaffold-section-page.js <slug> <section1,section2,...>",
    );
    console.error(`Known section kinds: ${Object.keys(SECTION_KINDS).join(", ")}`);
    process.exit(1);
  }

  const slugUnderscore = slugDash.replace(/-/g, "_");
  const kinds = sectionsArg.split(",").map((s) => s.trim());

  for (const kind of kinds) {
    if (!SECTION_KINDS[kind]) {
      console.error(`Unknown section kind "${kind}".`);
      console.error(`Known section kinds: ${Object.keys(SECTION_KINDS).join(", ")}`);
      process.exit(1);
    }
  }

  // --- 1. admin/config.yml: build the new collection from renamed blocks ---
  const configText = fs.readFileSync(CONFIG_PATH, "utf8");
  const configLines = configText.split("\n");

  const renamedBlocks = kinds.map((kind) => {
    const { sourceName } = SECTION_KINDS[kind];
    const block = extractConfigBlock(configLines, sourceName);
    return renameBlock(block, slugUnderscore, slugDash).join("\n");
  });

  const newCollection = [
    `  - name: page_${slugUnderscore}`,
    `    label: Page - ${titleCase(slugDash)}`,
    `    # description:`,
    `    files:`,
    ...renamedBlocks.join("\n").split("\n"),
  ].join("\n");

  const page404Idx = configLines.findIndex((l) => /^  - name: page_404$/.test(l));
  if (page404Idx === -1) {
    throw new Error("Could not find `  - name: page_404` insertion point in config.yml");
  }
  const newConfigLines = [
    ...configLines.slice(0, page404Idx),
    ...newCollection.split("\n"),
    ...configLines.slice(page404Idx),
  ];
  fs.writeFileSync(CONFIG_PATH, newConfigLines.join("\n"));
  console.log(`Added "page_${slugUnderscore}" collection to ${path.relative(ROOT, CONFIG_PATH)}`);

  // --- 2. admin/index.njk: register preview components for each file ---
  const indexText = fs.readFileSync(INDEX_PATH, "utf8");
  const registrations = kinds
    .map((kind) => {
      const fileName = SECTION_KINDS[kind].sourceName.replace(
        SOURCE_SLUG_UNDERSCORE,
        slugUnderscore,
      );
      return `      CMS.registerPreviewTemplate("${fileName}", ${SECTION_KINDS[kind].preview});`;
    })
    .join("\n");

  const marker = '      CMS.registerPreviewTemplate("footer_simple", FooterSimplePreview);';
  if (!indexText.includes(marker)) {
    throw new Error("Could not find footer_simple registration marker in admin/index.njk");
  }
  const newIndexText = indexText.replace(
    marker,
    `      // ${titleCase(slugDash)} page reuses the same section preview components.\n${registrations}\n${marker}`,
  );
  fs.writeFileSync(INDEX_PATH, newIndexText);
  console.log(`Registered ${kinds.length} preview template(s) in ${path.relative(ROOT, INDEX_PATH)}`);

  // --- 3. page njk ---
  const pageBody = kinds
    .map((kind) => {
      const { njkVar, sourceName, include } = SECTION_KINDS[kind];
      const fileName = sourceName.replace(SOURCE_SLUG_UNDERSCORE, slugUnderscore);
      return `<!-- prettier-ignore -->\n{% set ${njkVar} = page_${slugUnderscore}.${fileName} %}\n{% include '${include}' %}`;
    })
    .join("\n\n");

  const pageContent = `---\nlayout: app\npath: ${slugDash}\n---\n\n${pageBody}\n`;
  const pagePath = path.join(ROOT, "src", `${slugDash}.njk`);
  if (fs.existsSync(pagePath)) {
    throw new Error(`${path.relative(ROOT, pagePath)} already exists — not overwriting.`);
  }
  fs.writeFileSync(pagePath, pageContent);
  console.log(`Created ${path.relative(ROOT, pagePath)}`);

  console.log("\nStill needed by hand:");
  console.log(`  - src/_data/page_${slugUnderscore}/*.yaml (real copy for each section)`);
  console.log(`  - meta_data.yaml page_details entry for path: ${slugDash}`);
}

main();
