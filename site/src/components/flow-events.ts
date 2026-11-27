/**
 * How a <Flow> on the page and the mini-map in the sidebar stay in step: window events.
 * The flow announces its state; the mini-map asks for it and sends "go to stage".
 */
export const FLOW_STATE = 'sdd-flow:state';
export const FLOW_GOTO = 'sdd-flow:goto';
export const FLOW_HELLO = 'sdd-flow:hello';

export interface FlowState {
	/** The change the flow walks through, e.g. `add-promo-code`. */
	name: string;
	/** Stage labels, in order. */
	labels: string[];
	/** The stage shown now. */
	index: number;
}
