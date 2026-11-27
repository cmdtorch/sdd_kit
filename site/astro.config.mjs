// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// The site shows the version of the kit it documents: the root package.json, one folder up.
let kitVersion = '';
try {
	kitVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
} catch {
	// Built without the kit beside it: the header shows no version.
}

// https://astro.build/config
export default defineConfig({
	vite: { define: { __KIT_VERSION__: JSON.stringify(kitVersion) } },
	integrations: [
		starlight({
			title: 'sdd-kit',
			description: 'Spec-Driven Development for small teams on OpenSpec and Claude Code.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/cmdtorch/sdd_kit' }],
			customCss: [
				'@fontsource-variable/geist',
				'@fontsource-variable/geist-mono',
				'./src/styles/glass.css',
			],
			components: {
				Header: './src/components/Header.astro',
				Sidebar: './src/components/Sidebar.astro',
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/Empty.astro',
			},
			// The top-level groups are also the sections of the header (src/components/Header.astro).
			// A group's icon is picked by its label in src/components/sidebar-icons.ts.
			sidebar: [
				{
					label: 'Get started',
					items: [
						{ label: 'What sdd-kit adds', slug: 'start/what-it-adds' },
						{ label: 'Install', slug: 'start/install' },
						{ label: 'Your first change', slug: 'start/first-change' },
					],
				},
				{
					label: 'Walkthrough',
					items: [{ label: 'Promo code at checkout', slug: 'walkthrough/promo-code' }],
				},
				{
					label: 'Practices',
					items: [
						{ label: 'Choosing a schema', slug: 'practices/choosing-a-schema' },
						{ label: 'Answering questions', slug: 'practices/answering-questions' },
						{ label: 'Tests that prove', slug: 'practices/tests-that-prove' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Commands', slug: 'reference/commands' },
						{ label: 'Hooks and gates', slug: 'reference/hooks-and-gates' },
						{ label: 'Doctor', slug: 'reference/doctor' },
					],
				},
			],
		}),
		react(),
	],
});
