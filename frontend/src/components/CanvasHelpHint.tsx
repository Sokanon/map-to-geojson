function CanvasHelpHint() {
  return (
    <div className="absolute bottom-4 left-4 text-[0.7rem] text-muted-foreground bg-background/70 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
      Scroll to zoom | Middle-click drag to pan
    </div>
  );
}

export default CanvasHelpHint;
