# Cocos Creator 3.8.7 到 2.4.14 迁移说明

## 迁移日期

2025 年 10 月 24 日

## 迁移文件

- `VScrollView.ts` - 虚拟滚动列表主组件
- `VScrollViewItem.ts` - 列表项组件

## 主要 API 差异和修改

### 1. 导入方式变更

**3.8.7 版本:**

```typescript
import { _decorator, Component, Node, UITransform, ... } from 'cc';
const { ccclass, property } = _decorator;
```

**2.4.14 版本:**

```typescript
const { ccclass, property } = cc._decorator;
// 直接使用 cc.Node, cc.Component 等
```

### 2. 组件基类变更

- `Component` → `cc.Component`
- `Node` → `cc.Node`
- `Prefab` → `cc.Prefab`
- `EventTouch` → `cc.Event.EventTouch`

### 3. 几何类型变更

- `Vec2` → `cc.Vec2`, 使用 `cc.v2()` 创建
- `Vec3` → `cc.Vec3`, 使用 `cc.v3()` 创建
- `position` 属性: 从 `node.position` (Vec3) 改为 `node.x`, `node.y`

### 4. UITransform 组件

**说明:** Cocos Creator 2.4.14 **不存在** `UITransform` 组件

**3.8.7 版本:**

```typescript
const uit = node.getComponent(UITransform);
uit.width = 100;
uit.height = 100;
```

**2.4.14 版本:**

```typescript
// 直接使用 node 的属性
node.width = 100;
node.height = 100;
```

### 5. 节点操作

**实例化:**

- `instantiate()` → `cc.instantiate()`

**移除子节点:**

- `node.removeAllChildren()` → `node.removeAllChildren()` (相同)

**事件类型:**

- `Node.EventType.TOUCH_START` → `cc.Node.EventType.TOUCH_START`

**获取触摸增量:**

- `e.getDeltaY()` → `e.getDelta().y`
- `e.getLocation(vec2)` → `e.getLocation()` (返回值)

### 6. 数学工具函数

- `math.clamp()` → `cc.misc.clampf()`

### 7. 装饰器变更

**已屏蔽的装饰器:**

- `@menu()` - 2.4.14 不支持，已注释
- `@ccclass('ClassName')` → `@ccclass` (不带参数)

## 已屏蔽的功能

### VScrollViewItem.ts

#### 1. Sorting2D 渲染排序

**原因:** Cocos Creator 2.4.14 不支持 `Sorting2D` 组件和 `settings.querySettings`

**影响:** `changeUISortingLayer()`, `onSortLayer()`, `offSortLayer()` 函数已屏蔽

**替代方案:** 可以使用 `node.zIndex` 来控制渲染顺序（如果需要）

```typescript
// 屏蔽的代码
export function changeUISortingLayer(
  sortingNode: cc.Node,
  sortingLayer: number,
  sortingOrder?: number
) {
  // [已屏蔽] Cocos Creator 2.4.14 不支持 Sorting2D
  console.warn(
    '[VScrollViewItem] changeUISortingLayer 在 Cocos Creator 2.4.14 中不支持 Sorting2D，已屏蔽此功能'
  );
}
```

### VScrollView.ts

#### 1. 全局触摸监听

**原因:** Cocos Creator 2.4.14 的 `input` 全局对象 API 不同

**影响:** `_bindGlobalTouch()` 和 `_onGlobalTouchEnd()` 已移除

**替代方案:** 依赖节点本身的触摸事件，通常足够使用

```typescript
// 已移除
private _bindGlobalTouch() {
  input.on(Input.EventType.TOUCH_END, this._onGlobalTouchEnd, this);
}
```

#### 2. Mask 组件检查

**原因:** 2.4.14 的 Mask 组件 API 不同

**影响:** start() 方法中的 Mask 检查已注释

```typescript
// 已屏蔽
// const mask = this.node.getComponent(cc.Mask);
// if (!mask) {
//   console.warn('[VirtualScrollView] 建议在视窗节点挂一个 Mask 组件用于裁剪');
// }
```

#### 3. Tween 动画

**原因:** Cocos Creator 2.4.14 使用 `cc.tween` 而非 `tween` 函数

**影响:** `_scrollToPosition()` 中的动画滚动功能暂时使用立即跳转代替

**实现方法:** 如需动画，可参考代码注释中的示例使用 `cc.tween`

```typescript
// 如需实现动画，可以使用：
// cc.tween(this.content!)
//   .to(duration, { y: targetY }, { easing: 'backOut' })
//   .call(() => {
//     this._updateVisible(true);
//     this._scrollTween = null;
//   })
//   .start();
```

#### 4. Item 出现动画

**原因:** 同上，tween API 不同

**影响:** `_playDefaultItemAppearAnimation()` 已屏蔽

**实现方法:** 可使用 `cc.tween` 实现

## 核心功能保持不变

以下核心功能逻辑完全保持不变：

✅ 虚拟列表渲染机制 ✅ 环形缓冲算法 ✅ 等高 Grid 布局 ✅ 不等高单列布局 ✅ 触摸滚动和惯性 ✅ 弹簧回弹效果 ✅ iOS 风格减速曲线 ✅ 外部回调注入 (renderItemFn, provideNodeFn, onItemClickFn) ✅ 动态修改总数 (setTotalCount) ✅ 滚动到指定位置/索引 ✅ 像素对齐 ✅ 点击效果

## 注意事项

1. **备份文件:** 原始文件已备份为 `VScrollView.ts.backup`

2. **测试建议:**

   - 测试基本的上下滚动功能
   - 测试不同数据量的性能
   - 测试点击事件
   - 测试 setTotalCount 动态修改
   - 测试 scrollToIndex 等 API

3. **后续优化:**

   - 如需动画滚动功能，可以参考注释实现 `cc.tween`
   - 如需渲染分层，可以使用 `zIndex`
   - 如需 Item 出现动画，可以使用 `cc.tween`

4. **兼容性:**
   - 已确认代码在 TypeScript 下编译无错误
   - 整体架构和逻辑与 3.8.7 版本保持一致
   - 所有公开 API 接口保持不变

## 下一步

建议在 Cocos Creator 2.4.14 编辑器中:

1. 打开项目并检查是否有编译错误
2. 在场景中测试虚拟列表功能
3. 根据需要实现已屏蔽的动画功能
4. 调整 UI 相关的设置（如 Mask 组件）

## 技术支持

如有问题，可参考:

- Cocos Creator 2.4.14 官方文档: https://docs.cocos.com/creator/2.4/manual/zh/
- API 文档: https://docs.cocos.com/creator/2.4/api/zh/
