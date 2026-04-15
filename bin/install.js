#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const SKILL_NAMES = fs.readdirSync(SKILLS_DIR).filter((d) =>
  fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md'))
);

const PKG = require('../package.json');
const PKG_NAME = PKG.name;
const PKG_VERSION = PKG.version;

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// ── Tool definitions ──

const TOOLS = [
  {
    type: 'claude',
    detect: ['.claude'],
    projectDir: '.claude/skills',
    globalDir: path.join(os.homedir(), '.claude', 'skills'),
    label: 'Claude Code',
    prefix: '/',
  },
  {
    type: 'cursor',
    detect: ['.cursor', '.cursorrules'],
    projectDir: '.cursor/rules',
    label: 'Cursor',
    prefix: '@',
  },
  {
    type: 'windsurf',
    detect: ['.windsurf', '.windsurfrules'],
    projectDir: '.windsurf/rules',
    label: 'Windsurf',
    prefix: '',
  },
  {
    type: 'codex',
    detect: ['.agents', 'AGENTS.md'],
    projectDir: '.agents/skills',
    globalDir: path.join(os.homedir(), '.agents', 'skills'),
    label: 'Codex',
    prefix: '$',
  },
];

const args = process.argv.slice(2);
const isGlobal = args.includes('--global') || args.includes('-g');
const isCheck = args.includes('--check');

// ── SKILL.md parsing ──

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { meta, body: match[2] };
}

// ── File helpers ──

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteTemplatePaths(body, templatesRelPath) {
  return body.replace(/Read templates\//g, `Read ${templatesRelPath}/`);
}

// ── Installers per tool type ──

function installClaude(name, destDir) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillDir = path.join(destDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const templatesDir = path.join(srcDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    copyDirRecursive(templatesDir, path.join(skillDir, 'templates'));
  }
}

function installCursor(name, destDir, cwd) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillMd = fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8');
  const { meta, body } = parseFrontmatter(skillMd);

  const templatesDir = path.join(srcDir, 'templates');
  const hasTemplates = fs.existsSync(templatesDir);
  if (hasTemplates) {
    copyDirRecursive(templatesDir, path.join(destDir, name, 'templates'));
  }

  let content = body;
  if (hasTemplates) {
    const relPath = path.relative(cwd, path.join(destDir, name, 'templates'));
    content = rewriteTemplatePaths(content, relPath);
  }

  const description = meta.description || name;
  const hint = meta['argument-hint'] ? ` — ${meta['argument-hint']}` : '';
  const mdc = `---
description: ${description}${hint}
globs:
alwaysApply: false
---

${content}`;

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${name}.mdc`), mdc);
}

function installWindsurf(name, destDir, cwd) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillMd = fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8');
  const { body } = parseFrontmatter(skillMd);

  const templatesDir = path.join(srcDir, 'templates');
  const hasTemplates = fs.existsSync(templatesDir);
  if (hasTemplates) {
    copyDirRecursive(templatesDir, path.join(destDir, name, 'templates'));
  }

  let content = body;
  if (hasTemplates) {
    const relPath = path.relative(cwd, path.join(destDir, name, 'templates'));
    content = rewriteTemplatePaths(content, relPath);
  }

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${name}.md`), content);
}

function installCodex(name, destDir) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillDir = path.join(destDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const templatesDir = path.join(srcDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    copyDirRecursive(templatesDir, path.join(skillDir, 'templates'));
  }
}

// ── Main install function ──

function install(destDir, tool, cwd) {
  for (const name of SKILL_NAMES) {
    switch (tool.type) {
      case 'claude': installClaude(name, destDir); break;
      case 'cursor': installCursor(name, destDir, cwd); break;
      case 'windsurf': installWindsurf(name, destDir, cwd); break;
      case 'codex': installCodex(name, destDir); break;
    }
    const relDest = path.relative(cwd, destDir) || destDir;
    console.log(`  ${green('✓')} ${name} → ${dim(relDest)} ${dim(`(${tool.label})`)}`);
  }
}

// ── Detection ──

function detectTools(cwd) {
  const detected = [];
  for (const tool of TOOLS) {
    for (const marker of tool.detect) {
      if (fs.existsSync(path.join(cwd, marker))) {
        detected.push(tool);
        break;
      }
    }
  }
  return detected;
}

// ── Version check (npm registry) ──

function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(
      `https://registry.npmjs.org/${PKG_NAME}/latest`,
      { headers: { accept: 'application/json' }, timeout: 3000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body).version || null); }
          catch { resolve(null); }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Compare two semver-ish strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
// Pre-release suffixes are compared as strings (good enough for a check hint).
function compareVersions(a, b) {
  const [aCore, aPre = ''] = a.split('-');
  const [bCore, bPre = ''] = b.split('-');
  const ap = aCore.split('.').map((n) => parseInt(n, 10) || 0);
  const bp = bCore.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((ap[i] || 0) !== (bp[i] || 0)) return (ap[i] || 0) > (bp[i] || 0) ? 1 : -1;
  }
  if (aPre === bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  return aPre > bPre ? 1 : -1;
}

async function runCheck() {
  console.log();
  console.log(`  ${bold('FinalApproval Skills')} ${dim(`v${PKG_VERSION} installed`)}`);
  const latest = await fetchLatestVersion();
  if (!latest) {
    console.log(`  ${dim('Could not reach the npm registry — check your network.')}`);
    console.log();
    return;
  }
  const cmp = compareVersions(PKG_VERSION, latest);
  if (cmp === 0) {
    console.log(`  ${green('✓')} Up to date ${dim(`(latest: v${latest})`)}`);
  } else if (cmp > 0) {
    console.log(`  ${green('✓')} Ahead of npm ${dim(`(installed: v${PKG_VERSION}, latest: v${latest})`)}`);
  } else {
    console.log(`  ${yellow('↑')} Update available: ${bold(`v${latest}`)} ${dim(`(installed: v${PKG_VERSION})`)}`);
    console.log(`  ${dim('Upgrade:')} ${cyan('npx final-approval-skills@latest')}`);
  }
  console.log();
}

// ── Main ──

function main() {
  if (isCheck) {
    return runCheck();
  }

  const cwd = process.cwd();

  console.log();
  console.log(`  ${bold('FinalApproval Skills')} ${dim(`v${PKG_VERSION}`)}`);
  console.log(`  ${dim('Community skills for AI coding tools — re-run any time to update')}`);
  console.log();

  if (isGlobal) {
    for (const tool of TOOLS) {
      if (tool.globalDir) {
        install(tool.globalDir, tool, cwd);
        console.log();
      }
    }
  } else {
    let detected = detectTools(cwd);

    if (detected.length === 0) {
      detected = [TOOLS[0]];
      console.log(`  ${dim('No tool config detected — defaulting to Claude Code')}`);
      console.log();
    } else {
      console.log(`  ${dim(`Detected: ${detected.map((t) => t.label).join(', ')}`)}`);
      console.log();
    }

    for (const tool of detected) {
      const destDir = path.join(cwd, tool.projectDir);
      install(destDir, tool, cwd);
      console.log();
    }
  }

  // Usage hints
  console.log(`  ${bold('Usage:')}`);
  const tools = isGlobal
    ? TOOLS.filter((t) => t.globalDir)
    : detectTools(cwd).length > 0
      ? detectTools(cwd)
      : [TOOLS[0]];

  for (const tool of tools) {
    const names = SKILL_NAMES.map((n) => `${tool.prefix}${n}`).join('  ');
    console.log(`  ${bold(tool.label + ':')} ${cyan(names)}`);
  }
  console.log();
}

main();
