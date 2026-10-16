import { EdgeNetLogo } from '@/components/login/EdgeNetLogo';
import { GearIcon, RequestIcon, ShieldCheckIcon } from '@/components/login/LoginIcons';
import styles from '@/components/login/login.module.css';

/** Static data-centre image (local file). Replace the file at this path to swap the picture. */
const PHOTO = '/images/login-datacenter.jpg';

const STEPS = [
  { Icon: RequestIcon, title: 'Submit a PoC request', text: <>Capture <strong>client details</strong>, project timelines, and required resources.</> },
  { Icon: GearIcon, title: 'Provision and test', text: <>Engineers prepare the infrastructure and support testing.</> },
  { Icon: ShieldCheckIcon, title: 'Track through completion', text: <><strong>Follow progress</strong> through testing, completion, and decommissioning.</> },
];

function Steps() {
  return (
    <ol className={styles.steps}>
      {STEPS.map(({ Icon, title, text }, i) => (
        <li key={title} className={styles.step}>
          <span className={styles.num} aria-hidden="true">{i + 1}</span>
          <span className={styles.line} aria-hidden="true" />
          <span className={styles.tile} aria-hidden="true"><Icon /></span>
          <div>
            <h3 className={styles.stepTitle}>{title}</h3>
            <p className={styles.stepText}>{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Story() {
  return (
    <>
      <h2 className={styles.heading}>Every PoC, from<br /><span className={styles.accent}>request to teardown.</span></h2>
      <p className={styles.lead}>Easily request resources, track deployment status and collaborate with our engineering team — all in one place.</p>
      <Steps />
    </>
  );
}

/** Text-only wordmarks (no partner logos are used). Replace with approved logos if you are licensed to show them. */
function Partners() {
  return (
    <div className={styles.partnerBlock}>
      <ul className={styles.partners} aria-label="Technology partners">
        <li className={styles.pDell}><b>DELL</b>Technologies</li>
        <li className={styles.pOracle}>ORACLE</li>
        <li className={styles.pHpe}>HPE</li>
        <li className={styles.pCisco}>CISCO</li>
        <li className={styles.pNetapp}>NetApp</li>
      </ul>
      <p className={styles.partnerNote}>Trusted technology partners for a stronger tomorrow.</p>
    </div>
  );
}

function Decor() {
  return (
    <>
      <svg className={styles.decoTL} viewBox="0 0 130 120" aria-hidden="true">
        <defs><linearGradient id="lsTL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#10829f" stopOpacity=".8" /><stop offset="1" stopColor="#0a4a68" stopOpacity="0" /></linearGradient></defs>
        <polygon points="0,0 130,0 0,118" fill="url(#lsTL)" />
      </svg>
      <svg className={styles.decoBL} viewBox="0 0 230 130" aria-hidden="true">
        <defs>
          <linearGradient id="lsBL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00b8cc" /><stop offset="1" stopColor="#00667f" /></linearGradient>
          <linearGradient id="lsBL2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0aa6bd" stopOpacity=".35" /><stop offset="1" stopColor="#0aa6bd" stopOpacity="0" /></linearGradient>
        </defs>
        <polygon points="0,40 230,130 0,130" fill="url(#lsBL2)" />
        <polygon points="0,14 115,130 0,130" fill="url(#lsBL)" />
      </svg>
      <svg className={styles.decoBR} viewBox="0 0 260 220" aria-hidden="true" fill="none">
        <path d="M0 220 C95 208 185 140 260 20" stroke="#19b5e8" strokeOpacity=".85" strokeWidth="1.6" />
        <path d="M70 220 C150 212 215 150 260 74" stroke="#19b5e8" strokeOpacity=".4" strokeWidth="1.2" />
        <path d="M-10 220 C85 214 170 150 260 44" stroke="#2a7fe0" strokeOpacity=".35" strokeWidth="1" />
      </svg>
    </>
  );
}

/** Sign-in-only layout. The shared AuthShell (used by Register) is untouched. */
export function LoginShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      {/* Mobile and tablet: brand bar on top */}
      <header className={styles.mobileBar}>
        <EdgeNetLogo tone="onDark" size={1.9} />
        <p className={styles.mobileTagline}>Technology. Integration. Growth.</p>
      </header>

      {/* Right column on desktop: data-centre image with the sign-in card floating over it */}
      <main className={styles.right}>
        <img className={styles.photo} src={PHOTO} alt="" aria-hidden="true" decoding="async" />
        <div className={styles.shade} aria-hidden="true" />
        <p className={styles.badges}>Secure <span>/</span> Reliable <span>/</span> Scalable</p>
        <div className={styles.cardWrap}>
          <div className={styles.card}>
            <EdgeNetLogo tone="onLight" size={2.05} />
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            {children}
          </div>
        </div>
      </main>

      {/* Left column on desktop: branding panel */}
      <aside className={styles.left}>
        <Decor />
        <div className={styles.leftBody}>
          <div className={styles.brandRow}>
            <EdgeNetLogo tone="onDark" size={2.5} />
            <span className={styles.divider} aria-hidden="true" />
            <p className={styles.tagline}>Technology. Integration. Growth.</p>
          </div>
          <div className={styles.story}><Story /></div>
          <Partners />
        </div>
      </aside>

      {/* Mobile and tablet: the same story, below the form */}
      <section className={styles.mobileStory} aria-label="About the EdgeNet PoC portal">
        <Story />
        <Partners />
      </section>
    </div>
  );
}

/** "Secure access to your PoC portal" divider shown under the sign-in button. */
export function SecureNote() {
  return <p className={styles.secure}>Secure access to your PoC portal</p>;
}
