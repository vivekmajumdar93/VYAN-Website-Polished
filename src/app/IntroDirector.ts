import gsap from 'gsap';
export class IntroDirector {
private el = document.createElement('div');
private logo = document.createElement('img');
private title = document.createElement('div');
constructor(private root: HTMLElement) {
this.el.className = 'intro-cover';
this.logo.className = 'intro-logo';
this.logo.alt = 'VYAN Technologies Logo';
this.logo.src =
'https://raw.githubusercontent.com/vivekmajumdar93/VYAN-Technologies-Logo/main/IMG_9695.png';
this.title.className = 'intro-title';
this.title.textContent = 'VYAN';
this.el.appendChild(this.logo);
this.el.appendChild(this.title);
}
play(onDone: () => void) {
this.root.appendChild(this.el);
const tl = gsap.timeline({
onComplete: () => {
this.el.remove();
onDone();
},
});
tl.fromTo(
this.logo,
{ opacity: 0, scale: 0.96, filter: 'blur(10px)' },
{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.35, ease: 'sine.out' }
)
.to(this.logo, {
scale: 1.085,
opacity: 1,
duration: 0.3,
ease: 'sine.inOut',
yoyo: true,
repeat: 1,
})
.to(this.logo, {
scale: 1.09,
opacity: 1,
duration: 0.3,
ease: 'sine.inOut',
yoyo: true,
repeat: 1,
})
.to(this.el, {
opacity: 0,
duration: 0.9,
ease: 'power2.out',
});
}
}
