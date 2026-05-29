import { GLNode } from "../Core/GLRender/GLNode";
import { IGLRender } from "../Core/GLRender/IGLRender";

/**
 * 所有的食物都在这个节点里面画
 */
export class FoodsGLNode extends GLNode {

    private foods: IGLRender[] = [];
    private foodCount = 0;

    init(texture: cc.Texture2D, effectAsset: cc.EffectAsset, foods: IGLRender[]) {
        super.setTexture(texture, effectAsset);

        this.foods = foods;
        this.foodCount = this.foods.length;
    }

    calRenderData(screenCenterX: number, screenCenterY: number, screenZoomRatio: number) {
        this.vCount = 0;

        //判断是否在屏幕外，加上一个最大食物宽度的距离避免半截在外面的食物不显示
        const outScreenDisX = (this.halfWinWidth + 10) / screenZoomRatio;
        const outScreenDisY = (this.halfWinHeight + 10) / screenZoomRatio;

        for (let i = 0; i < this.foodCount; i++) {
            const food = this.foods[i];

            if (Math.abs(screenCenterX - food.getX()) > outScreenDisX || Math.abs(screenCenterY - food.getY()) > outScreenDisY) {
                //屏幕外，跳过
                continue;
            }
            if (!food.isActive()) {
                //食物死亡后等待刷新，跳过
                continue;
            }

            const foodRect = food.getRect();
            const foodTexCoords = food.getTexCoords();
            const direction = food.getDirection();
            const centerX = (foodRect[0] + foodRect[2]) * 0.5;
            const centerY = (foodRect[1] + foodRect[3]) * 0.5;
            const halfWidth = (foodRect[2] - foodRect[0]) * 0.5;
            const halfHeight = (foodRect[3] - foodRect[1]) * 0.5;
            const startIndex = this.vCount * 2;
            let leftTopX = centerX - halfWidth;
            let leftTopY = centerY + halfHeight;
            let rightTopX = centerX + halfWidth;
            let rightTopY = centerY + halfHeight;
            let leftBottomX = centerX - halfWidth;
            let leftBottomY = centerY - halfHeight;
            let rightBottomX = centerX + halfWidth;
            let rightBottomY = centerY - halfHeight;

            if (direction) {
                const rad = direction * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const leftX = -halfWidth;
                const rightX = halfWidth;
                const topY = halfHeight;
                const bottomY = -halfHeight;

                leftTopX = centerX + leftX * cos - topY * sin;
                leftTopY = centerY + leftX * sin + topY * cos;
                rightTopX = centerX + rightX * cos - topY * sin;
                rightTopY = centerY + rightX * sin + topY * cos;
                leftBottomX = centerX + leftX * cos - bottomY * sin;
                leftBottomY = centerY + leftX * sin + bottomY * cos;
                rightBottomX = centerX + rightX * cos - bottomY * sin;
                rightBottomY = centerY + rightX * sin + bottomY * cos;
            }

            this.vPositions[startIndex + 0] = leftTopX + this.halfWinWidth;
            this.vPositions[startIndex + 1] = leftTopY + this.halfWinHeight;
            this.vPositions[startIndex + 2] = rightTopX + this.halfWinWidth;
            this.vPositions[startIndex + 3] = rightTopY + this.halfWinHeight;
            this.vPositions[startIndex + 4] = leftBottomX + this.halfWinWidth;
            this.vPositions[startIndex + 5] = leftBottomY + this.halfWinHeight;
            this.vPositions[startIndex + 6] = rightBottomX + this.halfWinWidth;
            this.vPositions[startIndex + 7] = rightBottomY + this.halfWinHeight;

            this.vTexCoords[startIndex + 0] = foodTexCoords[0];
            this.vTexCoords[startIndex + 1] = foodTexCoords[1];
            this.vTexCoords[startIndex + 2] = foodTexCoords[2];
            this.vTexCoords[startIndex + 3] = foodTexCoords[3];
            this.vTexCoords[startIndex + 4] = foodTexCoords[4];
            this.vTexCoords[startIndex + 5] = foodTexCoords[5];
            this.vTexCoords[startIndex + 6] = foodTexCoords[6];
            this.vTexCoords[startIndex + 7] = foodTexCoords[7];

            this.vCount += 4;
        }
        super.setRenderData();
    }
}
