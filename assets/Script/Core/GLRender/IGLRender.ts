export interface IGLRender {

    // 是否激活
    isActive(): boolean;

    // 获取rect数据
    getRect(): number[];

    // 获取texCoords数据
    getTexCoords(): number[];

    // 获取x坐标
    getX(): number;

    // 获取y坐标
    getY(): number;

    // 获取尺寸
    getSize(): number;

    // 获取旋转
    getDirection(): number;
}