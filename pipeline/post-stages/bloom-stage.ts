import { director, EffectAsset, gfx, Material, pipeline, PipelineStateManager, renderer, RenderPipeline, RenderStage, _decorator } from 'cc';
import { PoolTexture, PostEffectFlow, RenderingSubStagePhase } from '../post-effect-flow';
import { IEffectStage } from './IEffectStage';

const { ccclass, type, property } = _decorator;

class BloomData {
  renderPass: gfx.RenderPass = null!;

  sampler: gfx.Sampler = null!;

  dualFilterTargets: gfx.Framebuffer[] = [];

  sharedTarget: gfx.Framebuffer = null!;

  colors: gfx.Color[] = [new gfx.Color(0, 0, 0, 1)];

  destroy(): void {
    this.dualFilterTargets.forEach((f) => {
      (f.colorTextures[0] as PoolTexture).__inUse = false;
      f.destroy();
    });
    (this.sharedTarget.colorTextures[0] as PoolTexture).__inUse = false;
    this.sharedTarget.destroy();

    this.sampler.destroy();

    this.colors.length = 0;
  }
}

@ccclass('BloomStage')
export class PostEffectBloomStage extends RenderStage implements IEffectStage {
  // extract-pass params
  @property({ min: 0, max: 2, slide: true, step: 0.05, tooltip: '高光分离阈值' })
  threshold = 0.4;

  // merge-pass params
  @property({ min: 0, max: 10, slide: true, step: 0.1, tooltip: '发光部分额外亮度' })
  exposure = 1.8;

  // blur-pass params
  @property({ min: 0, max: 5, step: 1, slide: true, tooltip: '模糊采样半径范围，越大越模糊' })
  blurRadius = 1.5;

  @property({ min: 1, max: 10, step: 1, slide: true, tooltip: '纹理尺寸的缩小倍数，例如2则为纹理一半，性能相关，一般不需要调整' })
  downScaling = 1;

  @property
  @type(EffectAsset)
  bloomEffect: EffectAsset = null!;

  protected _enabled = true;
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(v: boolean) {
    if (v !== this._enabled) {
      this._enabled = v;
      (this._flow as PostEffectFlow).refreshArray();
    }
  }

  // filter iteration count. 2 times is enough for mobile platform. for performance reason better not change this value.
  private _iteration = 2;

  private _rect: gfx.Rect;
  private _localRect = new gfx.Rect();

  private _data: BloomData;
  private _material: Material;

  private _extractUbo: gfx.Buffer;
  private _dualFilterUbo: gfx.Buffer;
  private _mergeUbo: gfx.Buffer;
  private _uboMems: Float32Array[] = []; // for now it seems there is no UBOBinding.offset, so can't just create 1 shared memory block for all UBOs

  private _outputTex: gfx.Texture;

  private _bindings: Map<string, number> = new Map();

