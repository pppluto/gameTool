import { _decorator } from "cc";
import * as cc from "cc";

export abstract class BaseState {
  _name: string;

  enter(owner: any) {
    console.log("onenter");
  }
  exit() {}
  excute(owner: any) {}

  abstract onMessage(owner, msg): boolean;
}
