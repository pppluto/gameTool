import { director, EffectAsset, gfx, Material, pipeline, PipelineStateManager, renderer, RenderPipeline, RenderStage, _decorator } from 'cc';
import { PoolTexture, PostEffectFlow, RenderingSubStagePhase } from '../post-effect-flow';
import { IEffectStage } from './IEffectStage';

const { type, ccclass, property } = _decorator;

@ccclass('VignetteStage')
export class PostEffectVignetteStage extends RenderStage implements IEffectStage {
  @property
  @type(EffectAsset)
  vignetteEffect: EffectAsset = null!;

  @property({ min: 0, max: 0.5, step: 0.01, slide: true, tooltip: '范围' })
  borderExtent = 0.04;

  @property({ min: 0.1, max: 1, step: 0.05, slide: true, tooltip: '强度' })
  borderHardness = 0.15;

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

  private _ubo: gfx.Buffer;
  private _mem: Float32Array;
  private _bindings: Map<string, number> = new Map();

  private _material: Material;
  private _sampler: gfx.Sampler;

  private _colors: gfx.Color[] = [new gfx.Color(0, 0, 0, 1)];
  private _fb: gfx.Framebuffer;
  private _renderPass: gfx.RenderPass;

  private _outputTex: gfx.Texture;

  activate(pipeline: RenderPipeline, flow: PostEffectFlow): void {
    super.activate(pipeline, flow);

    const d = this._pipeline.device;
    const f = this._flow as PostEffectFlow;

    const f32Bytes = Float32Array.BYTES_PER_ELEMENT;
    this._ubo = d.createBuffer(
      new gfx.BufferInfo(
        gfx.BufferUsageBit.UNIFORM | gfx.BufferUsageBit.TRANSFER_DST,
        gfx.MemoryUsageBit.HOST | gfx.MemoryUsageBit.DEVICE,
        4 * f32Bytes, // vec4
        4 * f32Bytes
      )
    );
    this._mem = new Float32Array(4);

    this._material = new Material();
    this._material.initialize({ effectAsset: this.vignetteEffect });

    this._sampler = d.createSampler(new gfx.SamplerInfo(gfx.Filter.LINEAR, gfx.Filter.LINEAR, gfx.Filter.NONE, gfx.Address.CLAMP, gfx.Address.CLAMP, gfx.Address.CLAMP));

    const colorAttachment = new gfx.ColorAttachment();
    colorAttachment.format = gfx.Format.RGBA8;
    colorAttachment.loadOp = gfx.LoadOp.DISCARD;
    colorAttachment.storeOp = gfx.StoreOp.STORE;
    colorAttachment.endAccesses = [gfx.AccessType.COLOR_ATTACHMENT_WRITE];
    this._renderPass = d.createRenderPass(new gfx.RenderPassInfo([colorAttachment]));
    const rt = f.getRenderTexture(d.width, d.height, gfx.Format.RGBA8);
    this._fb = d.createFramebuffer(new gfx.FramebufferInfo(this._renderPass, [rt]));

    const ps = this._material.passes[0];
    this._bindings.set('inputTexture', ps.getBinding('inputTexture'));
    this._bindings.set('vignette', ps.getBinding('vignette'));
  }

  render(camera: renderer.scene.Camera) {
    const p = this._pipeline;
    const cmd = p.commandBuffers[0];
    const f = this._flow as PostEffectFlow;

    const quad = f.quad;
    const pass = this._material.passes[0];
    const shader = pass.getShaderVariant();

    this._mem[0] = this.borderExtent;
    this._mem[1] = this.borderHardness;
    cmd.updateBuffer(this._ubo, this._mem);

    let fb = this._fb;
    let rp = this._renderPass;
    if (f.stageRenderingPhase === RenderingSubStagePhase.LAST) {
      fb = director.root.mainWindow.framebuffer;
      rp = fb.renderPass;
    }
    cmd.beginRenderPass(rp, fb, f.rect, this._colors, 0, 0);
    cmd.bindDescriptorSet(pipeline.SetIndex.GLOBAL, p.descriptorSet);

    const binding = this._bindings.get('inputTexture');
    pass.descriptorSet.bindTexture(binding, f.stageOutputTexture);
    pass.descriptorSet.bindSampler(binding, this._sampler);
    pass.descriptorSet.bindBuffer(this._bindings.get('vignette'), this._ubo);

    pass.descriptorSet.update();
    cmd.bindDescriptorSet(pipeline.SetIndex.MATERIAL, pass.descriptorSet);

    const pso = PipelineStateManager.getOrCreatePipelineState(p.device, pass, shader, this._renderPass, quad);
    if (!pso) return;

    cmd.bindPipelineState(pso);
    cmd.bindInputAssembler(quad);
    cmd.draw(quad);

    cmd.endRenderPass();

    this._outputTex = this._fb.colorTextures[0];
  }

  get outputTexture(): gfx.Texture {
    return this._outputTex;
  }

  destroy() {
    (this._fb.colorTextures[0] as PoolTexture).__inUse = false;
    this._fb.destroy();
    this._renderPass.destroy();

    this._ubo.destroy();
    this._material.destroy();
    this._sampler.destroy();

    this._colors.length = 0;

    this._mem = undefined;
    this._bindings = undefined;
  }
}
