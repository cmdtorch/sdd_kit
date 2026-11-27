import type { ReactNode } from 'react';
import type { FlowStage } from '../data/flows/types';

/**
 * Colours the plain text of a flow stage. The data stays plain so the same text can be drawn
 * elsewhere (the video); the rules below know only the kit's own formats.
 */
type Rule = [className: string, pattern: RegExp];

const COMMON: Rule[] = [
	['ok', /✓|\b\d+ passing\b|\bREADY\b/],
	['bad', /✗|\b\d+ failing\b/],
	['c', /^[>→] .*$/],
];

const RULES: Record<FlowStage['lang'], Rule[]> = {
	chat: [...COMMON, ['k', /^\/[\w-]+/]],
	md: [
		['c', /^(?:Why this is asked|Recommended):.*$/],
		['k', /^#{1,4} .*$/],
		['k', /\*\*[A-Z]+\*\*/],
		['s', /\[Answer\]:.*$|\[(?:Q\d+|D\d+|U\d+|desc)\]/],
		['s', /"[^"\n]*"/],
		...COMMON,
	],
	js: [
		['c', /\/\/.*$/],
		['s', /'[^'\n]*'/],
		['k', /\b(?:const|test|expect)\b/],
		...COMMON,
	],
};

function line(text: string, rules: Rule[], key: number): ReactNode {
	const out: ReactNode[] = [];
	let rest = text;
	let n = 0;
	while (rest) {
		// The earliest match wins; among equals, the first rule.
		let best: { cls: string; index: number; match: string } | undefined;
		for (const [cls, pattern] of rules) {
			// `^` and `$` mean the whole line, so anchored rules apply only before anything is consumed.
			if (pattern.source.startsWith('^') && rest !== text) continue;
			const m = pattern.exec(rest);
			if (m && m[0] && (!best || m.index < best.index)) best = { cls, index: m.index, match: m[0] };
		}
		if (!best) break;
		if (best.index) out.push(rest.slice(0, best.index));
		out.push(
			<span className={`tok-${best.cls}`} key={n++}>
				{best.match}
			</span>
		);
		rest = rest.slice(best.index + best.match.length);
	}
	if (rest) out.push(rest);
	return (
		<span key={key}>
			{out}
			{'\n'}
		</span>
	);
}

export function highlight(code: string, lang: FlowStage['lang']): ReactNode {
	return code.split('\n').map((text, i) => line(text, RULES[lang], i));
}
