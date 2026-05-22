export enum TextType {
    Normal = 0,
    Crit = 1,
    Miss = 2,
    Immune = 3,
    Heal = 4,
}

export enum AnimationType {
    RandomTranslate = 0,
    FixedTranslate = 1,
}

export interface ColorLike {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface Vec2Like {
    x: number;
    y: number;
}

export interface TextPreset {
    type: TextType;
    fontSize: number;
    color: ColorLike;
    shadowColor: ColorLike;
    animationType: AnimationType;
    animationTime: number;
    duration: number;
    withSign: boolean;
    spawnOffsetX: number;
    spawnOffsetY: number;
    spawnScaleMultiplier: number;
    gatherDuration: number;
    gatherEndScaleMultiplier: number;
    recoverDuration: number;
    recoverEndScaleMultiplier: number;
    holdDuration: number;
    flyDuration: number;
    flyLaunchForce: number;
    flyGravity: number;
    flySpreadAngle: number;
}

export interface TextState {
    text: string;
    textType: TextType;
    preset: TextPreset;
    elapsed: number;
    originPosition: Vec2Like;
    spawnPosition: Vec2Like;
    flyDirection: Vec2Like;
    baseScale: number;
}

export interface SampledTextState {
    position: Vec2Like;
    scale: number;
    alpha: number;
}

export interface GlyphLayout {
    char: string;
    x: number;
    y: number;
    scale: number;
}

export interface NumberFormatOptions {
    withUnit?: boolean;
    withSign?: boolean;
}

export interface CreateTextStateOptions {
    position: Vec2Like;
    text: string;
    textType: TextType;
    preset: TextPreset;
    randomAngle?: number;
}

export const DEFAULT_CHARSET: Map<string, number> = new Map([
    ['+', 0],
    ['-', 1],
    ['0', 2],
    ['1', 3],
    ['2', 4],
    ['3', 5],
    ['4', 6],
    ['5', 7],
    ['6', 8],
    ['7', 9],
    ['8', 10],
    ['9', 11],
    ['B', 12],
    ['.', 13],
    ['K', 14],
    ['M', 15],
    ['免', 16],
    ['疫', 17],
    ['避', 18],
    ['闪', 19],
    ['格', 20],
    ['挡', 21],
    ['*', 22],
]);

export const DEFAULT_NUMBER_OFFSETS: number[] = [
    0.1191406, 0.2773438, 0.1992188, 0.2285156, 0.1992188, 0.1953125, 0.1796875, 0.1933594,
    0.2011719, 0.2050781, 0.2011719, 0.2011719, 0.1679688, 0.25, 0.1425781, 0.1035156,
    -0.3, -0.3, -0.3, -0.3, -0.3, -0.3,
];

export function cloneColor(color: ColorLike): ColorLike {
    return { r: color.r, g: color.g, b: color.b, a: color.a };
}

function cloneVec2(vec: Vec2Like): Vec2Like {
    return { x: vec.x, y: vec.y };
}

export function createRecommendedPreset(textType: TextType): TextPreset {
    switch (textType) {
        case TextType.Normal:
            return {
                type: textType,
                fontSize: 13,
                color: { r: 1, g: 1, b: 1, a: 1 },
                shadowColor: { r: 0, g: 0, b: 0, a: 115 },
                animationType: AnimationType.RandomTranslate,
                animationTime: 0.42,
                duration: 0.85,
                withSign: false,
                spawnOffsetX: 24,
                spawnOffsetY: 22,
                spawnScaleMultiplier: 3.6,
                gatherDuration: 0.14,
                gatherEndScaleMultiplier: 0.8,
                recoverDuration: 0.04,
                recoverEndScaleMultiplier: 1,
                holdDuration: 0.4,
                flyDuration: 0.8,
                flyLaunchForce: 180,
                flyGravity: 420,
                flySpreadAngle: 38,
            };
        case TextType.Crit:
            return {
                type: textType,
                fontSize: 13,
                color: { r: 1, g: 0.878, b: 0.341, a: 1 },
                shadowColor: { r: 115, g: 38, b: 0, a: 153 },
                animationType: AnimationType.RandomTranslate,
                animationTime: 0.34,
                duration: 1,
                withSign: false,
                spawnOffsetX: 24,
                spawnOffsetY: 10,
                spawnScaleMultiplier: 1.6,
                gatherDuration: 0.34,
                gatherEndScaleMultiplier: 1.02,
                recoverDuration: 0.06,
                recoverEndScaleMultiplier: 1.12,
                holdDuration: 0.07,
                flyDuration: 1,
                flyLaunchForce: 220,
                flyGravity: 360,
                flySpreadAngle: 24,
            };
        case TextType.Miss:
            return {
                type: textType,
                fontSize: 10,
                color: { r: 0.749, g: 0.870, b: 1, a: 1 },
                shadowColor: { r: 13, g: 51, b: 71, a: 115 },
                animationType: AnimationType.FixedTranslate,
                animationTime: 0.22,
                duration: 0.55,
                withSign: false,
                spawnOffsetX: 10,
                spawnOffsetY: 5,
                spawnScaleMultiplier: 1.08,
                gatherDuration: 0.22,
                gatherEndScaleMultiplier: 1,
                recoverDuration: 0.02,
                recoverEndScaleMultiplier: 1,
                holdDuration: 0.02,
                flyDuration: 0.55,
                flyLaunchForce: 120,
                flyGravity: 240,
                flySpreadAngle: 8,
            };
        case TextType.Immune:
            return {
                type: textType,
                fontSize: 10,
                color: { r: 0.949, g: 0.949, b: 1, a: 1 },
                shadowColor: { r: 51, g: 51, b: 89, a: 115 },
                animationType: AnimationType.FixedTranslate,
                animationTime: 0.26,
                duration: 0.65,
                withSign: false,
                spawnOffsetX: 12,
                spawnOffsetY: 6,
                spawnScaleMultiplier: 1.12,
                gatherDuration: 0.26,
                gatherEndScaleMultiplier: 1,
                recoverDuration: 0.03,
                recoverEndScaleMultiplier: 1,
                holdDuration: 0.03,
                flyDuration: 0.65,
                flyLaunchForce: 132,
                flyGravity: 250,
                flySpreadAngle: 10,
            };
        case TextType.Heal:
            return {
                type: textType,
                fontSize: 11,
                color: { r: 0.451, g: 1, b: 0.549, a: 1 },
                shadowColor: { r: 0, g: 64, b: 20, a: 115 },
                animationType: AnimationType.FixedTranslate,
                animationTime: 0.3,
                duration: 0.75,
                withSign: true,
                spawnOffsetX: 14,
                spawnOffsetY: 6,
                spawnScaleMultiplier: 1.18,
                gatherDuration: 0.3,
                gatherEndScaleMultiplier: 0.96,
                recoverDuration: 0.05,
                recoverEndScaleMultiplier: 1.02,
                holdDuration: 0.04,
                flyDuration: 0.75,
                flyLaunchForce: 140,
                flyGravity: 210,
                flySpreadAngle: 12,
            };
        default:
            return createRecommendedPreset(TextType.Normal);
    }
}

function getGatherDuration(preset: TextPreset): number {
    return preset.gatherDuration > 0 ? preset.gatherDuration : (preset.animationTime > 0 ? preset.animationTime : 0.5);
}

function getRecoverDuration(preset: TextPreset): number {
    return preset.recoverDuration > 0 ? preset.recoverDuration : 0.05;
}

function getHoldDuration(preset: TextPreset): number {
    return preset.holdDuration > 0 ? preset.holdDuration : 0.05;
}

function getFlyDuration(preset: TextPreset): number {
    return preset.flyDuration > 0 ? preset.flyDuration : (preset.duration > 0 ? preset.duration : 1);
}

export function getTotalDuration(preset: TextPreset): number {
    return getGatherDuration(preset) + getRecoverDuration(preset) + getHoldDuration(preset) + getFlyDuration(preset);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

function easeOutQuad(x: number): number {
    const t = clamp01(x);
    return 1 - Math.pow(1 - t, 2);
}

function easeOutCubic(x: number): number {
    const t = clamp01(x);
    return 1 - Math.pow(1 - t, 3);
}

function rotateVec2(vec: Vec2Like, degrees: number): Vec2Like {
    const rad = degrees * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: vec.x * cos - vec.y * sin,
        y: vec.x * sin + vec.y * cos,
    };
}

function normalizeVec2(vec: Vec2Like): Vec2Like {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (length <= 0.0001) {
        return { x: 0, y: 1 };
    }

    return {
        x: vec.x / length,
        y: vec.y / length,
    };
}

export function createTextState(options: CreateTextStateOptions): TextState {
    const preset = options.preset;
    const baseScale = preset.fontSize / 18;
    const angle = options.randomAngle || 0;
    const direction = preset.animationType === AnimationType.FixedTranslate ? { x: 0, y: 1 } : rotateVec2({ x: 0, y: 1 }, angle);

    return {
        text: options.text,
        textType: options.textType,
        preset,
        elapsed: 0,
        originPosition: cloneVec2(options.position),
        spawnPosition: {
            x: options.position.x + preset.spawnOffsetX,
            y: options.position.y - preset.spawnOffsetY,
        },
        flyDirection: normalizeVec2(direction),
        baseScale,
    };
}

export function sampleTextState(state: TextState, elapsed: number): SampledTextState {
    const preset = state.preset;
    const gatherDuration = getGatherDuration(preset);
    const recoverDuration = getRecoverDuration(preset);
    const holdDuration = getHoldDuration(preset);
    const flyDuration = getFlyDuration(preset);
    const spawnScale = preset.spawnScaleMultiplier > 0 ? preset.spawnScaleMultiplier : 1.4;
    const gatherScale = preset.gatherEndScaleMultiplier > 0 ? preset.gatherEndScaleMultiplier : 0.9;
    const recoverScale = preset.recoverEndScaleMultiplier > 0 ? preset.recoverEndScaleMultiplier : 1;
    const baseScale = state.baseScale;
    let remaining = elapsed;

    if (remaining <= gatherDuration) {
        const gatherT = gatherDuration <= 0 ? 1 : easeOutCubic(remaining / gatherDuration);
        return {
            position: {
                x: lerp(state.spawnPosition.x, state.originPosition.x, gatherT),
                y: lerp(state.spawnPosition.y, state.originPosition.y, gatherT),
            },
            scale: lerp(spawnScale, gatherScale, gatherT) * baseScale,
            alpha: 1,
        };
    }

    remaining -= gatherDuration;
    if (remaining <= recoverDuration) {
        const recoverT = recoverDuration <= 0 ? 1 : easeOutQuad(remaining / recoverDuration);
        return {
            position: cloneVec2(state.originPosition),
            scale: lerp(gatherScale, recoverScale, recoverT) * baseScale,
            alpha: 1,
        };
    }

    remaining -= recoverDuration;
    if (remaining <= holdDuration) {
        return {
            position: cloneVec2(state.originPosition),
            scale: recoverScale * baseScale,
            alpha: 1,
        };
    }

    remaining -= holdDuration;
    const flyT = flyDuration <= 0 ? 1 : clamp01(remaining / flyDuration);
    const position = {
        x: state.originPosition.x + state.flyDirection.x * preset.flyLaunchForce * remaining,
        y: state.originPosition.y + state.flyDirection.y * preset.flyLaunchForce * remaining - 0.5 * preset.flyGravity * remaining * remaining,
    };

    return {
        position,
        scale: recoverScale * baseScale,
        alpha: 1 - flyT,
    };
}

export function formatNumber(value: number, options?: NumberFormatOptions): string {
    const absValue = Math.abs(value);
    let text = String(absValue);

    if (options && options.withUnit && absValue >= 10000) {
        const unitText = absValue / 10000;
        text = String(unitText).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') + '万';
    }

    if (options && options.withSign && value !== 0) {
        text = (value > 0 ? '+' : '-') + text;
    }

    return text;
}

export function buildCharMetrics(numberOffsets: number[]): Record<string, number> {
    const metrics: Record<string, number> = {};
    for (const [key, value] of DEFAULT_CHARSET.entries()) {
        metrics[key] = numberOffsets[value] || 0;
    }
    return metrics;
}

export function calculateTextWidth(text: string, scale: number, metrics: Record<string, number>, interval: number): number {
    let totalOffset = 0;
    for (let i = 0; i < text.length; i++) {
        totalOffset += (metrics[text.charAt(i)] || 0) * interval * scale;
    }
    return interval * scale * Math.max(0, text.length - 1) - totalOffset;
}

export function buildGlyphLayout(text: string, position: Vec2Like, scale: number, metrics: Record<string, number>, interval: number): GlyphLayout[] {
    const width = calculateTextWidth(text, scale, metrics, interval);
    const halfWidth = width * 0.5;
    let totalOffset = 0;
    const glyphs: GlyphLayout[] = [];

    for (let i = 0; i < text.length; i++) {
        const chr = text.charAt(i);
        totalOffset += (metrics[chr] || 0) * interval * scale * 2.5;
        glyphs.push({
            char: chr,
            x: position.x + interval * scale * i - totalOffset - halfWidth,
            y: position.y,
            scale,
        });
    }

    return glyphs;
}
