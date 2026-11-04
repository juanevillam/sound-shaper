/**
 * The welcome screen's three feature glyphs — the web's versions of the app's
 * `music.note.list`, `slider.horizontal.3` and `scissors` — drawn as strokes
 * with round caps, in the brand mark's own manner.
 */
type IconProps = { size?: number };

const Stroke = ({
  size = 28,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const LibraryIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3 6h11M3 11h11M3 16h6" />
    <path d="M18 17V4l3 1.5" />
    <circle cx="15.5" cy="17.5" r="2.5" />
  </Stroke>
);

export const ShapeIcon = (props: IconProps) => (
  <Stroke {...props}>
    <path d="M3 6h9M16 6h5M3 12h3M10 12h11M3 18h11M18 18h3" />
    <circle cx="14" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </Stroke>
);

export const ClipIcon = (props: IconProps) => (
  <Stroke {...props}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
  </Stroke>
);

/** Google's multicolour "G", verbatim from its branding guidelines. */
export const GoogleG = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
    />
    <path
      fill="#EA4335"
      d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
    />
  </svg>
);
