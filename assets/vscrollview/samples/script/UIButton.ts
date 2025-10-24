// Cocos Creator 2.4.14 API 风格
const { ccclass, property } = cc._decorator;

export type BUTTON_CALLBACK = (button: UIButton, evt: cc.Event.EventTouch) => void | Promise<any>;
export type BUTTON_MOUSE_CALLBACK = (
  button: UIButton,
  evt: cc.Event.EventMouse
) => void | Promise<any>;

// [已屏蔽] Cocos Creator 2.4.14 不支持 DEV 环境变量判断
// 可以使用 CC_DEBUG 或 CC_DEV 替代
const DEV = CC_DEBUG || false;

/**
 * 获取节点在世界坐标系下的边界框
 * [已调整] Cocos Creator 2.4.14 中没有 UITransform，使用 node 的属性代替
 * @param targetNode cc.Node 目标节点
 * @param out cc.Rect 输出的矩形边界框
 */
export function getBoundingBoxWorld(targetNode: cc.Node, out: cc.Rect) {
  const width = targetNode.width;
  const height = targetNode.height;
  const anchorX = targetNode.anchorX;
  const anchorY = targetNode.anchorY;
  out.x = -anchorX * width;
  out.y = -anchorY * height;
  out.width = width;
  out.height = height;

  // [已调整] 2.4.14 使用 convertToWorldSpaceAR 代替 transformMat4
  const lb = targetNode.convertToWorldSpaceAR(cc.v2(out.x, out.y));
  const rt = targetNode.convertToWorldSpaceAR(cc.v2(out.x + out.width, out.y + out.height));
  out.x = lb.x;
  out.y = lb.y;
  out.width = rt.x - lb.x;
  out.height = rt.y - lb.y;

  return out;
}

/**
 * 2025/10/22
 * author: soida
 * desc:按钮组件
 *
 * [迁移说明] 已从 Cocos Creator 3.8.7 迁移到 2.4.14
 *
 * @example
 * 1. 支持点击防抖
 * 2. 无需任何多余操作,只需要对任意节点进行静态API注册回调即可。
 * 3. UIButton.onClicked(node, () => {});
 * 4. UIButton.onClicked(node, (button: UIButton, evt: cc.Event.EventTouch) => {});
 * 5. UIButton.enableClick(node,false); //禁用点击
 */
@ccclass
export default class UIButton extends cc.Component {
  // ==================== Properties ====================
  node_target: cc.Node | null = null;

  @property({ tooltip: '是否有交互效果' })
  b_interaction: boolean = true;

  @property({ tooltip: '是否阻止事件冒泡到父节点' })
  b_stopPropagation: boolean = true;

  @property({ tooltip: '交互时缩放动画的目标值', range: [0.7, 1.0, 0.01] })
  scaleTarget: number = 0.96;

  @property({ tooltip: '交互时缩放动画的持续时间（毫秒）', range: [20, 300, 10] })
  duration: number = 100;

  @property({ tooltip: '是否播放音效' })
  b_audioEffectWhenClick: boolean = false;

  // ==================== Constants ====================
  @property({ tooltip: '触摸防抖间隔（毫秒）- 防止误触', range: [50, 500, 10] })
  debounceTouchInterval: number = 50;

  @property({
    tooltip: '点击回调防抖间隔（毫秒）- 防止重复触发回调/网络请求',
    range: [200, 2000, 50],
  })
  clickCallbackInterval: number = 250;

  // ==================== Private Fields ====================
  private _lastTouchStartTime: number = 0;
  private _lastTouchEndTime: number = 0;
  private _currentTouchStartTime: number = 0;
  private _lastClickCallbackTime: number = 0;
  private _touchMoveValid = false;
  private _registed: boolean = false;

  private _initScale: cc.Vec3 = cc.v3(1, 1, 1);
  // [已移除] Cocos Creator 2.4.14 不存在 UITransform
  // private _uit: UITransform | null = null;
  private _tmpVec2: cc.Vec2 = cc.v2();

  private _cbMouseStarted: BUTTON_MOUSE_CALLBACK | null = null;
  private _cbMouseMoved: BUTTON_MOUSE_CALLBACK | null = null;
  private _cbClicked: BUTTON_CALLBACK | null = null;
  private _cbStarted: BUTTON_CALLBACK | null = null;
  private _cbMoved: BUTTON_CALLBACK | null = null;
  private _cbEnded: BUTTON_CALLBACK | null = null;
  private _cbCanceled: BUTTON_CALLBACK | null = null;

  // ==================== Lifecycle Methods ====================
  protected onLoad(): void {
    // [已移除] Cocos Creator 2.4.14 不存在 UITransform
    // this._uit = this.node.getComponent(UITransform);
    // if (!this._uit) {
    //   console.error(`UIButton: onLoad, node ${this.node.name} does not have UITransform component`);
    //   return;
    // }

    this.node_target = this.node;
    if (this.node_target) {
      // [已调整] 2.4.14 使用 scale 属性
      this._initScale.x = this.node_target.scaleX;
      this._initScale.y = this.node_target.scaleY;
      this._initScale.z = 1;
    }

    this._adjustScaleTarget();
  }

