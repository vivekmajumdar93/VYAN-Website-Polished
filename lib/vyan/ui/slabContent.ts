// Slab content for the Shunya void orbs. Authored as HTML strings injected
// into the glass panel via Overlay.openPanel({ html }).
//
// Premium typography is handled by /lib/vyan/ui/styles.css under the `.vy-slab`
// scope so the same constants render consistently across every orb.

export const SLAB_UDBHAVA_HTML = /* html */ `
<div class="vy-slab">
  <header class="vy-slab__hero">
    <div class="vy-slab__brand">VYAN</div>
    <div class="vy-slab__tag">A Boutique Studio for Cognitive Solutions</div>
  </header>

  <p class="vy-p">
    VYAN exists at the intersection of human behavior, operational intelligence,
    and adaptive technology. We build bespoke cognitive systems designed to integrate
    seamlessly into the lives, workflows, and ambitions of modern individuals and
    organizations.
  </p>

  <p class="vy-p">
    At VYAN, technology is not viewed as static software. It is viewed as a
    <em>living operational layer</em> &mdash; one that should understand, adapt,
    evolve, and respond to the unique patterns of the people using it.
  </p>

  <p class="vy-p">
    We believe the future of digital systems is not mass-produced rigidity.
    It is <strong>personalized cognition</strong>.
  </p>

  <p class="vy-p">
    Most digital platforms force humans to adapt to predefined structures.
    VYAN operates on the opposite philosophy:
  </p>

  <blockquote class="vy-quote">
    &ldquo;Cognitive technology should adapt to human behavior &mdash; not humans
    adapting to rigid software systems.&rdquo;
  </blockquote>

  <p class="vy-p">
    Every solution engineered by VYAN is designed around behavioral flow, operational
    efficiency, emotional usability, and long-term adaptability. The result is
    technology that feels less like software and more like an intelligent extension
    of the user.
  </p>

  <h3 class="vy-h3">What We Build</h3>
  <p class="vy-p">VYAN develops highly customized cognitive ecosystems including:</p>
  <ul class="vy-list">
    <li>Adaptive AI-powered operational systems</li>
    <li>Intelligent dashboards and analytics environments</li>
    <li>Behavioral productivity architectures</li>
    <li>AI concierge and communication frameworks</li>
    <li>Business workflow automation systems</li>
    <li>Bespoke digital environments and interfaces</li>
    <li>Independent data-driven operational infrastructures</li>
    <li>Cognitive orchestration systems for individuals and organizations</li>
  </ul>
  <p class="vy-p">
    Every VYAN deployment is architected specifically for the client.
    <em>No templates. No generic replication.</em>
  </p>

  <h3 class="vy-h3">Operational Independence</h3>
  <p class="vy-p">VYAN prioritizes operational sovereignty. Our systems are engineered with a strong emphasis on:</p>
  <ul class="vy-list">
    <li>Data ownership</li>
    <li>Infrastructure flexibility</li>
    <li>Long-term scalability</li>
    <li>Workflow autonomy</li>
    <li>Vendor independence wherever possible</li>
  </ul>
  <p class="vy-p">
    We believe organizations should retain meaningful control over the systems that
    shape their operations and decision-making processes.
  </p>

  <h3 class="vy-h3">The VYAN Approach</h3>
  <p class="vy-p">VYAN combines:</p>
  <ul class="vy-list">
    <li>Strategic business thinking</li>
    <li>Behavioral analysis</li>
    <li>AI systems architecture</li>
    <li>Immersive interface design</li>
    <li>Workflow optimization</li>
    <li>Human-centric operational engineering</li>
  </ul>
  <p class="vy-p">
    This interdisciplinary approach allows us to create systems that are both
    technologically advanced and deeply usable.
  </p>

  <h3 class="vy-h3">Beyond Software</h3>
  <p class="vy-p">
    VYAN is not merely a software studio. It is an evolving cognitive framework
    focused on creating intelligent operational environments that amplify clarity,
    execution, adaptability, and human potential.
  </p>
  <p class="vy-p">The objective is simple:</p>
  <blockquote class="vy-quote">
    Build technology that feels aligned with the way humans naturally think,
    operate, and evolve.
  </blockquote>

  <footer class="vy-slab__foot">
    <div class="vy-slab__sig">VYAN™</div>
    <div class="vy-slab__sigsub">Engineered for Cognitive Intelligence.</div>
  </footer>
</div>
`;

