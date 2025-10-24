# Scene 文件迁移说明

## 迁移日期

2025 年 10 月 24 日

## 迁移文件

- `scene1.ts` - 等高列表场景
- `scene2.ts` - 不等高列表场景
- `scene4.ts` - Grid 布局场景

## 主要 API 变更

### 1. 导入方式统一调整

**3.8.7 版本:**

```typescript
import { _decorator, Component, Label, Node, instantiate } from 'cc';
import { VirtualScrollView } from '../../VScrollView';
import UIButton from './UIButton';
const { ccclass, property } = _decorator;
```

**2.4.14 版本:**

```typescript
// Cocos Creator 2.4.14 API 风格
import { VirtualScrollView } from '../../VScrollView';
import UIButton from './UIButton';
const { ccclass, property } = cc._decorator;
```

### 2. 组件基类和装饰器

**3.8.7 版本:**

```typescript
@ccclass('scene1')
export class scene1 extends Component {
```

**2.4.14 版本:**

```typescript
@ccclass
export class scene1 extends cc.Component {
```

### 3. 类型引用变更

所有导入的类型改为使用 `cc` 全局对象：

| 3.8.7           | 2.4.14             |
| --------------- | ------------------ |
| `Node`          | `cc.Node`          |
| `Label`         | `cc.Label`         |
| `Component`     | `cc.Component`     |
| `instantiate()` | `cc.instantiate()` |

### 4. 回调函数类型变更

**scene1.ts & scene4.ts 示例:**

**3.8.7 版本:**

```typescript
this.vlist.renderItemFn = (itemNode: Node, index: number) => {
  const title = itemNode.getChildByName('title').getComponent(Label);
  const time = itemNode.getChildByName('time').getComponent(Label);
  title!.string = this.data[index].data1;
  time!.string = this.data[index].data2;
};

this.vlist.onItemClickFn = (itemNode: Node, index: number) => {
  const tip = this.node.getChildByName('tip').getComponent(Label);
  tip.string = `你点击了第${index + 1}项`;
};
```

**2.4.14 版本:**

```typescript
this.vlist.renderItemFn = (itemNode: cc.Node, index: number) => {
  const title = itemNode.getChildByName('title').getComponent(cc.Label);
  const time = itemNode.getChildByName('time').getComponent(cc.Label);
  title!.string = this.data[index].data1;
  time!.string = this.data[index].data2;
};

this.vlist.onItemClickFn = (itemNode: cc.Node, index: number) => {
  const tip = this.node.getChildByName('tip').getComponent(cc.Label);
  tip.string = `你点击了第${index + 1}项`;
};
```

### 5. 节点实例化 (scene2.ts 专用)

**3.8.7 版本:**

```typescript
this.vlist.provideNodeFn = (index: number) => {
  const itemdata = this.data[index];
  if (itemdata.type === 1) {
    return instantiate(this.vlist.itemPrefabs[0]);
  } else if (itemdata.type === 2) {
    return instantiate(this.vlist.itemPrefabs[1]);
  } else if (itemdata.type === 3) {
    return instantiate(this.vlist.itemPrefabs[2]);
  }
};
```

**2.4.14 版本:**

```typescript
this.vlist.provideNodeFn = (index: number) => {
  const itemdata = this.data[index];
  if (itemdata.type === 1) {
    return cc.instantiate(this.vlist.itemPrefabs[0]);
  } else if (itemdata.type === 2) {
    return cc.instantiate(this.vlist.itemPrefabs[1]);
  } else if (itemdata.type === 3) {
    return cc.instantiate(this.vlist.itemPrefabs[2]);
  }
};
```

## 各场景文件说明

### scene1.ts - 等高列表场景

**功能:**

- 展示基本的等高虚拟列表
- 支持刷新单项、滚动到底部、滚动到指定索引
- 支持渲染分层优化开关

**迁移要点:**

- 所有 `Node`、`Label` 类型改为 `cc.Node`、`cc.Label`
- 组件基类改为 `cc.Component`
- 装饰器改为不带参数的 `@ccclass`

### scene2.ts - 不等高列表场景

**功能:**

- 展示不等高的虚拟列表（3 种不同高度的 item）
- 支持多种预制体类型
- 动态根据数据类型实例化对应的预制体

**迁移要点:**

- `instantiate()` → `cc.instantiate()`
- `provideNodeFn` 回调中的实例化函数调整
- 所有类型引用改为 `cc.*` 格式

### scene4.ts - Grid 布局场景

**功能:**

- 展示 Grid 网格布局的虚拟列表
- 支持多列显示
- 与 scene1 类似的功能（刷新、滚动、分层优化）

**迁移要点:**

- 与 scene1.ts 相同的迁移方式
- 所有 API 调用改为 2.4.14 风格

## 核心功能保持不变

所有场景文件的核心逻辑完全保持不变：

✅ VirtualScrollView 的使用方式 ✅ 数据绑定和渲染 ✅ 点击事件处理 ✅ 列表操作（刷新、滚动） ✅ UIButton 集成 ✅ 业务逻辑代码

## 迁移模式总结

所有 scene 文件遵循统一的迁移模式：

1. **移除导入的具体类型** - 不再从 'cc' 导入具体类型
2. **使用 cc 全局对象** - 所有类型通过 cc.\* 访问
3. **简化装饰器** - @ccclass 不再需要参数
4. **保持逻辑不变** - 业务代码完全不需要修改

## 使用示例

迁移后的使用方式完全一致：

```typescript
// 设置渲染回调
this.vlist.renderItemFn = (itemNode: cc.Node, index: number) => {
  const label = itemNode.getComponent(cc.Label);
  label.string = this.data[index];
};

// 设置点击回调
this.vlist.onItemClickFn = (itemNode: cc.Node, index: number) => {
  console.log('Clicked item:', index);
};

// 刷新列表
this.vlist.refreshList(this.data);

// 滚动操作
this.vlist.scrollToBottom(true);
this.vlist.scrollToIndex(10, true);
```

## 验证结果

✔️ **scene1.ts** - 编译通过，无错误 ✔️ **scene2.ts** - 编译通过，无错误 ✔️ **scene4.ts** - 编译通过，无错误

## 测试建议

### scene1.ts 测试项

- [ ] 列表正常显示 50 条数据
- [ ] 点击列表项显示正确提示
- [ ] btn1: 修改第 2 项数据
- [ ] btn2: 滚动到底部
- [ ] btn3: 滚动到第 10 项
- [ ] btn4: 分层优化开关

### scene2.ts 测试项

- [ ] 三种不同高度的 item 正确显示
- [ ] 不等高布局正确渲染
- [ ] 根据 type 正确实例化预制体
- [ ] 点击事件正常工作
- [ ] 滚动操作正常

### scene4.ts 测试项

- [ ] Grid 网格布局正确显示
- [ ] 多列排列正确
- [ ] 所有按钮功能正常
- [ ] 滚动流畅无卡顿

## 注意事项

1. **类型一致性**: 确保所有回调函数的参数类型使用 `cc.Node` 而非 `Node`
2. **组件获取**: `getComponent(cc.Label)` 而非 `getComponent(Label)`
3. **实例化**: `cc.instantiate()` 而非 `instantiate()`
4. **装饰器**: 使用 `@ccclass` 而非 `@ccclass('ClassName')`

## 完成状态

🎉 **所有 scene 文件迁移完成，代码编译通过，无错误！**

迁移后的代码保持了原有的功能和逻辑，只是适配了 Cocos Creator 2.4.14 的 API 风格。
