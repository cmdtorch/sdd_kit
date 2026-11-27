/** Icons of the sidebar groups, by group label (14×14, stroke = currentColor). */
const icons: Record<string, string> = {
	'Get started':
		'<path d="M4.5 3l6 4-6 4V3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
	Walkthrough:
		'<circle cx="3" cy="11" r="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="3" r="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 11H8a2 2 0 000-4H6a2 2 0 010-4h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
	Practices:
		'<path d="M7 1.8l1.5 3.3 3.6.4-2.7 2.4.8 3.5L7 9.6l-3.2 1.8.8-3.5L1.9 5.5l3.6-.4L7 1.8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
	Reference:
		'<path d="M5 3L1.8 7 5 11M9 3l3.2 4L9 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
};

const fallback = '<circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.4"/>';

export function groupIcon(label: string): string {
	return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">${icons[label] ?? fallback}</svg>`;
}
