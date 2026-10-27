#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// boundary-guard — PreToolUse hook (Bash). The agent changes nothing outside the project without the
// developer's consent (openspec/protocols/apply.md, "Nothing outside the project"). For a command that acts
// outside the project the hook answers "ask": Claude Code shows the reason and the developer approves or
// refuses. Matched, in any part of a command line (`;`, `&&`, `||`, `|`, `$(…)`):
//   - sudo / doas / su
//   - system package managers that install or remove (apt, apt-get, dnf, yum, zypper, pacman, apk, brew,
//     port, snap, choco, winget) and global installs (npm/pnpm/bun -g, yarn global, pip --user, pipx,
//     gem, cargo install, go install)
//   - stopping programs: kill, pkill, killall, fuser -k; system services: systemctl / service stop|restart|…
//   - Docker / Podman commands that stop or remove containers, images, volumes or networks
//     (stop, kill, rm, rmi, prune, … and `volume rm`, `network rm`, `system prune`, …)
// `docker compose …` / `docker-compose …` of the project is not matched. It asks at every stage, not only
// during apply; the protocol rule stays as the second line for what the patterns miss.
import { runHook, ask } from '../lib/hook-io.mjs';
import { isMain } from '../lib/report.mjs';

const WRAPPERS = new Set(['env', 'nohup', 'time', 'exec', 'command', 'xargs', 'nice', 'stdbuf', 'timeout']);
const SYSTEM_PM = new Set(['apt', 'apt-get', 'aptitude', 'dnf', 'yum', 'zypper', 'pacman', 'apk', 'brew', 'port', 'snap', 'choco', 'winget']);
const PM_ACTIONS = /^(install|reinstall|add|upgrade|remove|uninstall|purge|-S\w*|-R\w*|-U\w*|link|tap)$/;
const KILLERS = new Set(['kill', 'pkill', 'killall']);
const DOCKER_VERBS = new Set(['stop', 'kill', 'rm', 'rmi', 'prune', 'restart', 'pause']);
const DOCKER_OBJECTS = new Set(['container', 'image', 'volume', 'network', 'system', 'builder', 'buildx']);
const SERVICE_VERBS = /^(stop|start|restart|reload|disable|enable|mask|kill)$/;

/** Parts of a command line, split at `;`, `&&`, `||`, `|`, `&`, newlines and `$(` / backticks. */
export function commandParts(command) {
  return String(command)
    .split(/&&|\|\||[;|&\n`]|\$\(|\)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Words of one part, quotes removed, leading VAR=value and wrappers (env, xargs, …) dropped. */
function words(part) {
  const w = (part.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((x) => x.replace(/^["']|["']$/g, ''));
  let i = 0;
  while (i < w.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i])) {
      i++;
      continue;
    }
    if (!WRAPPERS.has(w[i])) break;
    i++;
    while (i < w.length && (w[i].startsWith('-') || /^\d+[smhd]?$/.test(w[i]))) i++; // wrapper options, `timeout 30`
  }
  return w.slice(i);
}

const base = (p) => (p || '').replace(/^.*\//, '');

/** What a part does outside the project, or null. */
function outside(part) {
  const w = words(part);
  const cmd = base(w[0]);
  const rest = w.slice(1);
  const has = (...flags) => rest.some((a) => flags.includes(a));
  if (cmd === 'sudo' || cmd === 'doas' || cmd === 'su') {
    const inner = outside(rest.slice(Math.max(0, rest.findIndex((a) => !a.startsWith('-')))).join(' '));
    return `runs as administrator (${cmd})${inner ? `; ${inner}` : ''}`;
  }
  if (SYSTEM_PM.has(cmd) && rest.some((a) => PM_ACTIONS.test(a))) return `installs or removes programs with the system package manager (${cmd})`;
  if ((cmd === 'npm' || cmd === 'pnpm' || cmd === 'bun') && has('-g', '--global', '--location=global')) return `installs a global package (${cmd} -g)`;
  if (cmd === 'yarn' && rest[0] === 'global') return 'installs a global package (yarn global)';
  if (/^pip[0-9.]*$/.test(cmd) && rest[0] === 'install' && has('--user', '--break-system-packages')) return `installs a package for the user, outside the project (${cmd} install --user)`;
  if (cmd === 'pipx' || ((cmd === 'gem' || cmd === 'cargo' || cmd === 'go') && rest[0] === 'install')) return `installs a program outside the project (${cmd} install)`;
  if (KILLERS.has(cmd) || (cmd === 'fuser' && rest.some((a) => /^-\w*k/.test(a)))) return `stops a program (${cmd}); it may not belong to the project`;
  if ((cmd === 'systemctl' && rest.some((a) => SERVICE_VERBS.test(a))) || (cmd === 'service' && SERVICE_VERBS.test(rest[1] || ''))) return `changes a system service (${cmd})`;
  if (cmd === 'docker' || cmd === 'podman') {
    const args = rest.filter((a) => !a.startsWith('-'));
    if (args[0] === 'compose') return null;
    const verb = DOCKER_OBJECTS.has(args[0]) ? args[1] : args[0];
    if (DOCKER_VERBS.has(verb) || (DOCKER_OBJECTS.has(args[0]) && /^(rm|remove|prune)$/.test(verb || ''))) {
      return `stops or removes Docker objects (${cmd} ${DOCKER_OBJECTS.has(args[0]) ? `${args[0]} ` : ''}${verb}); they may not belong to the project`;
    }
  }
  return null;
}

/** Reason to ask for a Bash command, or null when it stays inside the project. */
export function guardReason(command) {
  const found = [...new Set(commandParts(command).map(outside).filter(Boolean))];
  if (!found.length) return null;
  return [
    `sdd-kit boundary-guard: this command acts outside the project — it ${found.join('; it ')}.`,
    'Approve it only when you agreed to this action. The agent must not change programs, services, Docker objects or settings outside the project without your consent; it reports the problem and suggests options instead (openspec/protocols/apply.md).',
  ].join('\n');
}

if (isMain(import.meta.url)) {
  runHook('boundary-guard', (input) => {
    if (input.tool_name !== 'Bash') return;
    const reason = guardReason(input.tool_input?.command || '');
    if (reason) ask(reason);
  });
}
