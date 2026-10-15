import { LogoMark, LogoText } from './Logo'

// Çerçevesiz pencerenin üst şeridi; sağdaki pencere düğmelerini Windows çizer
// (titleBarOverlay), bu yüzden sağdaki 140px'e hiçbir şey konmaz.
export default function TitleBar(): React.JSX.Element {
  return (
    <div className="drag relative z-[3] flex h-titlebar shrink-0 items-center gap-2 border-b border-border bg-rail pl-3 pr-[var(--titlebar-controls-w)]">
      <LogoMark size={17} />
      <LogoText className="text-[13px] leading-4" />
    </div>
  )
}
