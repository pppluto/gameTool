import { Camera, Component, director, EffectAsset, _decorator } from 'cc';
import { PostEffectFlow } from './post-effect-flow';
import { PostEffectBloomStage } from './post-stages/bloom-stage';
import { PostEffectVignetteStage } from './post-stages/vignette-stage';

const { property, type, ccclass, requireComponent } = _decorator;

@ccclass('BloomParams')
class BloomParams {
  _flow: PostEffectFlow;

  @property
  enabled = true;

  @property({ min: 0, max: 2, slide: true, step: 0.05, tooltip: '高光分离阈值' })
  threshold = 0.4;

  // merge-pass params
  @property({ min: 0, max: 10, slide: true, step: 0.1, tooltip: '发光部分额外亮度' })
  exposure = 1.8;

  // blur-pass params
  @property({ min: 0, max: 5, step: 1, slide: true, tooltip: '模糊采样半径范围，越大越模糊' })
  blurRadius = 1.5;

  apply(bloom: PostEffectBloomStage): void {
    bloom.enabled = this.enabled;
    bloom.threshold = this.threshold;
    bloom.exposure = this.exposure;
    bloom.blurRadius = this.blurRadius;
  }
}

@ccclass('VignetteParams')
class VignetteParams {
  _flow: PostEffectFlow;

  @property
  enabled = true;

  @property({ min: 0, max: 0.5, step: 0.01, slide: true, tooltip: '范围' })
  borderExtent = 0.04;

  @property({ min: 0.1, max: 1, step: 0.1, slide: true, tooltip: '强度' })
  borderHardness = 0.15;

  apply(vg: PostEffectVignetteStage): void {
    vg.enabled = this.enabled;
    vg.borderExtent = this.borderExtent;
    vg.borderHardness = this.borderHardness;
  }
}

@ccclass('PostEffectComponent')
@requireComponent(Camera)
export class PostEffectComponent extends Component {
  @property
  @type(EffectAsset)
  bloomEffect: EffectAsset = null!;

  @property
  private _bloomParams = new BloomParams();
  @property
  @type(BloomParams)
  get bloomParams(): BloomParams {
    return this._bloomParams;
  }
  set bloomParams(p: BloomParams) {
    this._bloomParams = p;
    if (this._bloom) p.apply(this._bloom);
  }

  @property
  @type(EffectAsset)
  vignetteEffect: EffectAsset = null!;

  @property
  private _vgParams = new VignetteParams();
  @property
  @type(VignetteParams)
  get vignetteParams(): VignetteParams {
    return this._vgParams;
  }
  set vignetteParams(p: VignetteParams) {
    this._vgParams = p;
    if (this._vignette) p.apply(this._vignette);
  }

  private _flow: PostEffectFlow;
  private _bloom: PostEffectBloomStage;
  private _vignette: PostEffectVignetteStage;

  onLoad(): void {
    const cam = this.getComponent(Camera);
    if (!cam) throw new Error('Could not find a camera component, please attach this component to a camera node');

    if (!this.bloomEffect || !this.vignetteEffect) throw new Error('Speicify effects first.');

    const bloom = new PostEffectBloomStage();
    bloom.initialize({ name: 'bloom-stage', priority: 0 });
    bloom.bloomEffect = this.bloomEffect;
    this._bloom = bloom;

    const vg = new PostEffectVignetteStage();
    vg.initialize({ name: 'vignette-stage', priority: 1 });
    vg.vignetteEffect = this.vignetteEffect;
    this._vignette = vg;

    const ppl = director.root.pipeline;

    this._flow = new PostEffectFlow();
    this._flow.initialize({
      name: 'post-effect-flow',
      stages: [this._bloom, this._vignette],
      priority: 0,
    });
    this._flow.targetCamera = cam;

    this._flow.activate(ppl);
    ppl.flows.push(this._flow);
    ppl.flows.sort((a, b) => a.priority - b.priority);

    this._vgParams._flow = this._bloomParams._flow = this._flow;
  }

  start(): void {
    // apply params
    this._bloomParams.apply(this._bloom);
    this._vgParams.apply(this._vignette);
  }

  get bloomStage(): PostEffectBloomStage {
    return this._bloom;
  }

  get vignetteStage(): PostEffectVignetteStage {
    return this._vignette;
  }

  onDestroy(): void {
    this._flow.destroy();
    this._flow = undefined;
  }
}
