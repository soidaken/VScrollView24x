// Cocos Creator 2.4.14 API 风格
import { VScrollViewItem } from './assets/vscrollview/VScrollViewItem';
const { ccclass, property } = cc._decorator;

/** 渲染函数签名：外部把数据刷到 item 上 */
export type RenderItemFn = (node: cc.Node, index: number) => void;
/** 提供新节点（从对象池取或用 prefab 实例化） */
export type ProvideNodeFn = (index: number) => cc.Node | Promise<cc.Node>;
/** 点击回调：返回被点击的索引 */
export type OnItemClickFn = (node: cc.Node, index: number) => void;
/** 新增项出现动画回调签名 */
export type PlayItemAppearAnimationFn = (node: cc.Node, index: number) => void;

/**
 * 虚拟滚动列表组件
 * - 支持虚拟列表和简单滚动两种模式
 * - 虚拟列表模式下支持等高 Grid 布局和不等高单列布局
 * - 使用环形缓冲实现高性能逻辑
 * - 支持外部注入渲染、节点提供和点击回调
 *
 * [迁移说明] 已从 Cocos Creator 3.8.7 迁移到 2.4.14
 * [已屏蔽] @menu 装饰器（2.4.14 不支持）
 * [已屏蔽] input 全局触摸监听（2.4.14 API 不同）
 * [已屏蔽] tween 动画（需要使用 cc.tween）
 * [已屏蔽] Mask 组件检查（API 不同）
 */
@ccclass
export class VirtualScrollView extends cc.Component {
  // === 必填引用 ===
  @property({
    type: cc.Node,
    displayName: '容器节点',
    tooltip: 'content 容器节点（在 Viewport 下）',
  })
  public content: cc.Node | null = null;

  @property({
    displayName: '启用虚拟列表',
    tooltip: '是否启用虚拟列表模式（关闭则仅提供滚动功能）',
  })
  public useVirtualList: boolean = true;

