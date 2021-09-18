import { Camera, DeferredPipeline, ForwardPipeline, gfx, Rect, renderer, RenderFlow, RenderPipeline, RenderStage, RenderTexture, _decorator } from 'cc';
import { PostEffectBloomStage } from './post-stages/bloom-stage';
import { IEffectStage } from './post-stages/IEffectStage';

const { ccclass, property, type } = _decorator;

interface RenderFlowInfo {
  name: string;
  priority: number;
  stages: RenderStage[];
}

export type PoolTexture = gfx.Texture & { __inUse: boolean };

export enum RenderingSubStagePhase {
  INIT = 0,
  FIRST,
  IN_PROGRESS,
  LAST,
}

export class QuadInfo extends gfx.InputAssemblerInfo {
  constructor(device: gfx.Device) {
    const attributes = new Array<gfx.Attribute>(2);
    attributes[0] = new gfx.Attribute('a_position', gfx.Format.RG32F);
    attributes[1] = new gfx.Attribute('a_texCoord', gfx.Format.RG32F);

    const vbStride = Float32Array.BYTES_PER_ELEMENT * 4;
    const vbSize = vbStride * 4;
    const vbo = device.createBuffer(new gfx.BufferInfo(gfx.BufferUsageBit.VERTEX | gfx.BufferUsageBit.TRANSFER_DST, gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE, vbSize, vbStride));

    const ibStride = Uint8Array.BYTES_PER_ELEMENT;
    const ibSize = ibStride * 6;
    const ibo = device.createBuffer(new gfx.BufferInfo(gfx.BufferUsageBit.INDEX | gfx.BufferUsageBit.TRANSFER_DST, gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE, ibSize, ibStride));

    super(attributes, [vbo], ibo);
  }
}

@ccclass('PostEffectFlow')
export class PostEffectFlow extends RenderFlow {
  private _rtPool: PoolTexture[] = [];

  private _inputTexture: gfx.Texture;
  private _stageOutputTexture: gfx.Texture;

  private _createdInputTexture = false; // indicate that this inputTexute is from user attachment or created by this flow

  quad: gfx.InputAssembler = null!;

  private _rect: gfx.Rect;

  private _renderingPhase = RenderingSubStagePhase.INIT;

  @property({ displayOrder: 0, tooltip: '需要添加后期效果的Camera' })
  @type(Camera)
  targetCamera: Camera = null!;

  private _enabledStageCount = 0;

  initialize(info: RenderFlowInfo): boolean {
    // post-effect must be the last flow to be rendered
    info.priority = Number.MAX_SAFE_INTEGER;
    return super.initialize(info);
  }

  private _sortFunc(a: RenderStage, b: RenderStage): number {
    return a.priority - b.priority;
  }

  refreshArray(): void {
    this._enabledStageCount = 0;
    this._stages.sort(this._sortFunc).forEach((s: RenderStage & IEffectStage) => {
      if (s.enabled) this._enabledStageCount++;
    });
  }

  getRenderTexture(width: number, height: number, format: gfx.Format): PoolTexture {
    let idx = this._rtPool.findIndex((t) => t.format === format && t.width === width && t.height === height && t.__inUse === false);
    if (idx >= 0) {
      const item = this._rtPool[idx];
      item.__inUse = true;

      return item;
    }

    const rt: PoolTexture = this._pipeline.device.createTexture(
      new gfx.TextureInfo(gfx.TextureType.TEX2D, gfx.TextureUsageBit.COLOR_ATTACHMENT | gfx.TextureUsageBit.SAMPLED, format, width, height)
    ) as PoolTexture;

    rt.__inUse = true;

    this._rtPool.push(rt);

    return rt;
  }

  getRenderPass(clearFlags: gfx.ClearFlags): gfx.RenderPass {
    if (this._pipeline instanceof ForwardPipeline || this._pipeline instanceof DeferredPipeline) return this._pipeline.getRenderPass(clearFlags);

    return null; // TODO: other pipelines? write my own logic here?
  }

