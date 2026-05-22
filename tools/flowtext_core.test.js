const assert = require('assert');
const core = require('../assets/Script/FlowTextCore');

function testFormatNumberWithUnitAndSign() {
    const text = core.formatNumber(12345, {
        withUnit: true,
        withSign: true
    });

    assert.strictEqual(text, '+1.2345万');
}

function testSampleStateMovesFromSpawnToFadeOut() {
    const preset = core.createRecommendedPreset(core.TextType.Normal);
    const state = core.createTextState({
        position: { x: 0, y: 0 },
        text: '99',
        textType: core.TextType.Normal,
        preset: preset,
        randomAngle: 0
    });

    const start = core.sampleTextState(state, 0);
    const end = core.sampleTextState(state, core.getTotalDuration(preset));

    assert.ok(start.position.y < 0, 'spawn position should begin below origin');
    assert.ok(end.alpha <= 0.001, 'text should fade out by the end');
    assert.ok(end.position.y > start.position.y, 'text should fly upward over time');
}

testFormatNumberWithUnitAndSign();
testSampleStateMovesFromSpawnToFadeOut();

console.log('flowtext_core tests passed');
