import { gfx } from "cc";

export interface IEffectStage {
    readonly outputTexture: gfx.Texture;
    enabled: boolean;
}