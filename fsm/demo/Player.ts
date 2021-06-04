import { _decorator, Component, Node } from "cc";
import * as cc from "cc";
import { StateMachine } from "./StateMachine";
import { WalkState } from "./AllStates";

const { ccclass, property } = _decorator;

@ccclass("Monster")
export class Monster extends Component {
  private _stateMachine: StateMachine;
  private _mStatus: string = "";
  onLoad() {
    this._stateMachine = new StateMachine();
    this._stateMachine.setCurrentState(WalkState.ins);
    this._stateMachine.setHost(this);
  }
  onMessage(msg) {
    return this._stateMachine.hanldeMessage(msg);
  }
  start() {
    // [3]
  }
  move() {
    console.log("move");
  }
  get stateMachine() {
    return this._stateMachine;
  }
  update(deltaTime: number) {
    this._stateMachine.update(deltaTime);
    // [4]
  }
}
