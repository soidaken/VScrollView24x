# UIButton.ts 迁移说明

## 迁移日期

2025 年 10 月 24 日

## 文件位置

`assets/vscrollview/samples/script/UIButton.ts`

## 主要 API 变更

### 1. 导入方式

**3.8.7 版本:**

```typescript
import {
  _decorator,
  Component,
  EventMouse,
  EventTouch,
  Input,
  Node,
  Rect,
  Sprite,
  tween,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import { DEV } from 'cc/env';
const { ccclass, property } = _decorator;
```

**2.4.14 版本:**

```typescript
const { ccclass, property } = cc._decorator;
const DEV = CC_DEBUG || false;
```

### 2. 类型变更

#### 回调函数类型

- `EventTouch` → `cc.Event.EventTouch`
- `EventMouse` → `cc.Event.EventMouse`

#### 几何类型

- `Vec2` → `cc.Vec2`, 使用 `cc.v2()` 创建
- `Vec3` → `cc.Vec3`, 使用 `cc.v3()` 创建
- `Rect` → `cc.Rect`, 使用 `cc.rect()` 创建

#### 组件类型

- `Component` → `cc.Component`
- `Node` → `cc.Node`
- `Sprite` → `cc.Sprite`

### 3. UITransform 移除

**3.8.7 版本:**

```typescript
private _uit: UITransform | null = null;

onLoad() {
  this._uit = this.node.getComponent(UITransform);
  const w = this.node.getComponent(UITransform)?.width;
}

getBoundingBoxWorld(uit: UITransform, targetNode: Node, out: Rect) {
  const width = uit.width;
  const height = uit.height;
  out.set(-uit.anchorX * width, -uit.anchorY * height, width, height);
  out.transformMat4(targetNode.worldMatrix);
}
```

**2.4.14 版本:**

```typescript
// UITransform 已完全移除

onLoad() {
  // 直接使用 node 的属性
  const w = this.node.width;
}

getBoundingBoxWorld(targetNode: cc.Node, out: cc.Rect) {
  const width = targetNode.width;
  const height = targetNode.height;
  const anchorX = targetNode.anchorX;
  const anchorY = targetNode.anchorY;

  // 使用 convertToWorldSpaceAR 转换坐标
  const lb = targetNode.convertToWorldSpaceAR(cc.v2(out.x, out.y));
  const rt = targetNode.convertToWorldSpaceAR(cc.v2(out.x + out.width, out.y + out.height));
}
```

### 4. 节点缩放操作

**3.8.7 版本:**

```typescript
private _initScale: Vec3 = new Vec3(1, 1, 1);

onLoad() {
  this.node_target.getScale(this._initScale);
}

_animatePressDown(target: Node) {
  target.setScale(
    this._initScale.x * this.scaleTarget,
    this._initScale.y * this.scaleTarget,
    this._initScale.z
  );
}
```

**2.4.14 版本:**

```typescript
private _initScale: cc.Vec3 = cc.v3(1, 1, 1);

onLoad() {
  // 使用 scaleX, scaleY 属性
  this._initScale.x = this.node_target.scaleX;
  this._initScale.y = this.node_target.scaleY;
}

_animatePressDown(target: cc.Node) {
  target.scaleX = this._initScale.x * this.scaleTarget;
  target.scaleY = this._initScale.y * this.scaleTarget;
}
```

### 5. 事件系统

**3.8.7 版本:**

```typescript
this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
this.node.on(Input.EventType.MOUSE_DOWN, this.onMouseStart, this);

onTouchStart(evt: EventTouch) {
  evt.propagationStopped = true;
  const tpos = evt.getUILocation(this._tmpVec2);
}
```

**2.4.14 版本:**

```typescript
this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
this.node.on(cc.Node.EventType.MOUSE_DOWN, this.onMouseStart, this);

onTouchStart(evt: cc.Event.EventTouch) {
  evt.stopPropagation();
  const tpos = evt.getLocation();
}
```

### 6. Tween 动画

**3.8.7 版本:**

```typescript
import { tween, Vec3 } from 'cc';

_animateRelease(target: Node) {
  tween(target)
    .to(
      this.duration / 1000,
      { scale: new Vec3(this._initScale.x, this._initScale.y, this._initScale.z) },
      { easing: 'smooth' }
    )
    .start();
}
```

**2.4.14 版本:**