  activate(pipeline: RenderPipeline, flow: PostEffectFlow): void {
    super.activate(pipeline, flow);

    const p = this._pipeline;
    const d = p.device;
    const f = this._flow as PostEffectFlow;

    this._data = new BloomData();
    this._data.sampler = d.createSampler(new gfx.SamplerInfo(gfx.Filter.LINEAR, gfx.Filter.LINEAR, gfx.Filter.NONE, gfx.Address.CLAMP, gfx.Address.CLAMP, gfx.Address.CLAMP));

    const colorAttachment = new gfx.ColorAttachment();
    colorAttachment.format = gfx.Format.RGBA8;
    colorAttachment.loadOp = gfx.LoadOp.DISCARD;
    colorAttachment.storeOp = gfx.StoreOp.STORE;
    colorAttachment.endAccesses = [gfx.AccessType.COLOR_ATTACHMENT_WRITE];
    this._data.renderPass = d.createRenderPass(new gfx.RenderPassInfo([colorAttachment]));

    const sharedTex = f.getRenderTexture(d.width, d.height, gfx.Format.RGBA8);
    this._data.sharedTarget = d.createFramebuffer(new gfx.FramebufferInfo(this._data.renderPass, [sharedTex]));

    let w = d.width / this.downScaling,
      h = d.height / this.downScaling;
    for (let i = 0; i < this._iteration; i++) {
      const t = f.getRenderTexture(Math.round(w), Math.round(h), gfx.Format.RGBA8);
      this._data.dualFilterTargets.push(d.createFramebuffer(new gfx.FramebufferInfo(this._data.renderPass, [t])));

      w = Math.max(w * 0.5, 1);
      h = Math.max(h * 0.5, 1);
    }

    const f32Bytes = Float32Array.BYTES_PER_ELEMENT;
    this._extractUbo = d.createBuffer(
      new gfx.BufferInfo(
        gfx.BufferUsageBit.UNIFORM | gfx.BufferUsageBit.TRANSFER_DST,
        gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE,
        f32Bytes * 4, // vec4
        f32Bytes * 4
      )
    );
    this._dualFilterUbo = d.createBuffer(
      new gfx.BufferInfo(
        gfx.BufferUsageBit.UNIFORM | gfx.BufferUsageBit.TRANSFER_DST,
        gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE,
        f32Bytes * 4, // vec4
        f32Bytes * 4
      )
    );
    this._mergeUbo = d.createBuffer(
      new gfx.BufferInfo(
        gfx.BufferUsageBit.UNIFORM | gfx.BufferUsageBit.TRANSFER_DST,
        gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE,
        f32Bytes * 4, // vec4
        f32Bytes * 4
      )
    );
    this._uboMems[0] = new Float32Array(4);
    this._uboMems[1] = new Float32Array(4);
    this._uboMems[2] = new Float32Array(4);

    this._material = new Material();
    this._material.initialize({ effectAsset: this.bloomEffect });

    const ps = this._material.passes;
    this._bindings.set('inputTexture', ps[0].getBinding('inputTexture'));
    this._bindings.set('bloomThreshold', ps[0].getBinding('bloomThreshold'));
    this._bindings.set('dual-inputTexture0', ps[1].getBinding('inputTexture'));
    this._bindings.set('textureSize0', ps[1].getBinding('textureSize'));
    this._bindings.set('dual-inputTexture1', ps[2].getBinding('inputTexture'));
    this._bindings.set('textureSize1', ps[2].getBinding('textureSize'));
    this._bindings.set('originTexture', ps[3].getBinding('originTexture'));
    this._bindings.set('bloomTexture', ps[3].getBinding('bloomTexture'));
    this._bindings.set('mergeExposure', ps[3].getBinding('mergeExposure'));
  }

  render(camera: renderer.scene.Camera) {
    this._rect = (this._flow as PostEffectFlow).rect;
    this.extractHighlight();
    this.applyDualFilter();
    this.mergeOutput();
  }

  private extractHighlight(): void {
    const p = this._pipeline;
    const cmd = p.commandBuffers[0];
    const f = this._flow as PostEffectFlow;

    const quad = f.quad;
    const pass = this._material.passes[0];
    const shader = pass.getShaderVariant();

    this._uboMems[0][0] = this.threshold;
    cmd.updateBuffer(this._extractUbo, this._uboMems[0]);

    cmd.beginRenderPass(this._data.renderPass, this._data.sharedTarget, this._rect, this._data.colors, 0, 0);
    cmd.bindDescriptorSet(pipeline.SetIndex.GLOBAL, p.descriptorSet);

    const binding = this._bindings.get('inputTexture');
    pass.descriptorSet.bindTexture(binding, f.inputTexture); // bloom stage will be always the first stage in the list, so directly use inputTexture here
    pass.descriptorSet.bindSampler(binding, this._data.sampler);
    pass.descriptorSet.bindBuffer(this._bindings.get('bloomThreshold'), this._extractUbo); // where is the offset?? not supported?
    pass.descriptorSet.update();
    cmd.bindDescriptorSet(pipeline.SetIndex.MATERIAL, pass.descriptorSet);

    const pso = PipelineStateManager.getOrCreatePipelineState(p.device, pass, shader, this._data.renderPass, quad);
    if (!pso) return;

    cmd.bindPipelineState(pso);
    cmd.bindInputAssembler(quad);
    cmd.draw(quad);

    cmd.endRenderPass();
  }