// Sandhi — four translucent contact cards, slightly different hues, with an
// active/inactive status pill that an admin can toggle later by flipping the
// `data-status` attribute on each card from `active` to `inactive`.
export const SLAB_SANDHI_HTML = /* html */ `
<div class="vy-slab vy-slab--sandhi">
  <header class="vy-slab__hero vy-slab__hero--center">
    <div class="vy-slab__brand">SANDHI</div>
    <div class="vy-slab__tag">The Communiqué of VYAN</div>
  </header>

  <div class="vy-card-grid">
    <article class="vy-card vy-card--hue-1" data-status="active">
      <div class="vy-card__head">
        <div class="vy-card__name">Prathama Saṅketa</div>
        <div class="vy-card__pill">
          <span class="vy-card__dot"></span>
          <span class="vy-card__pill-label">Active</span>
        </div>
      </div>
      <div class="vy-card__role">General Queries</div>
      <a class="vy-card__mail" href="mailto:reachus@vyanlabs.com">reachus@vyanlabs.com</a>
    </article>

    <article class="vy-card vy-card--hue-2" data-status="active">
      <div class="vy-card__head">
        <div class="vy-card__name">Prājña Abhiyāntrikī</div>
        <div class="vy-card__pill">
          <span class="vy-card__dot"></span>
          <span class="vy-card__pill-label">Active</span>
        </div>
      </div>
      <div class="vy-card__role">Technical Support</div>
      <a class="vy-card__mail" href="mailto:need-support@vyanlabs.com">need-support@vyanlabs.com</a>
    </article>

    <article class="vy-card vy-card--hue-3" data-status="active">
      <div class="vy-card__head">
        <div class="vy-card__name">Rakṣādeśa Adhiṣṭhāna</div>
        <div class="vy-card__pill">
          <span class="vy-card__dot"></span>
          <span class="vy-card__pill-label">Active</span>
        </div>
      </div>
      <div class="vy-card__role">Administrative Governance</div>
      <a class="vy-card__mail" href="mailto:admin@vyanlabs.com">admin@vyanlabs.com</a>
    </article>

    <article class="vy-card vy-card--hue-4 vy-card--brand" data-status="active" data-auto-status="true">
      <img class="vy-card__logo" src="/logo.png" alt="VYAN" />
      <div class="vy-card__brandname">VYAN</div>
      <div class="vy-card__brandtag">Architecting the Liquid Infinite</div>
      <a class="vy-card__site" href="https://vyanlabs.com" target="_blank" rel="noopener">vyanlabs.com</a>
      <div class="vy-card__pill vy-card__pill--bottom">
        <span class="vy-card__dot"></span>
        <span class="vy-card__pill-label">System Online</span>
      </div>
    </article>
  </div>
</div>
`;