  get inputTexture(): gfx.Texture {
    return this._inputTexture;
  }

  get stageOutputTexture(): gfx.Texture {
    return this._stageOutputTexture;
  }

  get stageRenderingPhase(): RenderingSubStagePhase {
    return this._renderingPhase;
  }

  activate(pipeline: RenderPipeline): void {
    this._pipeline = pipeline;
    const p = pipeline;
    const d = p.device;
    const c = this.targetCamera;

    if (!c) throw new Error('Please speicify a camera for this post effect flow');

    if (!c.targetTexture) {
      const rt = new RenderTexture();
      rt.initialize({
        name: 'post-effect-input-rt',
        width: d.width,
        height: d.height,
      });

      c.targetTexture = rt;
      this._createdInputTexture = true;
    } else this._createdInputTexture = false;

    this._inputTexture = c.targetTexture.getGFXTexture();

    this.quad = d.createInputAssembler(new QuadInfo(d));
    this.fillQuadData();

    this.refreshArray();

    super.activate(pipeline);
  }

  private fillQuadData(): void {
    const indices = new Uint8Array(6);
    indices[0] = 0;
    indices[1] = 1;
    indices[2] = 2;
    indices[3] = 1;
    indices[4] = 3;
    indices[5] = 2;
    this.quad.indexBuffer.update(indices);

    const mem = new Float32Array(4 * 4);
    let n = 0;
    mem[n++] = -1.0;
    mem[n++] = -1.0;
    mem[n++] = 0.0;
    mem[n++] = 1.0;
    mem[n++] = 1.0;
    mem[n++] = -1.0;
    mem[n++] = 1.0;
    mem[n++] = 1.0;
    mem[n++] = -1.0;
    mem[n++] = 1.0;
    mem[n++] = 0.0;
    mem[n++] = 0.0;
    mem[n++] = 1.0;
    mem[n++] = 1.0;
    mem[n++] = 1.0;
    mem[n++] = 0.0;
    this.quad.vertexBuffers[0].update(mem);
  }

  get rect(): gfx.Rect {
    return this._rect;
  }

  render(camera: renderer.scene.Camera): void {
    // not the target camera, ignore
    if (!this.targetCamera || camera !== this.targetCamera.camera) return;

    this._rect = this._pipeline.generateRenderArea(camera /* this._rect */); // 2param = out

    const stages = this._stages;
    let stage: RenderStage & IEffectStage;

    // bloom must be the first stage to be rendered if enabled
    const idx = stages.findIndex((s) => s instanceof PostEffectBloomStage);
    // ignore the `priority` value and forcely move to the first place
    if (idx > 0) {
      stage = stages.splice(idx, 1)[0] as RenderStage & IEffectStage;
      stages.unshift(stage);
    }

    this._stageOutputTexture = this._inputTexture;

    this._renderingPhase = RenderingSubStagePhase.INIT;

    for (let i = 0, len = stages.length; i < len; i++) {
      stage = stages[i] as RenderStage & IEffectStage;

      if (!Object.getOwnPropertyDescriptor(stage.constructor.prototype, 'outputTexture'))
        // IEffectStage interface check
        throw new Error('The RenderStage to be added into PostEffectFlow must be implemented with the IEffectStage interface');

      if (stage.enabled) {
        if (i >= this._enabledStageCount - 1) this._renderingPhase = RenderingSubStagePhase.LAST;
        else if (i === 0) this._renderingPhase = RenderingSubStagePhase.FIRST;
        else this._renderingPhase = RenderingSubStagePhase.IN_PROGRESS;

        stage.render(camera);
        this._stageOutputTexture = stage.outputTexture;
      }
    }
  }

  destroy(): void {
    super.destroy();

    this._rtPool.forEach((rt) => {
      rt.__inUse = undefined;
      rt.destroy();
    });
    this._rtPool.length = 0;

    if (this._createdInputTexture) {
      this._inputTexture.destroy();
      this.targetCamera.targetTexture = null;
    }

    this.quad.destroy();
    this._rect = undefined;
  }
}