  private applyDualFilter(): void {
    const p = this._pipeline;
    const cmd = p.commandBuffers[0];
    const f = this._flow as PostEffectFlow;

    const quad = f.quad;
    let pass = this._material.passes[1];
    let shader = pass.getShaderVariant();
    let pso: gfx.PipelineState;

    let i: number;
    const count = this._data.dualFilterTargets.length;

    let fb: gfx.Framebuffer;
    let fbTex: gfx.Texture;

    // down filter
    let curTexture = this._data.sharedTarget.colorTextures[0];
    i = 0;
    for (; i < count; i++) {
      fb = this._data.dualFilterTargets[i];
      fbTex = fb.colorTextures[0];

      this._uboMems[1][0] = this._localRect.width = fbTex.width;
      this._uboMems[1][1] = this._localRect.height = fbTex.height;
      this._uboMems[1][2] = this.blurRadius;
      cmd.updateBuffer(this._dualFilterUbo, this._uboMems[1]);

      cmd.beginRenderPass(this._data.renderPass, fb, this._localRect, this._data.colors, 0, 0);

      const downBinding = this._bindings.get('dual-inputTexture0');
      pass.descriptorSet.bindTexture(downBinding, curTexture);
      pass.descriptorSet.bindSampler(downBinding, this._data.sampler);
      pass.descriptorSet.bindBuffer(this._bindings.get('textureSize0'), this._dualFilterUbo);

      pass.descriptorSet.update();
      cmd.bindDescriptorSet(pipeline.SetIndex.MATERIAL, pass.descriptorSet);

      pso = PipelineStateManager.getOrCreatePipelineState(p.device, pass, shader, this._data.renderPass, quad);
      if (!pso) return;

      cmd.bindPipelineState(pso);
      cmd.bindInputAssembler(quad);
      cmd.draw(quad);

      cmd.endRenderPass();

      curTexture = fbTex;
    }

    pass = this._material.passes[2];
    shader = pass.getShaderVariant();

    // up filter
    i = count - 2;
    for (; i >= 0; i--) {
      fb = this._data.dualFilterTargets[i];
      fbTex = fb.colorTextures[0];

      this._uboMems[1][0] = this._localRect.width = fbTex.width;
      this._uboMems[1][1] = this._localRect.height = fbTex.height;
      this._uboMems[1][2] = this.blurRadius;
      cmd.updateBuffer(this._dualFilterUbo, this._uboMems[1]);

      cmd.beginRenderPass(this._data.renderPass, fb, this._localRect, this._data.colors, 0, 0);

      const upBinding = this._bindings.get('dual-inputTexture1');
      pass.descriptorSet.bindTexture(upBinding, curTexture);
      pass.descriptorSet.bindSampler(upBinding, this._data.sampler);
      pass.descriptorSet.bindBuffer(this._bindings.get('textureSize1'), this._dualFilterUbo);

      pass.descriptorSet.update();
      cmd.bindDescriptorSet(pipeline.SetIndex.MATERIAL, pass.descriptorSet);

      pso = PipelineStateManager.getOrCreatePipelineState(p.device, pass, shader, this._data.renderPass, quad);
      if (!pso) return;

      cmd.bindPipelineState(pso);
      cmd.bindInputAssembler(quad);
      cmd.draw(quad);

      cmd.endRenderPass();

      curTexture = fbTex;
    }
  }

  private mergeOutput(): void {
    const p = this._pipeline;
    const cmd = p.commandBuffers[0];
    const f = this._flow as PostEffectFlow;

    const quad = f.quad;
    const pass = this._material.passes[3];
    const shader = pass.getShaderVariant();

    this._uboMems[2][0] = this.exposure;
    cmd.updateBuffer(this._mergeUbo, this._uboMems[2]);

    let fb = this._data.sharedTarget;
    let rp = this._data.renderPass;
    if (f.stageRenderingPhase === RenderingSubStagePhase.LAST) {
      fb = director.root.mainWindow.framebuffer;
      rp = fb.renderPass;
    }
    cmd.beginRenderPass(rp, fb, this._rect, this._data.colors, 0, 0);
    cmd.bindDescriptorSet(pipeline.SetIndex.GLOBAL, p.descriptorSet);

    const t1Binding = this._bindings.get('originTexture');
    const t2Binding = this._bindings.get('bloomTexture');
    pass.descriptorSet.bindTexture(t1Binding, f.inputTexture);
    pass.descriptorSet.bindTexture(t2Binding, this._data.dualFilterTargets[0].colorTextures[0]);
    pass.descriptorSet.bindSampler(t1Binding, this._data.sampler);
    pass.descriptorSet.bindSampler(t2Binding, this._data.sampler);
    pass.descriptorSet.bindBuffer(this._bindings.get('mergeExposure'), this._mergeUbo);

    pass.descriptorSet.update();
    cmd.bindDescriptorSet(pipeline.SetIndex.MATERIAL, pass.descriptorSet);

    const pso = PipelineStateManager.getOrCreatePipelineState(p.device, pass, shader, this._data.renderPass, quad);
    if (!pso) return;

    cmd.bindPipelineState(pso);
    cmd.bindInputAssembler(quad);
    cmd.draw(quad);

    cmd.endRenderPass();

    this._outputTex = fb.colorTextures[0];

    // release
    this._data.dualFilterTargets.forEach((fb) => ((fb.colorTextures[0] as PoolTexture).__inUse = false));
  }

  get outputTexture(): gfx.Texture {
    return this._outputTex;
  }

  destroy() {
    this._data.destroy();

    this._material.destroy();
    this._localRect = undefined;

    this._extractUbo.destroy();
    this._dualFilterUbo.destroy();
    this._mergeUbo.destroy();

    this._uboMems.length = 0;
    this._bindings.clear();
  }
}
