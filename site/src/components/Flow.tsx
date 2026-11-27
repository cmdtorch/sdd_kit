import { useCallback, useEffect, useRef, useState } from 'react';
import type { Flow as FlowData } from '../data/flows/types';
import { FLOW_GOTO, FLOW_HELLO, FLOW_STATE, type FlowState } from './flow-events';
import { highlight } from './highlight';
import './flow.css';

const SCENE_MS = 3800;

/** A change followed stage by stage: a clickable track, notes for each stage and the artifact it leaves. */
export default function Flow({ flow }: { flow: FlowData }) {
	const [index, setIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const tabs = useRef<(HTMLButtonElement | null)[]>([]);
	const last = flow.stages.length - 1;
	const stage = flow.stages[index]!;

	const go = useCallback(
		(i: number) => {
			setPlaying(false);
			setIndex(((i % (last + 1)) + last + 1) % (last + 1));
		},
		[last]
	);

	// Play: one stage per scene, stop at the last one.
	useEffect(() => {
		if (!playing) return;
		if (index === last) {
			setPlaying(false);
			return;
		}
		const t = setTimeout(() => setIndex(index + 1), SCENE_MS);
		return () => clearTimeout(t);
	}, [playing, index, last]);

	// Keep the mini-map in the sidebar in step (src/components/Sidebar.astro).
	useEffect(() => {
		const announce = () => {
			const detail: FlowState = { name: flow.name, labels: flow.stages.map((s) => s.label), index };
			dispatchEvent(new CustomEvent(FLOW_STATE, { detail }));
		};
		const onGoto = (e: Event) => go((e as CustomEvent<{ index: number }>).detail.index);
		announce();
		addEventListener(FLOW_HELLO, announce);
		addEventListener(FLOW_GOTO, onGoto);
		return () => {
			removeEventListener(FLOW_HELLO, announce);
			removeEventListener(FLOW_GOTO, onGoto);
		};
	}, [flow, index, go]);

	const onKey = (e: React.KeyboardEvent) => {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (!step) return;
		e.preventDefault();
		const next = (index + step + last + 1) % (last + 1);
		go(next);
		tabs.current[next]?.focus();
	};

	return (
		<section className="flow glass not-content" aria-label={`Flow of the change ${flow.name}`}>
			<div className="flow-head">
				<p className="flow-brief">
					The brief: <q>{flow.brief}</q> Schema <code>{flow.schema}</code>.
				</p>
				<div className="flow-ctl">
					<button type="button" className="flow-btn" onClick={() => go(index - 1)} aria-label="Previous stage">
						←
					</button>
					<button
						type="button"
						className="flow-btn primary"
						onClick={() => {
							if (!playing && index === last) setIndex(0);
							setPlaying(!playing);
						}}
					>
						{playing ? '❚❚ Pause' : '▶ Play'}
					</button>
					<button type="button" className="flow-btn" onClick={() => go(index + 1)} aria-label="Next stage">
						→
					</button>
				</div>
			</div>

			<div className="flow-track-wrap">
				<div
					className="flow-track"
					role="tablist"
					onKeyDown={onKey}
					style={{ gridTemplateColumns: `repeat(${last + 1}, minmax(4.75rem, 1fr))`, ['--half' as string]: `${50 / (last + 1)}%` }}
				>
					<div className="flow-fill" style={{ width: `${(index / last) * (100 - 100 / (last + 1))}%` }} />
					{flow.stages.map((s, i) => (
						<button
							key={s.label}
							ref={(el) => {
								tabs.current[i] = el;
							}}
							type="button"
							role="tab"
							aria-selected={i === index}
							tabIndex={i === index ? 0 : -1}
							className={`flow-step${i < index ? ' done' : ''}`}
							onClick={() => go(i)}
						>
							<span className="flow-dot">{i + 1}</span>
							<span>{s.label}</span>
							<span className="flow-who">{s.who}</span>
						</button>
					))}
				</div>
			</div>

			<div className="flow-stage" role="tabpanel" key={index}>
				<div className="flow-notes">
					<h3 className="flow-title">{stage.title}</h3>
					<div className="flow-note">
						<div className="flow-lbl">Agent</div>
						<p>{stage.agent}</p>
					</div>
					<div className="flow-note">
						<div className="flow-lbl">You</div>
						<p>{stage.you}</p>
					</div>
					<div className="flow-note vo">
						<div className="flow-lbl">Voice-over</div>
						<p>{stage.voiceOver}</p>
					</div>
				</div>
				<div className="flow-win">
					<div className="flow-win-bar">
						<span />
						<span />
						<span />
						<em>{stage.file}</em>
					</div>
					<pre>{highlight(stage.code, stage.lang)}</pre>
				</div>
			</div>
		</section>
	);
}
