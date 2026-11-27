/**
 * A flow is one change followed stage by stage. The same data drives the clickable <Flow> on a page
 * and is meant to drive the scenes of the video guide: one stage = one scene, `voiceOver` = its script.
 * Everything is plain text; colours are added when it is drawn (src/components/highlight.tsx).
 */
export interface FlowStage {
	/** Short name on the track, e.g. `Specs`. */
	label: string;
	/** Who acts at this stage. */
	who: 'you' | 'agent';
	title: string;
	/** What the agent does. */
	agent: string;
	/** What the developer does. */
	you: string;
	/** One or two sentences for the narrator of the video. */
	voiceOver: string;
	/** File name or window title of the artifact shown. */
	file: string;
	/** How to colour `code`: a chat transcript, a Markdown artifact or a test file. */
	lang: 'chat' | 'md' | 'js';
	code: string;
}

export interface Flow {
	/** Change name, e.g. `add-promo-code`. */
	name: string;
	/** The request the change starts from, as the client wrote it. */
	brief: string;
	schema: string;
	stages: FlowStage[];
}
