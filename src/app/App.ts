import { World } from './World';
import { ScrollJourney } from './ScrollJourney';
import { AudioReactive } from './AudioReactive';
import { InteractionManager } from './InteractionManager';
import { QualityManager } from './QualityManager';
import { Overlay } from '../ui/Overlay';
import { IntroDirector } from './IntroDirector';
export class App {
private world: World;
private scroll: ScrollJourney;
private audio: AudioReactive;
private interaction: InteractionManager;
private quality: QualityManager;
private overlay: Overlay;
private intro: IntroDirector;
constructor(private root: HTMLElement) {
this.scroll = new ScrollJourney();
this.audio = new AudioReactive();
this.interaction = new InteractionManager(root);
this.quality = new QualityManager();
this.overlay = new Overlay(root);
this.intro = new IntroDirector(root);
this.world = new World(root, this.quality);
this.overlay.bind({
onJumpToOrb: (index) => this.world.jumpToOrb(index),
onToggleSound: () => {
void this.audio.init();
this.audio.toggleMute();
this.overlay.setSoundMuted(this.audio.muted);
},
onSetVolume: (val) => this.audio.setVolume(val),
onClosePanel: () => this.world.closePanel(),
});
this.world.bind({
scroll: this.scroll,
audio: this.audio,
interaction: this.interaction,
overlay: this.overlay,
});
}
start() {
this.overlay.mount();
this.intro.play(() => {
this.overlay.endIntro();
this.scroll.setEnabled(true);
void this.audio.init();
this.overlay.setSoundMuted(this.audio.muted);
this.world.start();
});
}
}