  @property({
    type: cc.Prefab,
    displayName: '子项预制体',
    tooltip: '可选：从 Prefab 创建 item（等高模式）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicHeight;
    },
  })
  public itemPrefab: cc.Prefab | null = null;

  @property({
    displayName: '子项点击效果',
    tooltip: '子项点击时是否有交互效果',
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public useItemClickEffect: boolean = true;

  // === 新增：不等高模式 ===
  @property({
    displayName: '不等高模式',
    tooltip: '启用不等高模式（仅支持单列）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public useDynamicHeight: boolean = false;

  @property({
    type: [cc.Prefab],
    displayName: '子项预制体数组',
    tooltip: '不等高模式：预先提供的子项预制体数组（可在编辑器拖入）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && this.useDynamicHeight;
    },
  })
  public itemPrefabs: cc.Prefab[] = [];

  // === 列表配置 ===
  private itemHeight: number = 100;
  private itemWidth: number = 100;

  @property({
    displayName: '列数',
    tooltip: '每行列数（Grid模式，1为单列）',
    range: [1, 10, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicHeight;
    },
  })
  public columns: number = 1;

  @property({
    displayName: '列间距',
    tooltip: '列间距（像素，Grid模式）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicHeight;
    },
  })
  public columnSpacing: number = 8;

  @property({
    displayName: '项间距',
    tooltip: '项间距（像素）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public spacing: number = 8;

  @property({
    displayName: '总条数',
    tooltip: '总条数（可在运行时 setTotalCount 动态修改）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public totalCount: number = 50;

  @property({
    displayName: '额外缓冲',
    tooltip: '额外缓冲（可视区外多渲染几条，避免边缘复用闪烁）',
    range: [0, 10, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public buffer: number = 1;

  @property({ displayName: '像素对齐', tooltip: '是否启用像素对齐' })
  public pixelAlign: boolean = true;

  // === 惯性/回弹参数 ===
  @property({
    displayName: '惯性阻尼系数',
    tooltip: '指数衰减系数，越大减速越快',
    range: [0, 10, 0.5],
  })
  public inertiaDampK: number = 1;

  @property({ displayName: '弹簧刚度', tooltip: '越界弹簧刚度 K（建议 120–240）' })
  public springK: number = 150.0;

  @property({ displayName: '弹簧阻尼', tooltip: '越界阻尼 C（建议 22–32）' })
  public springC: number = 26.0;

  @property({ displayName: '速度阈值', tooltip: '速度阈值（像素/秒），低于即停止' })
  public velocitySnap: number = 5;

  @property({ displayName: '速度窗口', tooltip: '速度估计窗口（秒）' })
  public velocityWindow: number = 0.08;

  @property({ displayName: '最大惯性速度', tooltip: '最大惯性速度（像素/秒）' })
  public maxVelocity: number = 6000;

  @property({ displayName: 'iOS减速曲线', tooltip: '是否使用 iOS 风格的减速曲线' })
  public useIOSDecelerationCurve: boolean = true;

  // === 可选：外部注入的回调 ===
  public renderItemFn: RenderItemFn | null = null;
  public provideNodeFn: ProvideNodeFn | null = null;
  public onItemClickFn: OnItemClickFn | null = null;
  public playItemAppearAnimationFn: PlayItemAppearAnimationFn | null = null;

  // === 运行时状态 ===
  private _viewportH = 0;
  private _contentH = 0;
  private _boundsMin = 0;
  private _boundsMax = 0;
  private _velocity = 0;
  private _isTouching = false;
  private _velSamples: { t: number; dy: number }[] = [];

  // 环形缓冲
  private _slotNodes: cc.Node[] = [];
  private _slots = 0;
  private _slotFirstIndex = 0;

  // === 新增：不等高支持 ===
  private _itemHeights: number[] = [];
  private _prefixY: number[] = [];
  private _itemNodesCache: cc.Node[] = [];

  // 新增：记录上一次的总数，用于判断是否是新增的尾部数据
  private _lastTotalCount: number = 0;
  // 新增：标记哪些索引需要播放动画
  private _needAnimateIndices: Set<number> = new Set();

  private _getContentNode(): cc.Node {
    if (!this.content) {
      console.warn(`[VirtualScrollView] :${this.node.name} 请在属性面板绑定 content 容器节点`);
      this.content = this.node.getChildByName('content');
    }
    return this.content;
  }

  async start() {
    this.content = this._getContentNode();
    if (!this.content) return;

    // [已屏蔽] Cocos Creator 2.4.14 的 Mask 组件 API 不同
    // const mask = this.node.getComponent(cc.Mask);
    // if (!mask) {
    //   console.warn('[VirtualScrollView] 建议在视窗节点挂一个 Mask 组件用于裁剪');
    // }

    this.columns = Math.round(this.columns);
    this.columns = Math.max(1, this.columns);

    // 简单滚动模式
    if (!this.useVirtualList) {
      this._viewportH = this.node.height;
      this._contentH = this.content.height;
      this._boundsMin = 0;
      this._boundsMax = Math.max(0, this._contentH - this._viewportH);
      this._bindTouch();
      return;
    }

    // 虚拟列表模式：清空 content
    this.content.removeAllChildren();

    this._viewportH = this.node.height;

    // 不等高模式初始化
    if (this.useDynamicHeight) {
      await this._initDynamicHeightMode();
    } else {
      // 等高模式初始化
      await this._initFixedHeightMode();
    }

    this._bindTouch();
  }

  /** 绑定触摸事件 */
  private _bindTouch() {
    this.node.on(cc.Node.EventType.TOUCH_START, this._onDown, this);
    this.node.on(cc.Node.EventType.TOUCH_MOVE, this._onMove, this);
    this.node.on(cc.Node.EventType.TOUCH_END, this._onUp, this);
    this.node.on(cc.Node.EventType.TOUCH_CANCEL, this._onUp, this);
  }

  /** 等高模式初始化 */
  private async _initFixedHeightMode() {
    // 默认的 provide
    if (!this.provideNodeFn) {
      this.provideNodeFn = (index: number) => {
        if (this.itemPrefab) {
          return cc.instantiate(this.itemPrefab);
        }
        console.warn('[VirtualScrollView] 没有提供 itemPrefab');
        const n = new cc.Node('item-auto-create');
        n.width = this.node.width;
        n.height = this.itemHeight;
        return n;
      };
    }

    // 自动设置 itemHeight
    let item_pre = this.provideNodeFn(0);
    if (item_pre instanceof Promise) {
      item_pre = await item_pre;
    }
    this.itemHeight = item_pre.height;
    this.itemWidth = item_pre.width;

    this._recomputeContentHeight();

    // 环形缓冲初始化
    const stride = this.itemHeight + this.spacing;
    const visibleRows = Math.ceil(this._viewportH / stride);
    this._slots = Math.max(1, (visibleRows + this.buffer + 2) * this.columns);

    for (let i = 0; i < this._slots; i++) {
      const n = cc.instantiate(item_pre);
      n.parent = this.content!;
      n.width = this.itemWidth;
      n.height = this.itemHeight;
      this._slotNodes.push(n);
    }

    this._slotFirstIndex = 0;
    this._layoutSlots(this._slotFirstIndex, true);
  }

  /** 不等高模式初始化 */
  private async _initDynamicHeightMode() {
    // 1. 预加载所有节点并获取高度
    if (this.itemPrefabs.length === 0 || !this.provideNodeFn) {
      console.error('[VirtualScrollView] 不等高模式需要外部提供 itemPrefabs 和 provideNodeFn');
      return;
    }

    // 预加载所有节点并缓存
    this._itemNodesCache = [];
    for (let i = 0; i < this.totalCount; i++) {
      let node = this.provideNodeFn(i);
      if (node instanceof Promise) {
        node = await node;
      }
      this._itemNodesCache.push(node);
      const h = node.height || 100;
      this._itemHeights.push(h);
    }

    // 2. 构建前缀和
    this._buildPrefixSum();

    // 3. 计算需要的槽位数（按可视区域 + 缓冲）
    const avgHeight = this._contentH / this.totalCount;
    const visibleCount = Math.ceil(this._viewportH / avgHeight);
    this._slots = Math.min(this.totalCount, visibleCount + this.buffer * 2 + 2);

    // 4. 初始化环形缓冲（复用预加载的节点）
    for (let i = 0; i < this._slots; i++) {
      const node = this._itemNodesCache[i];
      node.parent = this.content!;
      this._slotNodes.push(node);
    }

    this._slotFirstIndex = 0;
    this._layoutSlots(this._slotFirstIndex, true);
  }

  /** 构建前缀和数组 */
  private _buildPrefixSum() {
    const n = this._itemHeights.length;
    this._prefixY = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      this._prefixY[i] = acc;
      acc += this._itemHeights[i] + this.spacing;
    }
    this._contentH = acc - this.spacing;
    if (this._contentH < 0) this._contentH = 0;

    this.content!.height = Math.max(this._contentH, this._viewportH);
    this._boundsMin = 0;
    this._boundsMax = Math.max(0, this._contentH - this._viewportH);
  }

  /** 不等高模式：根据滚动位置计算首个可见索引（二分查找） */
  private _yToFirstIndex(y: number): number {
    if (y <= 0) return 0;
    let l = 0,
      r = this._prefixY.length - 1,
      ans = this._prefixY.length;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (this._prefixY[m] > y) {
        ans = m;
        r = m - 1;
      } else {
        l = m + 1;
      }
    }
    return Math.max(0, ans - 1);
  }

  /** 不等高模式：计算可见区间 [start, end) */
  private _calcVisibleRange(scrollY: number): { start: number; end: number } {
    const n = this._prefixY.length;
    if (n === 0) return { start: 0, end: 0 };

    const start = this._yToFirstIndex(scrollY);
    const bottom = scrollY + this._viewportH;

    let end = start;
    while (end < n) {
      const topY = this._prefixY[end];
      const h = this._itemHeights[end];
      if (topY >= bottom) break;
      end++;
    }

    // 加上缓冲区
    return {
      start: Math.max(0, start - this.buffer),
      end: Math.min(n, end + this.buffer),
    };
  }

  update(dt: number) {
    //如果正在执行 tween 动画，不要执行 update 的物理模拟
    if (!this.content || this._isTouching || this._scrollTween) return;

    let y = this.content!.y;
    let a = 0;

    if (y < this._boundsMin) {
      a = -this.springK * (y - this._boundsMin) - this.springC * this._velocity;
    } else if (y > this._boundsMax) {
      a = -this.springK * (y - this._boundsMax) - this.springC * this._velocity;
    } else {
      if (this.useIOSDecelerationCurve) {
        const speed = Math.abs(this._velocity);
        if (speed > 2000) {
          this._velocity *= Math.exp(-this.inertiaDampK * 0.7 * dt);
        } else if (speed > 500) {
          this._velocity *= Math.exp(-this.inertiaDampK * dt);
        } else {
          this._velocity *= Math.exp(-this.inertiaDampK * 1.3 * dt);
        }
      } else {
        this._velocity *= Math.exp(-this.inertiaDampK * dt);
      }
    }

    this._velocity += a * dt;
    if (Math.abs(this._velocity) < this.velocitySnap && a === 0) {
      this._velocity = 0;
    }

    if (this._velocity !== 0) {
      y += this._velocity * dt;
      if (this.pixelAlign) y = Math.round(y);
      this._setContentY(y);
      if (this.useVirtualList) {
        this._updateVisible(false);
      }
    }
  }

  // =============== 对外 API ===============
  /** 列表并不引用和使用外部任何数据 */
  public refreshList(data: any[] | number) {
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 refreshList');
      return;
    }
    if (typeof data === 'number') {
      this.setTotalCount(data);
    } else {
      this.setTotalCount(data.length);
    }
  }

  public setTotalCount(count: number) {
    this._getContentNode();
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 setTotalCount');
      return;
    }
    const oldCount = this.totalCount;
    this.totalCount = Math.max(0, count | 0);

    // 如果是增加数据，标记新增的索引需要播放动画
    if (this.totalCount > oldCount) {
      for (let i = oldCount; i < this.totalCount; i++) {
        this._needAnimateIndices.add(i);
      }
    }

    this._recomputeContentHeight();
    this._slotFirstIndex = cc.misc.clampf(
      this._slotFirstIndex,
      0,
      Math.max(0, this.totalCount - 1)
    );
    this._layoutSlots(this._slotFirstIndex, true);
    this._updateVisible(true);
  }

  private _scrollTween: any = null;
  private _scrollToPosition(targetY: number, animate = false) {
    targetY = cc.misc.clampf(targetY, this._boundsMin, this._boundsMax);

    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }

    this._velocity = 0;
    this._isTouching = false;
    this._velSamples.length = 0;

    if (!animate) {
      this._setContentY(this.pixelAlign ? Math.round(targetY) : targetY);
      this._updateVisible(true);
    } else {
      // [已屏蔽] Cocos Creator 2.4.14 的 tween API 不同，需要使用 cc.tween
      // 暂时使用立即跳转代替动画
      console.warn('[VirtualScrollView] 动画滚动功能在 2.4.14 中暂未实现，使用立即跳转');
      this._setContentY(this.pixelAlign ? Math.round(targetY) : targetY);
      this._updateVisible(true);

      // 如需实现动画，可以使用以下代码：
      // const currentY = this.content!.y;
      // const distance = Math.abs(targetY - currentY);
      // const duration = Math.max(0.25, distance / 3000);
      // cc.tween(this.content!)
      //   .to(duration, { y: targetY }, { easing: 'backOut' })
      //   .call(() => {
      //     this._updateVisible(true);
      //     this._scrollTween = null;
      //     this._velocity = 0;
      //   })
      //   .start();
    }
  }

  public scrollToTop(animate = false) {
    this._scrollToPosition(this._boundsMin, animate);
  }

  public scrollToBottom(animate = false) {
    this._scrollToPosition(this._boundsMax, animate);
  }

  public scrollToIndex(index: number, animate = false) {
    index = cc.misc.clampf(index | 0, 0, Math.max(0, this.totalCount - 1));

    let targetY = 0;
    if (this.useDynamicHeight) {
      targetY = this._prefixY[index] || 0;
    } else {
      const row = Math.floor(index / this.columns);
      targetY = row * (this.itemHeight + this.spacing);
    }

    this._scrollToPosition(targetY, animate);
  }

  public onOffSortLayer(onoff: boolean) {
    for (const element of this._slotNodes) {
      const sitem = element.getComponent(VScrollViewItem);
      if (onoff) sitem.onSortLayer();
      else sitem.offSortLayer();
    }
  }

  /** 立即跳转到指定位置（无动画） */
  private _flashToPosition(targetY: number) {
    targetY = cc.misc.clampf(targetY, this._boundsMin, this._boundsMax);

    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }
    this._velocity = 0;
    this._isTouching = false;
    this._velSamples.length = 0;

    this._setContentY(this.pixelAlign ? Math.round(targetY) : targetY);
    this._updateVisible(true);
  }

  /** 立即跳转到顶部（无动画） */
  public flashToTop() {
    this._flashToPosition(this._boundsMin);
  }

  /** 立即跳转到底部（无动画） */
  public flashToBottom() {
    this._flashToPosition(this._boundsMax);
  }

  /** 立即跳转到指定索引（无动画） */
  public flashToIndex(index: number) {
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 flashToIndex');
      return;
    }

    index = cc.misc.clampf(index | 0, 0, Math.max(0, this.totalCount - 1));

    let targetY = 0;
    if (this.useDynamicHeight) {
      targetY = this._prefixY[index] || 0;
    } else {
      const row = Math.floor(index / this.columns);
      targetY = row * (this.itemHeight + this.spacing);
    }

    this._flashToPosition(targetY);
  }

  public refreshIndex(index: number) {
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 refreshIndex');
      return;
    }
    const first = this._slotFirstIndex;
    const last = first + this._slots - 1;
    if (index < first || index > last) return;
    const slot = index - first;
    const node = this._slotNodes[slot];
    if (node && this.renderItemFn) this.renderItemFn(node, index);
  }

  // =============== 触摸处理 ===============
  private _onDown(e: cc.Event.EventTouch) {
    this._isTouching = true;
    this._velocity = 0;
    this._velSamples.length = 0;

    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }
  }

  private _onMove(e: cc.Event.EventTouch) {
    if (!this._isTouching) return;

    const dy = e.getDelta().y;
    let y = this.content!.y + dy;

    if (this.pixelAlign) y = Math.round(y);
    this._setContentY(y);

    const t = performance.now() / 1000;
    this._velSamples.push({ t, dy });
    const t0 = t - this.velocityWindow;
    while (this._velSamples.length && this._velSamples[0].t < t0) this._velSamples.shift();

    if (this.useVirtualList) {
      this._updateVisible(false);
    }
  }

  private _onUp(e?: cc.Event.EventTouch) {
    if (!this._isTouching) return;
    this._isTouching = false;

    // 计算速度
    if (this._velSamples.length >= 2) {
      let sum = 0;
      let dtSum = 0;

      const sampleCount = Math.min(this._velSamples.length, 5);
      const startIndex = this._velSamples.length - sampleCount;

      for (let i = startIndex + 1; i < this._velSamples.length; i++) {
        sum += this._velSamples[i].dy;
        dtSum += this._velSamples[i].t - this._velSamples[i - 1].t;
      }

      if (dtSum > 0.001) {
        this._velocity = sum / dtSum;
        this._velocity = cc.misc.clampf(this._velocity, -this.maxVelocity, this.maxVelocity);
      } else {
        this._velocity =
          this._velSamples.length > 0
            ? cc.misc.clampf(
                this._velSamples[this._velSamples.length - 1].dy * 60,
                -this.maxVelocity,
                this.maxVelocity
              )
            : 0;
      }
    } else if (this._velSamples.length === 1) {
      this._velocity = cc.misc.clampf(
        this._velSamples[0].dy * 60,
        -this.maxVelocity,
        this.maxVelocity
      );
    } else {
      this._velocity = 0;
    }

    this._velSamples.length = 0;
  }

  // =============== 可见窗口（环形缓冲）===============
  private _updateVisible(force: boolean) {
    if (!this.useVirtualList) return;

    const top = this.content!.y;
    let newFirst = 0;

    if (this.useDynamicHeight) {
      const range = this._calcVisibleRange(top);
      newFirst = range.start;
    } else {
      const stride = this.itemHeight + this.spacing;
      const firstRow = Math.floor(top / stride);
      const first = firstRow * this.columns;
      newFirst = cc.misc.clampf(first, 0, Math.max(0, this.totalCount - 1));
    }

    if (this.totalCount < this._slots) {
      newFirst = 0;
    }

    if (force) {
      this._slotFirstIndex = newFirst;
      this._layoutSlots(this._slotFirstIndex, true);
      return;
    }

    const diff = newFirst - this._slotFirstIndex;
    if (diff === 0) return;

    if (Math.abs(diff) >= this._slots) {
      this._slotFirstIndex = newFirst;
      this._layoutSlots(this._slotFirstIndex, true);
      return;
    }

    const absDiff = Math.abs(diff);
    if (diff > 0) {
      const moved = this._slotNodes.splice(0, absDiff);
      this._slotNodes.push(...moved);
      this._slotFirstIndex = newFirst;

      for (let i = 0; i < absDiff; i++) {
        const slot = this._slots - absDiff + i;
        const idx = this._slotFirstIndex + slot;

        if (idx >= this.totalCount) {
          this._slotNodes[slot].active = false;
        } else {
          this._layoutSingleSlot(this._slotNodes[slot], idx, slot);
        }
      }
    } else {
      const moved = this._slotNodes.splice(this._slotNodes.length + diff, absDiff);
      this._slotNodes.unshift(...moved);
      this._slotFirstIndex = newFirst;

      for (let i = 0; i < absDiff; i++) {
        const idx = this._slotFirstIndex + i;

        if (idx >= this.totalCount) {
          this._slotNodes[i].active = false;
        } else {
          this._layoutSingleSlot(this._slotNodes[i], idx, i);
        }
      }
    }
  }

  /** 布置单个槽位 */
  private _layoutSingleSlot(node: cc.Node, idx: number, slot: number) {
    if (!this.useVirtualList) return;

    node.active = true;

    if (this.useDynamicHeight) {
      if (this._itemNodesCache[idx] && this._itemNodesCache[idx] !== node) {
        const cachedNode = this._itemNodesCache[idx];
        if (node.parent === this.content) {
          const oldIndex = this._slotNodes.indexOf(node);
          if (oldIndex !== -1) {
            this._slotNodes[oldIndex] = cachedNode;
          }
          node.removeFromParent();
          cachedNode.parent = this.content;
          node = cachedNode;
        }
      }

      const y = -this._prefixY[idx] - this._itemHeights[idx] / 2;
      node.setPosition(0, this.pixelAlign ? Math.round(y) : y);
    } else {
      const stride = this.itemHeight + this.spacing;
      const row = Math.floor(idx / this.columns);
      const col = idx % this.columns;

      const y = -row * stride - this.itemHeight / 2;
      const totalWidth = this.columns * this.itemWidth + (this.columns - 1) * this.columnSpacing;
      const x = col * (this.itemWidth + this.columnSpacing) - totalWidth / 2 + this.itemWidth / 2;

      node.setPosition(this.pixelAlign ? Math.round(x) : x, this.pixelAlign ? Math.round(y) : y);

      node.width = this.itemWidth;
      node.height = this.itemHeight;
    }

    this._updateItemClickHandler(node, idx);
    if (this.renderItemFn) this.renderItemFn(node, idx);

    // 检查是否需要播放动画
    if (this._needAnimateIndices.has(idx)) {
      if (this.playItemAppearAnimationFn) {
        this.playItemAppearAnimationFn(node, idx);
      } else {
        this._playDefaultItemAppearAnimation(node, idx);
      }
      this._needAnimateIndices.delete(idx);
    }
  }

  /** 播放Item出现动画 */
  private _playDefaultItemAppearAnimation(node: cc.Node, index: number) {
    // [已屏蔽] Cocos Creator 2.4.14 的 tween API 需要使用 cc.tween
    // 默认不实现动画，如需实现可以使用 cc.tween
    // 示例代码：
    // node.scale = 0.3;
    // cc.tween(node)
    //   .to(0.3, { scale: 1 }, { easing: 'backOut' })
    //   .start();
  }

  private _updateItemClickHandler(node: cc.Node, index: number) {
    if (!this.useVirtualList) return;

    let itemScript = node.getComponent(VScrollViewItem);
    if (!itemScript) {
      itemScript = node.addComponent(VScrollViewItem);
    }
    itemScript.useItemClickEffect = this.useItemClickEffect;

    if (!itemScript.onClickCallback) {
      itemScript.onClickCallback = (idx: number) => {
        if (this.onItemClickFn) {
          this.onItemClickFn(node, idx);
        }
      };
    }

    itemScript.setDataIndex(index);
  }

  private _layoutSlots(firstIndex: number, forceRender: boolean) {
    if (!this.useVirtualList) return;

    for (let s = 0; s < this._slots; s++) {
      const idx = firstIndex + s;
      const node = this._slotNodes[s];

      if (idx >= this.totalCount) {
        node.active = false;
      } else {
        this._layoutSingleSlot(node, idx, s);
      }
    }
  }

  // =============== 尺寸与边界计算 ===============
  private _recomputeContentHeight() {
    if (!this.useVirtualList) {
      this._contentH = this.content!.height;
      this._boundsMin = 0;
      this._boundsMax = Math.max(0, this._contentH - this._viewportH);
      return;
    }

    if (this.useDynamicHeight) {
      return;
    }

    const stride = this.itemHeight + this.spacing;
    const totalRows = Math.ceil(this.totalCount / this.columns);
    this._contentH = totalRows > 0 ? totalRows * stride - this.spacing : 0;

    this.content!.height = Math.max(this._contentH, this._viewportH);
    this._boundsMin = 0;
    this._boundsMax = Math.max(0, this._contentH - this._viewportH);
  }

  private _setContentY(y: number) {
    if (!Number.isFinite(y)) return;
    const currentY = this.content!.y;
    if (this.pixelAlign) y = Math.round(y);
    if (y === currentY) return;
    this.content!.y = y;
  }
}
