// Cocos Creator 2.4.14 API 风格
import { VirtualScrollView } from '../../VScrollView';
import UIButton from './UIButton';
const { ccclass, property } = cc._decorator;

@ccclass
export class scene1 extends cc.Component {
  @property(VirtualScrollView)
  vlist: VirtualScrollView | null = null;

  //列表数据
  private data: any[] = [];

  private renderOptOnOff = true;

  onLoad() {
    // 模拟数据
    for (let i = 0; i < 50; i++) {
      this.data.push({
        data1: `重要通知${i + 1}`,
        data2: `2025.10.${1 + i}`,
      });
    }

    // 设置虚拟列表数据
    if (this.vlist) {
      this.vlist.renderItemFn = (itemNode: cc.Node, index: number) => {
        const title = itemNode.getChildByName('title').getComponent(cc.Label);
        const time = itemNode.getChildByName('time').getComponent(cc.Label);

        title!.string = this.data[index].data1;
        time!.string = this.data[index].data2;
      };

      this.vlist.onItemClickFn = (itemNode: cc.Node, index: number) => {
        const tip = this.node.getChildByName('tip').getComponent(cc.Label);
        tip.string = `你点击了第${index + 1}项,内容:${this.data[index].data1}`;
      };

      this.vlist.refreshList(this.data);
    }

    UIButton.onClicked(this.node.getChildByName('btn1'), (button: UIButton) => {
      this.data[1].data1 = '【已修改】重要通知2';
      this.vlist.refreshIndex(1);
    });

    UIButton.onClicked(this.node.getChildByName('btn2'), (button: UIButton) => {
      this.vlist.scrollToBottom(true);
    });

    UIButton.onClicked(this.node.getChildByName('btn3'), (button: UIButton) => {
      this.vlist.scrollToIndex(10 - 1, true);
    });

    UIButton.onClicked(this.node.getChildByName('btn4'), (button: UIButton) => {
      this.renderOptOnOff = !this.renderOptOnOff;
      const tip = this.node.getChildByName('tip').getComponent(cc.Label);
      tip.string = `分层优化:${this.renderOptOnOff ? '开启' : '关闭'}`;
      this.vlist.onOffSortLayer(this.renderOptOnOff);
    });
  }
}
