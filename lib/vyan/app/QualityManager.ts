export type QualityPreset = {
  pixelRatio: number;
  particles: number;
  bloomStrength: number;
  bloomRadius: number;
  fogDensity: number;
  lowShader: boolean;
};

export class QualityManager {
  private w = window.innerWidth;
  private h = window.innerHeight;
  public preset: QualityPreset = this.computePreset();

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.preset = this.computePreset();
  }

  isMobile() {
    return this.w < 768;
  }

  pixelRatio() {
    return Math.min(window.devicePixelRatio, this.preset.pixelRatio);
  }

  private computePreset(): QualityPreset {
    const mobile = this.w < 768;
    const tablet = this.w >= 768 && this.w < 1200;

    if (mobile) {
      return {
        pixelRatio: 1.0,
        particles: 2600,
        bloomStrength: 0.38,
        bloomRadius: 0.18,
        fogDensity: 0.009,
        lowShader: true,
      };
    }

    if (tablet) {
      return {
        pixelRatio: 1.2,
        particles: 3600,
        bloomStrength: 0.48,
        bloomRadius: 0.22,
        fogDensity: 0.008,
        lowShader: false,
      };
    }

    return {
      pixelRatio: 1.45,
      particles: 4800,
      bloomStrength: 0.56,
      bloomRadius: 0.26,
      fogDensity: 0.007,
      lowShader: false,
    };
  }
}
