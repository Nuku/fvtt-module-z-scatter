import { getSetting } from './settings.js';

type TokenExpanded = Token & { mesh: any; destroyed: boolean; isAnimating: boolean };

const offset = 0.4,
	rad = Math.PI * 2,
	baseRotation = Math.PI / 4;

function repositionToken(token: TokenExpanded, rotation: number, pos = 0) {
	const size = (token.scene.dimensions as Canvas.Dimensions).size,
		x = Math.sin(rotation * pos + baseRotation) * offset * token.document.width * size,
		y = Math.cos(rotation * pos + baseRotation) * offset * token.document.height * size;

	token.border!.x = token.document.x - x;
	token.border!.y = token.document.y - y;

	(token.hitArea as any).x = -x;
	(token.hitArea as any).y = -y;

	const gridOffset = size / 2;
	token.mesh.x = token.border!.x + gridOffset * token.document.width;
	token.mesh.y = token.border!.y + gridOffset * token.document.height;
}

let SNAPPED_TOKENS: TokenDocument[][] = [];

function findGroup(token: TokenDocument) {
	for (const group of SNAPPED_TOKENS) {
		for (const t of group) {
			if (token === t) return group;
		}
	}
}

function sameGroup(oldGroup: TokenDocument[], newGroup: TokenDocument[]) {
	if (oldGroup.length !== newGroup.length) return false;
	for (const t of oldGroup) {
		if (!newGroup.includes(t)) return false;
	}
	return true;
}

export function refreshAll(groups: TokenDocument[][] | TokenDocument[] = SNAPPED_TOKENS) {
	for (const t of SNAPPED_TOKENS.flat()) {
		t.object?.refresh();
	}
}

function snapToken(
	token: TokenExpanded,
	options: Partial<{
		bars: boolean;
		border: boolean;
		effects: boolean;
		elevation: boolean;
		nameplate: boolean;
	}>
) {
	if (token.isAnimating) return;
	if (!getSetting('snapTokens')) {
		(token.hitArea as any).x = 0;
		(token.hitArea as any).y = 0;
		return;
	}

	const oldGroup = findGroup(token.document);

	const x = token.document.x,
		y = token.document.y,
		height = token.document.height,
		width = token.document.width;

	const tokens = token.scene.tokens.contents.filter(
		(token: TokenDocument & { object: any }) =>
			!token.object?.destroyed && token.object.x === x && token.object.y === y && token.height === height && token.width === width
	);
	if (tokens.length === 1) {
		(token.hitArea as any).x = 0;
		(token.hitArea as any).y = 0;
		if (oldGroup) {
			if (oldGroup.length > 1) {
				const idx = oldGroup.indexOf(token.document);
				oldGroup.splice(idx, 1);
				refreshAll(oldGroup);
			} else {
				const idx = SNAPPED_TOKENS.indexOf(oldGroup);
				SNAPPED_TOKENS.splice(idx, 1);
			}
		}
		return;
	}

	if (oldGroup && !sameGroup(oldGroup, tokens)) {
		const idx = oldGroup.indexOf(token.document);
		oldGroup.splice(idx, 1);
		if (oldGroup.length) refreshAll(oldGroup);
		else {
			const idx = SNAPPED_TOKENS.indexOf(oldGroup);
			SNAPPED_TOKENS.splice(idx, 1);
		}
	}
	const newGroup = findGroup(tokens.find((t) => t !== token.document)!);
	if (newGroup) {
		const idx = SNAPPED_TOKENS.indexOf(newGroup);
		SNAPPED_TOKENS.splice(idx, 1);
	}
	SNAPPED_TOKENS.push(tokens);

	const angle = rad / tokens.length;
	for (let i = 0; i < tokens.length; i++) repositionToken(tokens[i].object as TokenExpanded, angle, i);
}

Hooks.on('refreshToken', snapToken);
Hooks.on('canvasTearDown', () => (SNAPPED_TOKENS = []));