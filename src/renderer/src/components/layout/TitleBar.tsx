// Çerçevesiz pencerenin üst şeridi; sağdaki pencere düğmelerini Windows çizer
// (titleBarOverlay), bu yüzden sağda 140px boşluk bırakılır.
export default function TitleBar(): React.JSX.Element {
  return (
    <div className="drag flex h-[30px] shrink-0 items-center bg-rail pl-4 pr-[140px]">
      <span className="text-xs font-bold tracking-wide text-muted-foreground">
        Oldric<span className="text-brand">Talk</span>
      </span>
    </div>
  )
}
