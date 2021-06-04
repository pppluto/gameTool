import { _decorator } from "cc";
import { BaseState } from "./BaseState";
import { Monster } from "./Player";

export class WalkState extends BaseState {
  private static _ins: WalkState;

  static get ins() {
    if (!WalkState._ins) {
      WalkState._ins = new WalkState();
    }
    return WalkState._ins;
  }
  excute(owner: Monster) {
    owner.move();
  }
  onMessage(owner: Monster, msg) {
    switch (msg) {
      case "attack":
        owner.stateMachine.changeState(AttackState.ins);
        return true;
      default:
    }
    return false;
  }
}

export class AttackState extends BaseState {
  private static _ins: AttackState;

  static get ins() {
    if (!AttackState._ins) {
      AttackState._ins = new AttackState();
    }
    return AttackState._ins;
  }
  onMessage(owner, msg) {
    return false;
  }
}