  protected onEnable(): void {
    this.registerEventListeners();
  }

  protected onDisable(): void {
    this.unregisterEventListeners();
  }

  // ==================== Event Registration ====================
  private registerEventListeners() {
    if (this._registed) return;
    this._registed = true;

    this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    if (DEV) {
      this.node.on(cc.Node.EventType.MOUSE_DOWN, this.onMouseStart, this);
      this.node.on(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }
  }

  private unregisterEventListeners() {
    if (!this._registed) return;
    this._registed = false;

    this.node.off(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    if (DEV) {
      this.node.off(cc.Node.EventType.MOUSE_DOWN, this.onMouseStart, this);
      this.node.off(cc.Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }
  }

  // ==================== Event Handlers ====================
  private onMouseStart(evt: cc.Event.EventMouse) {
    if (this.b_stopPropagation) {
      evt.stopPropagation();
    }
    this._cbMouseStarted && this._cbMouseStarted(this, evt);
  }

  private onMouseMove(evt: cc.Event.EventMouse) {
    if (this.b_stopPropagation) {
      evt.stopPropagation();
    }
    this._cbMouseMoved && this._cbMouseMoved(this, evt);
  }

  private onTouchStart(evt: cc.Event.EventTouch) {
    if (this.b_stopPropagation) {
      evt.stopPropagation();
    }

    if (!this.debounceTouchStartValid()) {
      return;
    }

    this._currentTouchStartTime = Date.now();
    this._touchMoveValid = true;

    this._cbStarted && this._cbStarted(this, evt);
    if (this.node_target) {
      this._animatePressDown(this.node_target);
    }
  }

  private _tmpTouchMoveRect: cc.Rect = cc.rect();
  private onTouchMove(evt: cc.Event.EventTouch) {
    // if (this.b_stopPropagation) {
    // 	evt.stopPropagation();
    // }

    // [已调整] 2.4.14 中使用 node 直接获取边界框
    const tpos = evt.getLocation();
    getBoundingBoxWorld(this.node, this._tmpTouchMoveRect);
    if (this._touchMoveValid && !this._tmpTouchMoveRect.contains(tpos)) {
      this._touchMoveValid = false;
      // evt.stopPropagationImmediate();
      this._animateRelease(this.node_target);
      this._cbCanceled && this._cbCanceled(this, evt);
      return;
    }

    this._cbMoved && this._cbMoved(this, evt);
  }

  private async onTouchEnd(evt: cc.Event.EventTouch) {
    if (this.b_stopPropagation) {
      evt.stopPropagation();
    }

    this._cbEnded && this._cbEnded(this, evt);

    if (this.node_target) {
      this._animateRelease(this.node_target);
    }

    if (this.clickSureValid() && this.clickCallbackValid()) {
      this._cbClicked && (await this._cbClicked(this, evt));
      this._lastClickCallbackTime = Date.now();
    }
  }

  private onTouchCancel(evt: cc.Event.EventTouch) {
    if (this.b_stopPropagation) {
      evt.stopPropagation();
    }

    this._cbCanceled && this._cbCanceled(this, evt);
    if (this.node_target) {
      this._animateRelease(this.node_target);
    }
  }

  // ==================== Validation Methods ====================
  private debounceTouchStartValid(): boolean {
    const now = Date.now();
    const gap = now - this._lastTouchStartTime;
    if (gap < this.debounceTouchInterval) {
      return false;
    }
    this._lastTouchStartTime = now;
    return true;
  }

  private clickSureValid(): boolean {
    if (!this._touchMoveValid) {
      // console.logUI(`UIButton: clickSureValid false, touch moved out of bounds`);
      return false;
    }
    return true;
  }

  private clickCallbackValid(): boolean {
    const now = Date.now();
    const gap = now - this._lastClickCallbackTime;
    if (gap < this.clickCallbackInterval) {
      // console.logUI(`UIButton: clickCallbackValid false, gap=${gap}ms < ${this.clickCallbackInterval}ms, prevent duplicate callback`);
      return false;
    }
    return true;
  }

  // ==================== Helper Methods ====================
  private _adjustScaleTarget() {
    const minDiff = 16;
    const w = this.node.width;
    if (!w) return;

    const diff = Math.abs(this._initScale.x - this._initScale.x * this.scaleTarget) * w;
    if (diff < minDiff && this._initScale.x !== 0) {
      const sign = this.scaleTarget < 1 ? -1 : 1;
      this.scaleTarget = (this._initScale.x * w + sign * minDiff) / (this._initScale.x * w);
    }
  }

  private _animatePressDown(target: cc.Node) {
    if (!target || !this.b_interaction) return;
    target.scaleX = this._initScale.x * this.scaleTarget;
    target.scaleY = this._initScale.y * this.scaleTarget;
  }

  private _animateRelease(target: cc.Node) {
    if (!target || !this.b_interaction) return;
    // [已调整] Cocos Creator 2.4.14 使用 cc.tween
    cc.tween(target)
      .to(
        this.duration / 1000,
        { scaleX: this._initScale.x, scaleY: this._initScale.y },
        { easing: 'smooth' }
      )
      .start();
  }

  // ==================== Public Instance Methods ====================
  public onClicked(cb: BUTTON_CALLBACK) {
    this._cbClicked && (this._cbClicked = null);
    this._cbClicked = cb;
  }

  public onMouseStarted(cb: BUTTON_MOUSE_CALLBACK) {
    this._cbMouseStarted && (this._cbMouseStarted = null);
    this._cbMouseStarted = cb;
  }

  public onMouseMoved(cb: BUTTON_MOUSE_CALLBACK) {
    this._cbMouseMoved && (this._cbMouseMoved = null);
    this._cbMouseMoved = cb;
  }

  public onStarted(cb: BUTTON_CALLBACK) {
    this._cbStarted && (this._cbStarted = null);
    this._cbStarted = cb;
  }

  public onMoved(cb: BUTTON_CALLBACK) {
    this._cbMoved && (this._cbMoved = null);
    this._cbMoved = cb;
  }

  public onEnded(cb: BUTTON_CALLBACK) {
    this._cbEnded && (this._cbEnded = null);
    this._cbEnded = cb;
  }

  public onCanceled(cb: BUTTON_CALLBACK) {
    this._cbCanceled && (this._cbCanceled = null);
    this._cbCanceled = cb;
  }

  public enableClick(b: boolean) {
    b ? this.registerEventListeners() : this.unregisterEventListeners();

    const sprite = this.node.getComponent(cc.Sprite);
    if (sprite) {
      // [已调整] 2.4.14 使用 setMaterial 设置灰度效果
      // sprite.grayscale = !b;
      // 暂时注释，如需灰度效果需要自定义材质
    }
    this._animateRelease(this.node_target);
  }

  public enableClickVisual(b: boolean) {
    const sprite = this.node.getComponent(cc.Sprite);
    if (sprite) {
      // [已调整] 2.4.14 使用 setMaterial 设置灰度效果
      // sprite.grayscale = !b;
      // 暂时注释，如需灰度效果需要自定义材质
    }
    this._animateRelease(this.node_target);
  }

  public enableClickAction(b: boolean) {
    b ? this.registerEventListeners() : this.unregisterEventListeners();
  }

  // ==================== Static Methods ====================
  public static onClicked(
    buttonOrNode: UIButton | cc.Node | null,
    cb: BUTTON_CALLBACK
  ): UIButton | null {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onClicked(cb);
      return buttonOrNode;
    } else if (buttonOrNode instanceof cc.Node) {
      let button = buttonOrNode.getComponent(UIButton);
      if (!button) button = buttonOrNode.addComponent(UIButton);
      button.onClicked(cb);
      return button;
    } else {
      console.error(`UIButton: onClicked, buttonOrNode is null / type not match `);
    }
    return null;
  }

  public static onMouseStarted(buttonOrNode: UIButton | cc.Node, cb: BUTTON_MOUSE_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onMouseStarted(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onMouseStarted(cb);
      } else {
        console.warn(
          `UIButton: onMouseStarted, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onMouseStarted, invalid parameter type`);
    }
  }

  public static onMouseMoved(buttonOrNode: UIButton | cc.Node, cb: BUTTON_MOUSE_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onMouseMoved(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onMouseMoved(cb);
      } else {
        console.warn(
          `UIButton: onMouseMoved, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onMouseMoved, invalid parameter type`);
    }
  }

  public static onStarted(buttonOrNode: UIButton | cc.Node, cb: BUTTON_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onStarted(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onStarted(cb);
      } else {
        console.warn(
          `UIButton: onStarted, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onStarted, invalid parameter type`);
    }
  }

  public static onMoved(buttonOrNode: UIButton | cc.Node, cb: BUTTON_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onMoved(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onMoved(cb);
      } else {
        console.warn(
          `UIButton: onMoved, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onMoved, invalid parameter type`);
    }
  }

  public static onEnded(buttonOrNode: UIButton | cc.Node, cb: BUTTON_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onEnded(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onEnded(cb);
      } else {
        console.warn(
          `UIButton: onEnded, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onEnded, invalid parameter type`);
    }
  }

  public static onCanceled(buttonOrNode: UIButton | cc.Node, cb: BUTTON_CALLBACK) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.onCanceled(cb);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.onCanceled(cb);
      } else {
        console.warn(
          `UIButton: onCanceled, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: onCanceled, invalid parameter type`);
    }
  }

  public static enableClick(buttonOrNode: UIButton | cc.Node | null, b: boolean) {
    if (buttonOrNode instanceof UIButton) {
      buttonOrNode.enableClick(b);
    } else if (buttonOrNode instanceof cc.Node) {
      const button = buttonOrNode.getComponent(UIButton);
      if (button) {
        button.enableClick(b);
      } else {
        console.warn(
          `UIButton: enableClick, node ${buttonOrNode.name} does not have UIButton component`
        );
      }
    } else {
      console.warn(`UIButton: enableClick, invalid parameter type`);
    }
  }
}