```typescript
_animateRelease(target: cc.Node) {
  cc.tween(target)
    .to(
      this.duration / 1000,
      { scaleX: this._initScale.x, scaleY: this._initScale.y },
      { easing: 'smooth' }
    )
    .start();
}
```

### 7. Rect 操作

**3.8.7 版本:**

```typescript
private _tmpTouchMoveRect: Rect = new Rect();

onTouchMove(evt: EventTouch) {
  getBoundingBoxWorld(this._uit, this.node, this._tmpTouchMoveRect);
  if (!this._tmpTouchMoveRect.contains(tpos)) {
    // ...
  }
}
```

**2.4.14 版本:**

```typescript
private _tmpTouchMoveRect: cc.Rect = cc.rect();

onTouchMove(evt: cc.Event.EventTouch) {
  getBoundingBoxWorld(this.node, this._tmpTouchMoveRect);
  if (!this._tmpTouchMoveRect.contains(tpos)) {
    // ...
  }
}
```

### 8. 装饰器

**3.8.7 版本:**

```typescript
@ccclass('UIButton')
export default class UIButton extends Component {
```

**2.4.14 版本:**

```typescript
@ccclass
export default class UIButton extends cc.Component {
```

## 已屏蔽的功能

### 1. Sprite 灰度效果

**原因:** Cocos Creator 2.4.14 的 Sprite 组件没有 `grayscale` 属性

**影响:** `enableClick()` 和 `enableClickVisual()` 中的灰度效果已注释

**替代方案:** 需要使用自定义材质实现灰度效果

```typescript
public enableClick(b: boolean) {
  b ? this.registerEventListeners() : this.unregisterEventListeners();

  const sprite = this.node.getComponent(cc.Sprite);
  if (sprite) {
    // [已调整] 2.4.14 需要使用自定义材质实现灰度效果
    // sprite.grayscale = !b;
    // 暂时注释，如需灰度效果需要自定义材质
  }
  this._animateRelease(this.node_target);
}
```

### 2. DEV 环境判断

**原因:** Cocos Creator 2.4.14 不支持 `import { DEV } from 'cc/env'`

**替代方案:** 使用 `CC_DEBUG` 或 `CC_DEV`

```typescript
// [已调整] 使用 CC_DEBUG 替代 DEV
const DEV = CC_DEBUG || false;

if (DEV) {
  this.node.on(cc.Node.EventType.MOUSE_DOWN, this.onMouseStart, this);
}
```

## 核心功能保持不变

✅ 点击防抖功能 ✅ 触摸事件处理 ✅ 按压缩放效果 ✅ 鼠标事件支持（DEV 模式） ✅ 事件冒泡控制 ✅ 静态 API 使用方式 ✅ 所有回调接口

## 使用示例

使用方式完全保持不变：

```typescript
// 注册点击回调
UIButton.onClicked(node, (button: UIButton, evt: cc.Event.EventTouch) => {
  console.log('Button clicked!');
});

// 禁用/启用点击
UIButton.enableClick(node, false);
UIButton.enableClick(node, true);

// 其他事件回调
UIButton.onStarted(node, (button, evt) => {
  /* ... */
});
UIButton.onMoved(node, (button, evt) => {
  /* ... */
});
UIButton.onEnded(node, (button, evt) => {
  /* ... */
});
UIButton.onCanceled(node, (button, evt) => {
  /* ... */
});
```

## 注意事项

1. **触摸位置获取**: `evt.getUILocation()` → `evt.getLocation()`
2. **事件停止传播**: `evt.propagationStopped = true` → `evt.stopPropagation()`
3. **节点缩放**: `node.setScale(x, y, z)` → `node.scaleX = x; node.scaleY = y`
4. **世界坐标转换**: `transformMat4()` → `convertToWorldSpaceAR()`

## 测试建议

- 测试按钮点击响应
- 测试按压缩放动画
- 测试防抖功能
- 测试触摸移出边界的取消逻辑
- 测试静态 API 的各种使用方式

## 后续优化

如需实现灰度效果，可以：

1. 创建自定义 Shader
2. 使用材质系统设置灰度
3. 或者使用颜色遮罩 (cc.Color) 模拟灰度效果

```typescript
// 简单的颜色遮罩替代方案
const sprite = this.node.getComponent(cc.Sprite);
if (sprite) {
  sprite.node.color = b ? cc.Color.WHITE : cc.color(128, 128, 128);
}
```
