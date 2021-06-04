import { _decorator, Component, Node } from "cc";
import * as cc from "cc";
import { BaseState } from "./BaseState";
import { WalkState } from "./AllStates";

const { ccclass, property } = _decorator;

export class StateMachine extends Component {
  _owner: any;
  _currentState: BaseState;
  _prevState: BaseState;
  _globalState: BaseState;
  setHost(owner: any) {
    this._owner = owner;
  }
  setCurrentState(state: BaseState) {
    this._currentState = state;
  }
  revertToPrevState() {
    this._currentState.exit();
    let tmp = this._currentState;
    this._currentState = this._prevState;
    this._currentState.enter(this);
    this._prevState = tmp;
  }
  changeState(nextState: BaseState) {
    cc.assert(nextState, "state不能为空");

    console.log("change state");
    this._currentState.exit();
    this._prevState = this._currentState;
    this._currentState = nextState;
    this._currentState.enter(this);
  }
  hanldeMessage(msg) {
    if (this._currentState && this._currentState.onMessage(this._owner, msg)) {
      return true;
    }
    if (this._globalState && this._globalState.onMessage(this._owner, msg)) {
      return true;
    }
    return false;
  }
  update(deltaTime: number) {
    //全局状态，某些条件下，可以直接转状态
    if (this._globalState) {
      this._globalState.excute(this._owner);
    }

    if (this._currentState) {
      this._currentState.excute(this._owner);
    }
    // [4]
  }
}

/**
 * 寻路状态，攻击状态 ，空闲状态，空中状态，特殊行为状态
 * 1. 碰到建筑 ->爬墙
 * 2. 受击(子弹，炸弹)
 * 3.
 */