// Saṅkalpa — Intention orb. A REAL functional product-request form
// wired to /api/sankalpa (Mongo + SMTP linking-ready).
export const SLAB_SANKALPA_HTML = /* html */ `
<div class="vy-slab vy-slab--sankalpa">
  <p class="vy-p">
    Saṅkalpa is the seam between <em>intention</em> and <em>arrival</em>. Cross it deliberately —
    tell VYAN what you are building, in what shape, by when. We will respond with whether
    the cognition you require can be delivered within your window.
  </p>

  <form id="sankalpa-form" class="sk-form" novalidate autocomplete="on" data-vyan-form="sankalpa">
    <div class="sk-row sk-row--toggle">
      <label class="sk-toggle"><input type="radio" name="type" value="individual" checked /> <span>Individual</span></label>
      <label class="sk-toggle"><input type="radio" name="type" value="enterprise" /> <span>Enterprise</span></label>
    </div>

    <div class="sk-grid">
      <label class="sk-field">
        <span class="sk-k">Your Name <em>*</em></span>
        <input type="text" name="name" required maxlength="120" placeholder="e.g. Ananya Rao" />
      </label>
      <label class="sk-field">
        <span class="sk-k">Email <em>*</em></span>
        <input type="email" name="email" required maxlength="240" placeholder="you@domain.com" />
      </label>
      <label class="sk-field sk-field--enterprise">
        <span class="sk-k">Company <em data-only="enterprise">*</em></span>
        <input type="text" name="company" maxlength="200" placeholder="Organization name" />
      </label>
      <label class="sk-field">
        <span class="sk-k">Role / Title</span>
        <input type="text" name="role" maxlength="120" placeholder="Founder, CTO, etc." />
      </label>
      <label class="sk-field">
        <span class="sk-k">Phone (optional)</span>
        <input type="tel" name="phone" maxlength="40" placeholder="optional" />
      </label>
    </div>

    <fieldset class="sk-fieldset">
      <legend class="sk-k">Your Intent <em>*</em></legend>
      <label class="sk-radio"><input type="radio" name="productIntent" value="existing_as_is" checked /> <span><strong>Adopt an existing VYAN product as-is.</strong> I want what is already manifest.</span></label>
      <label class="sk-radio"><input type="radio" name="productIntent" value="modify_combination" /> <span><strong>Modify a single product, or combine several.</strong> I need a tailored stack.</span></label>
      <label class="sk-radio"><input type="radio" name="productIntent" value="fresh_other" /> <span><strong>Build something altogether new (Fresh / Other).</strong> My idea is not yet in your constellation.</span></label>
    </fieldset>

    <div class="sk-products" data-show-on="modify_combination">
      <span class="sk-k">Which products interest you?</span>
      <div class="sk-checks">
        <label><input type="checkbox" name="productsOfInterest" value="ritam" /> <span>VYAN Ṛtam</span></label>
        <label><input type="checkbox" name="productsOfInterest" value="ojas" /> <span>VYAN Ojas</span></label>
        <label><input type="checkbox" name="productsOfInterest" value="mudra" /> <span>VYAN Mudrā</span></label>
        <label><input type="checkbox" name="productsOfInterest" value="netra" /> <span>VYAN Netra</span></label>
        <label><input type="checkbox" name="productsOfInterest" value="akriti" /> <span>VYAN Ākṛti</span></label>
        <label><input type="checkbox" name="productsOfInterest" value="sutra" /> <span>VYAN Sūtra</span></label>
      </div>
    </div>

    <label class="sk-field">
      <span class="sk-k">Usage Requirements <em>*</em></span>
      <textarea name="usageRequirements" rows="4" required minlength="12" maxlength="4000"
        placeholder="Describe how you intend to use the product(s) — the problem you are solving, the users you are serving, the outcome you want."></textarea>
    </label>

    <label class="sk-field">
      <span class="sk-k">Requested Timeline <em>*</em></span>
      <input type="text" name="desiredTimeline" required maxlength="200" placeholder="e.g. by Q4 2026, within 6 weeks, etc." />
      <span class="sk-help">VYAN will review and respond with whether delivery is feasible within your window.</span>
    </label>

    <label class="sk-field">
      <span class="sk-k">How did you find VYAN?</span>
      <input type="text" name="hearAboutUs" maxlength="200" placeholder="optional" />
    </label>

    <div class="sk-actions">
      <button type="submit" class="sk-submit">
        <span class="sk-submit__lbl">Transmit Saṅkalpa</span>
        <span class="sk-submit__spinner" aria-hidden="true"></span>
      </button>
    </div>
    <div class="sk-result" role="status" aria-live="polite"></div>
  </form>
</div>
`;
