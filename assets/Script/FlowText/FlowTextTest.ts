import FlowTextAPI from './FlowTextAPI';
import { TextType } from './FlowTextCore';

const { ccclass, property } = cc._decorator;

@ccclass
export default class FlowTextTest extends cc.Component {
    @property({ type: FlowTextAPI, tooltip: '拖入挂有 FlowTextAPI 的组件节点。' })
    flowText: FlowTextAPI | null = null;

    @property({ tooltip: '进入场景后自动播放演示。' })
    playOnLoad = true;

    @property({ tooltip: '启动演示前延迟秒数。' })
    startDelay = 0.2;

    @property({ tooltip: '单轮示例文本之间的间隔。' })
    caseInterval = 0.2;

    @property({ tooltip: '压力测试每轮生成数量。' })
    burstCount = 30;

    @property({ tooltip: '压力测试持续秒数。' })
    stressDuration = 2;

    @property({ tooltip: '压力测试每次发射间隔秒数。' })
    stressInterval = 0.08;

    @property({ tooltip: '测试区域横向范围。' })
    rangeX = 280;

    @property({ tooltip: '测试区域纵向范围。' })
    rangeY = 180;

    @property({ tooltip: '测试时写入 FlowTextAPI 的 limit。' })
    textLimit = 256;

    private _stressElapsed = 0;

    onLoad(): void {
        const api = this.getFlowText();
        if (api) {
            api.setLimit(this.textLimit);
        }
    }

    start(): void {
        if (!this.playOnLoad) {
            return;
        }

        this.scheduleOnce(() => {
            this.runDemo();
        }, this.startDelay);
    }

    runDemo(): void {
        this.stopAllTests();
        this.clearTexts();
        this.startSingleCases();

        const warmupDuration = this.caseInterval * 6;
        this.scheduleOnce(() => {
            this.startBurst();
        }, warmupDuration);

        this.startStressTest();
    }

    startSingleCases(): void {
        const api = this.getFlowText();
        if (!api) {
            return;
        }
        const cases = [
            { label: '1234', type: TextType.Normal, pos: cc.v2(-180, 100), number: true },
            { label: '4096', type: TextType.Crit, pos: cc.v2(0, 100), number: true },
            { label: '闪避', type: TextType.Miss, pos: cc.v2(180, 100), number: false },
            { label: '免疫', type: TextType.Immune, pos: cc.v2(-120, -10), number: false },
            { label: '2560', type: TextType.Heal, pos: cc.v2(120, -10), number: true },
        ];

        cases.forEach((item, index) => {
            this.scheduleOnce(() => {
                if (item.number) {
                    api.showNumber(item.pos, Number(item.label), item.type);
                    return;
                }

                api.showText(item.pos, item.label, item.type);
            }, this.caseInterval * index);
        });
    }

    startBurst(): void {
        this.spawnRandomTexts(this.burstCount);
    }

    startStressTest(): void {
        this.stopAllTests();
        this.clearTexts();
        this._stressElapsed = 0;
        this.schedule(this._tickStress, this.stressInterval);
    }

    clearTexts(): void {
        const api = this.getFlowText();
        if (api) {
            api.hideText();
        }
    }

    stopAllTests(): void {
        this.unscheduleAllCallbacks();
        this._stressElapsed = 0;
    }

    private _tickStress = (): void => {
        this._stressElapsed += this.stressInterval;
        this.spawnRandomTexts(this.burstCount);

        if (this._stressElapsed >= this.stressDuration) {
            this.unschedule(this._tickStress);
        }
    };

    private spawnRandomTexts(count: number): void {
        const api = this.getFlowText();
        if (!api) {
            return;
        }

        const typeList = [
            TextType.Normal,
            TextType.Crit,
            TextType.Miss,
            TextType.Immune,
            TextType.Heal,
        ];

        for (let i = 0; i < count; i++) {
            const type = typeList[Math.floor(Math.random() * typeList.length)];
            const pos = this.randomPosition();

            if (type === TextType.Miss) {
                api.showText(pos, '闪避', type);
                continue;
            }

            if (type === TextType.Immune) {
                api.showText(pos, '免疫', type);
                continue;
            }

            const value = Math.floor(Math.random() * 20000) + 1;
            const signedValue = type === TextType.Heal ? value : -value;
            api.showNumber(pos, signedValue, type);
        }
    }

    private randomPosition(): cc.Vec2 {
        return cc.v2(
            (Math.random() - 0.5) * this.rangeX * 2,
            (Math.random() - 0.5) * this.rangeY * 2
        );
    }

    private getFlowText(): FlowTextAPI {
        return this.flowText;
    }
}
